import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SessionUser } from '@/lib/auth/session';
import { closeDb, dbQuery, ensureDbReady } from '@/lib/db';
import {
  deleteStayUploadedMedia,
  normalizeSafeUploadSegments,
  readLocalUploadFile,
  uploadStayMediaBuffer,
} from '@/lib/storage';
import { createStayBooking } from '@/modules/bookings';
import { getStayDetailBySlug } from '@/modules/catalog';
import {
  attachMediaToStay,
  createHostStayRoom,
  deleteHostStayRoom,
  getHostConsoleData,
  removeMediaFromStay,
  updateHostStayConfiguration,
  updateHostStayRoom,
} from '@/modules/host';

let tempDir: string;
let uploadsDir: string;

// Minimal valid 1x1 PNG bytes
const SAMPLE_PNG = Buffer.from(
  '89504e470d0a1a0a0000000d4948445200000001000000010802000000907753de0000000c49444154789c63f8cfc000000301010018dd8d2b0000000049454e44ae426082',
  'hex'
);

async function fetchUser(email: string): Promise<SessionUser> {
  const res = await dbQuery(
    `SELECT id, email, full_name, role, nationality, membership_tier, membership_expires_at,
            reward_credit_vnd, vat_tax_id, preferred_locale, preferred_currency, phone
     FROM users WHERE email = $1`,
    [email]
  );
  const u = res.rows[0]!;
  return {
    id: String(u.id),
    email: String(u.email),
    fullName: String(u.full_name),
    role: u.role as SessionUser['role'],
    nationality: String(u.nationality),
    membershipTier: u.membership_tier as SessionUser['membershipTier'],
    membershipExpiresAt: u.membership_expires_at ? String(u.membership_expires_at) : null,
    rewardCreditVnd: Number(u.reward_credit_vnd),
    vatTaxId: u.vat_tax_id ? String(u.vat_tax_id) : null,
    preferredLocale: u.preferred_locale === 'vi' ? 'vi' : 'en',
    preferredCurrency: 'VND',
    phone: u.phone ? String(u.phone) : null,
  };
}

beforeAll(async () => {
  tempDir = mkdtempSync(join(tmpdir(), 'vietnomad-host-test-'));
  uploadsDir = mkdtempSync(join(tmpdir(), 'vietnomad-uploads-test-'));
  process.env.PGLITE_DATA_DIR = tempDir;
  process.env.VIETNOMAD_DATA_DIR = tempDir;
  process.env.LOCAL_UPLOADS_DIR = uploadsDir;
  process.env.DATABASE_URL = '';
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  await closeDb();
  await ensureDbReady();
});

afterAll(async () => {
  await closeDb();
  rmSync(tempDir, { recursive: true, force: true });
  rmSync(uploadsDir, { recursive: true, force: true });
});

