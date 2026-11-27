import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SessionUser } from '@/lib/auth/session';
import { closeDb, dbQuery, ensureDbReady } from '@/lib/db';
import { searchStays } from '@/modules/catalog';
import {
  createDraftStay,
  submitHostStayForReview,
  updateHostStayConfiguration,
} from '@/modules/host';
import { updateAdminStayStatus } from '@/modules/admin';
import { moderateListing } from '@/modules/admin-bos';
import { getAdminActorContext } from '@/modules/admin-rbac';

let tempDir: string;

async function fetchSessionUserByEmail(email: string): Promise<SessionUser> {
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
    preferredCurrency: 'USD',
    phone: u.phone ? String(u.phone) : null,
  };
}

async function createUser(email: string, role: 'host' | 'admin'): Promise<SessionUser> {
  await dbQuery(
    `INSERT INTO users (id, email, password_hash, full_name, role, nationality, phone)
     VALUES ($1, $2, 'test-hash', $3, $4, 'VN', NULL)
     ON CONFLICT (email) DO NOTHING`,
    [crypto.randomUUID(), email, role === 'admin' ? 'Test Admin' : 'Test Host', role]
  );
  return fetchSessionUserByEmail(email);
}

async function getStatus(stayId: string): Promise<string> {
  const res = await dbQuery<{ status: string }>('SELECT status FROM stays WHERE id = $1', [
    stayId,
  ]);
  return String(res.rows[0]?.status);
}

beforeAll(async () => {
  tempDir = mkdtempSync(join(tmpdir(), 'vietnomad-lifecycle-'));
  process.env.PGLITE_DATA_DIR = tempDir;
  process.env.VIETNOMAD_DATA_DIR = tempDir;
  process.env.DATABASE_URL = '';
  await closeDb();
  await ensureDbReady();
});

afterAll(async () => {
  await closeDb();
  rmSync(tempDir, { recursive: true, force: true });
});