describe('Host Media Storage & Full Stay/Room Editor', () => {
  it('validates image magic bytes, blocks traversal, and supports local upload lifecycle', async () => {
    await expect(
      uploadStayMediaBuffer({
        stayId: 'stay-1',
        buffer: Buffer.from('<script>alert(1)</script>'),
      })
    ).rejects.toThrow(/JPEG, PNG, and WebP/i);

    expect(normalizeSafeUploadSegments(['..', 'etc', 'passwd'])).toBeNull();

    const uploaded = await uploadStayMediaBuffer({
      stayId: '00000000-0000-0000-0000-000000000001',
      buffer: SAMPLE_PNG,
      originalName: 'desk.png',
    });
    expect(uploaded.storageMode).toBe('local');
    expect(uploaded.url).toMatch(/^\/api\/uploads\/stays\/00000000-0000-0000-0000-000000000001\/.+\.png$/);

    const segments = uploaded.objectPath.split('/');
    const loaded = await readLocalUploadFile(segments);
    expect(loaded).not.toBeNull();
    expect(loaded!.contentType).toBe('image/png');
    expect(loaded!.buffer.equals(SAMPLE_PNG)).toBe(true);

    await deleteStayUploadedMedia('00000000-0000-0000-0000-000000000001', uploaded.url);
    expect(await readLocalUploadFile(segments)).toBeNull();
  });

  it('attaches uploaded media to stay gallery/hero/workspace and blocks unauthorized users', async () => {
    const host = await fetchUser('host@vietnomad.demo');
    const nomad = await fetchUser('nomad@vietnomad.demo');
    const hostData = await getHostConsoleData(host);
    const targetStay = hostData.stays[0]!;

    const uploaded = await uploadStayMediaBuffer({
      stayId: targetStay.id,
      buffer: SAMPLE_PNG,
    });

    await expect(
      attachMediaToStay(nomad, targetStay.id, { url: uploaded.url, role: 'hero' })
    ).rejects.toThrow(/do not own/i);

    await attachMediaToStay(host, targetStay.id, { url: uploaded.url, role: 'hero' });
    const afterAttach = await getHostConsoleData(host);
    const updatedStay = afterAttach.stays.find((s) => s.id === targetStay.id)!;
    expect(updatedStay.heroImage).toBe(uploaded.url);
    expect(updatedStay.galleryImages[0]).toBe(uploaded.url);

    await removeMediaFromStay(host, targetStay.id, uploaded.url);
    const afterRemove = await getHostConsoleData(host);
    const revertedStay = afterRemove.stays.find((s) => s.id === targetStay.id)!;
    expect(revertedStay.galleryImages).not.toContain(uploaded.url);
    expect(revertedStay.heroImage).not.toBe(uploaded.url);
  });

  it('updates full stay details, amenities, and nearby coworking safely', async () => {
    const host = await fetchUser('host@vietnomad.demo');
    const hostData = await getHostConsoleData(host);
    const stay = hostData.stays[0]!;

    await updateHostStayConfiguration(host, stay.id, {
      titleEn: `${stay.titleEn} Studio Edition`,
      hasExternalMonitor: true,
      petFriendly: true,
      amenities: ['Fiber 450 Mbps', 'Standing desk', 'Espresso bar'],
      nearbyCoworking: [{ name: 'Enouvo Space', distance: '4 min walk' }],
    });

    const detail = await getStayDetailBySlug(stay.slug);
    expect(detail!.titleEn).toContain('Studio Edition');
    expect(detail!.hasExternalMonitor).toBe(true);
    expect(detail!.petFriendly).toBe(true);
    expect(detail!.amenities).toContain('Espresso bar');
    expect(detail!.nearbyCoworking[0]?.name).toBe('Enouvo Space');
  });

  it('creates, updates, and safely guards deletion of rooms', async () => {
    const host = await fetchUser('host@vietnomad.demo');
    const nomad = await fetchUser('nomad@vietnomad.demo');
    const hostData = await getHostConsoleData(host);
    const stay = hostData.stays[0]!;

    // Cannot delete the last remaining room of a stay
    if (stay.rooms.length === 1) {
      await expect(
        deleteHostStayRoom(host, stay.id, stay.rooms[0]!.id)
      ).rejects.toThrow(/at least one active room/i);
    }

    const created = await createHostStayRoom(host, stay.id, {
      nameEn: 'Penthouse Work Loft',
      nameVi: 'Căn hộ áp mái có góc làm việc',
      descriptionEn: 'Top-floor private loft with dual monitor stand.',
      maxGuests: 3,
      bedsCount: 2,
      unitsTotal: 2,
      wholesale7Vnd: 7_200_000,
      wholesale30Vnd: 25_000_000,
    });

    await updateHostStayRoom(host, stay.id, created.roomId, {
      nameEn: 'Penthouse Work Loft Deluxe',
      unitsTotal: 3,
      wholesale30Vnd: 26_000_000,
    });

    const detailAfterCreate = await getStayDetailBySlug(stay.slug);
    const createdRoom = detailAfterCreate!.rooms.find((r) => r.id === created.roomId);
    expect(createdRoom).toBeDefined();
    expect(createdRoom!.nameEn).toBe('Penthouse Work Loft Deluxe');
    expect(createdRoom!.unitsTotal).toBe(3);

    // Book this newly created room, then verify deletion is blocked
    await createStayBooking(nomad, {
      stayId: stay.id,
      roomId: created.roomId,
      packageId: created.packageId,
      checkIn: '2027-08-10',
      nights: 7,
      guestsCount: 1,
      checkoutMode: 'intent',
    });

    await expect(
      deleteHostStayRoom(host, stay.id, created.roomId)
    ).rejects.toThrow(/active or historical bookings/i);

    // Create another unbooked room and verify clean deletion works
    const tempRoom = await createHostStayRoom(host, stay.id, {
      nameEn: 'Temp Studio',
      descriptionEn: 'Temporary room category.',
      maxGuests: 1,
      bedsCount: 1,
      unitsTotal: 1,
    });
    const delOut = await deleteHostStayRoom(host, stay.id, tempRoom.roomId);
    expect(delOut.ok).toBe(true);
  });
});