describe('Listing lifecycle: draft → pending_review → live (one data architecture)', () => {
  it('createDraftStay creates a draft stay with Listing ID, room and package', async () => {
    const host = await createUser('lifecycle-host-1@test.local', 'host');
    const stay = await createDraftStay(host, { titleEn: 'Han River Sunlit Studio' });

    expect(stay.status).toBe('draft');
    expect(stay.slug).toContain('han-river-sunlit-studio');

    const row = await dbQuery<{ status: string; destination_id: string; title_en: string }>(
      'SELECT status, destination_id, title_en FROM stays WHERE id = $1',
      [stay.id]
    );
    expect(row.rows[0]?.status).toBe('draft');
    expect(row.rows[0]?.destination_id).toBeTruthy();
    expect(row.rows[0]?.title_en).toBe('Han River Sunlit Studio');

    const rooms = await dbQuery('SELECT id FROM stay_rooms WHERE stay_id = $1', [stay.id]);
    expect(rooms.rowCount).toBe(1);
    const pkgs = await dbQuery('SELECT id FROM stay_packages WHERE stay_id = $1', [stay.id]);
    expect(pkgs.rowCount).toBe(1);
  });

  it('draft stays are invisible to guest search until moderated live', async () => {
    const host = await createUser('lifecycle-host-2@test.local', 'host');
    const stay = await createDraftStay(host, { titleEn: 'Hidden Draft Listing' });

    const before = await searchStays({ sort: 'featured' });
    expect(before.some((s) => s.id === stay.id)).toBe(false);

    await submitHostStayForReview(host, stay.id);
    const admin = await createUser('lifecycle-admin-1@test.local', 'admin');
    await updateAdminStayStatus(admin, stay.id, 'live');

    const after = await searchStays({ sort: 'featured' });
    expect(after.some((s) => s.id === stay.id)).toBe(true);
  });

  it('host submit moves draft → pending_review with guards', async () => {
    const hostA = await createUser('lifecycle-host-a@test.local', 'host');
    const hostB = await createUser('lifecycle-host-b@test.local', 'host');
    const stay = await createDraftStay(hostA, {});

    // Non-owner cannot submit
    await expect(submitHostStayForReview(hostB, stay.id)).rejects.toThrow(/own this property/i);

    const out = await submitHostStayForReview(hostA, stay.id);
    expect(out.status).toBe('pending_review');
    expect(await getStatus(stay.id)).toBe('pending_review');

    // Double submit is rejected
    await expect(submitHostStayForReview(hostA, stay.id)).rejects.toThrow(
      /already pending review/i
    );

    // Missing titles block submission
    const stay2 = await createDraftStay(hostA, {});
    await dbQuery('UPDATE stays SET title_en = $1, title_vi = $2 WHERE id = $3', [
      '',
      '',
      stay2.id,
    ]);
    await expect(submitHostStayForReview(hostA, stay2.id)).rejects.toThrow(/titles/i);
  });

  it('admin cannot publish a draft directly — must wait for host submit', async () => {
    const host = await createUser('lifecycle-host-c@test.local', 'host');
    const admin = await createUser('lifecycle-admin-2@test.local', 'admin');
    const stay = await createDraftStay(host, {});

    // Direct draft → live is blocked (updateAdminStayStatus path)
    await expect(updateAdminStayStatus(admin, stay.id, 'live')).rejects.toThrow(
      /submitted for review/i
    );

    // Direct draft → live is blocked (Operations moderation path)
    const actor = await getAdminActorContext(admin);
    await expect(moderateListing(actor, stay.id, { status: 'live' })).rejects.toThrow(
      /submitted for review/i
    );
    expect(await getStatus(stay.id)).toBe('draft');

    // Host submits, then admin moderation publishes the SAME stay
    await submitHostStayForReview(host, stay.id);
    const out = await moderateListing(actor, stay.id, { status: 'live' });
    expect(out).toBeTruthy();
    expect(await getStatus(stay.id)).toBe('live');

    // Moderation log recorded for the transition
    const logs = await dbQuery(
      `SELECT from_status, to_status FROM listing_moderation_logs
       WHERE stay_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [stay.id]
    );
    expect(logs.rows[0]?.from_status).toBe('pending_review');
    expect(logs.rows[0]?.to_status).toBe('live');
  });

  it('host PATCH updates destination, Wi-Fi speed and content on the same stay', async () => {
    const host = await createUser('lifecycle-host-d@test.local', 'host');
    const stay = await createDraftStay(host, {});

    const dests = await dbQuery<{ id: string }>(
      'SELECT id FROM destinations ORDER BY name_en ASC LIMIT 2'
    );
    expect(dests.rowCount).toBeGreaterThanOrEqual(2);
    const currentDest = await dbQuery<{ destination_id: string }>(
      'SELECT destination_id FROM stays WHERE id = $1',
      [stay.id]
    );
    const otherDest = dests.rows
      .map((d) => d.id)
      .find((id) => id !== String(currentDest.rows[0]?.destination_id))!;

    await updateHostStayConfiguration(host, stay.id, {
      titleEn: 'Da Lat Work Loft',
      titleVi: 'Gác làm việc Đà Lạt',
      subtitleEn: 'Sunlit studio with fiber Wi-Fi',
      subtitleVi: 'Studio ánh sáng với cáp quang',
      descriptionEn: 'A bright studio for remote workers staying weekly or monthly in Vietnam.',
      descriptionVi: 'Studio ánh sáng cho người làm việc từ xa lưu trú theo tuần tại Việt Nam.',
      neighborhoodEn: 'City center',
      neighborhoodVi: 'Trung tâm thành phố',
      exactAddress: '12 Nguyen Van Binh, Da Lat',
      checkinInstructionsEn: 'Self check-in with the code sent after booking.',
      checkinInstructionsVi: 'Nhận phòng tự mã với mã gửi sau khi đặt.',
      destinationId: otherDest,
      wifiDownloadMbps: 350,
      defaultMinNights: 7,
    });

    const row = await dbQuery<{
      destination_id: string;
      wifi_download_mbps: number;
      wifi_upload_mbps: number;
      title_en: string;
      default_min_nights: number;
    }>(
      `SELECT destination_id, wifi_download_mbps, wifi_upload_mbps, title_en, default_min_nights
       FROM stays WHERE id = $1`,
      [stay.id]
    );
    const stayRow = row.rows[0]!;
    expect(stayRow.destination_id).toBe(otherDest);
    expect(Number(stayRow.wifi_download_mbps)).toBe(350);
    expect(Number(stayRow.wifi_upload_mbps)).toBe(263); // 350 * 0.75
    expect(stayRow.title_en).toBe('Da Lat Work Loft');
    expect(Number(stayRow.default_min_nights)).toBe(7);

    // Still a draft after editing — lifecycle unaffected by content saves
    expect(await getStatus(stay.id)).toBe('draft');
  });
});
