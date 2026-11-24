import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeDb } from '@/lib/db';
import { runMigrations } from '@/lib/db/migrate';
import { runSeed, SEED_IDS } from '@/lib/db/seed-data';
import { loadSessionUserById } from '@/lib/auth/session';
import { requireRole } from '@/lib/auth/rbac';
import { validatePhotoUpload } from '@/lib/storage/photos';
import { getPublishedStayBySlug } from '@/modules/catalog';
import { getGuestTrips } from '@/modules/bookings';
import { getHostDashboardListings, getHostListingById } from '@/modules/host';
import { getAdminListingQueue } from '@/modules/admin';

describe('Server RBAC, ownership boundaries, and private check-in protection', () => {
  beforeAll(async () => {
    process.env.DATABASE_URL = '';
    process.env.PGLITE_DATA_DIR = 'memory://';
    await runMigrations();
    await runSeed();
  });

  afterAll(async () => {
    await closeDb();
  });

  it('strips exact_address, checkin_instructions, and omits any Wi-Fi speed metrics from public projections', async () => {
    const stay = await getPublishedStayBySlug('tay-ho-sunlit-lake-loft');
    expect(stay).not.toBeNull();
    const serialized = JSON.stringify(stay);
    expect(serialized).not.toContain('48 Quảng Khánh');
    expect(serialized).not.toContain('#4820');
    expect(serialized).not.toContain('wifiMbps');
    expect(serialized).not.toContain('Mbps');
    expect(stay?.areaVibeEn).toBeTruthy();
    expect(stay?.titleVi).toBeTruthy();
    expect(stay?.lateCheckinAvailable).toBe(true);
  });

  it('reveals exact address to guest ONLY on confirmed trips, never on pending trips', async () => {
    const guest = await loadSessionUserById(SEED_IDS.users.guest);
    const trips = await getGuestTrips(guest);

    const confirmedTrip = trips.find((t) => t.status === 'confirmed');
    const pendingTrip = trips.find((t) => t.status === 'pending');

    expect(confirmedTrip).toBeDefined();
    expect(confirmedTrip?.exactAddress).toContain('32 An Thượng 4');
    expect(confirmedTrip?.checkinInstructionsEn).toContain('602');
    expect(confirmedTrip?.checkinInstructionsVi).toContain('602');

    expect(pendingTrip).toBeDefined();
    expect(pendingTrip?.exactAddress).toBeNull();
    expect(pendingTrip?.checkinInstructionsEn).toBeNull();
    expect(pendingTrip?.checkinInstructionsVi).toBeNull();
  });

  it('enforces host ownership and denies cross-host or guest-only access', async () => {
    const guest = await loadSessionUserById(SEED_IDS.users.guest);
    const host1 = await loadSessionUserById(SEED_IDS.users.host1);
    const host2 = await loadSessionUserById(SEED_IDS.users.host2);

    expect(() => requireRole(guest, 'host')).toThrow(/role/i);
    await expect(getHostDashboardListings(guest)).rejects.toThrow();

    // Host 1 also holds guest role (multi-role account) and sees only Host 1 listings
    expect(host1?.roles).toEqual(expect.arrayContaining(['guest', 'host']));
    const host1Listings = await getHostDashboardListings(host1);
    expect(host1Listings.some((l) => l.id === SEED_IDS.listings.tayHoPending)).toBe(true);
    expect(host1Listings.some((l) => l.id === SEED_IDS.listings.camChauDraft)).toBe(false);

    // Host 1 cannot fetch Host 2's draft listing
    await expect(
      getHostListingById(host1, SEED_IDS.listings.camChauDraft)
    ).rejects.toThrow(/permission/i);

    // Host 2 CAN fetch Host 2's draft listing
    const ownDraft = await getHostListingById(host2, SEED_IDS.listings.camChauDraft);
    expect(ownDraft.photoCount).toBe(0);
  });

  it('restricts admin listing queue strictly to admin role', async () => {
    const host1 = await loadSessionUserById(SEED_IDS.users.host1);
    const admin = await loadSessionUserById(SEED_IDS.users.admin);

    await expect(getAdminListingQueue(host1)).rejects.toThrow(/role/i);
    const queue = await getAdminListingQueue(admin);
    expect(queue.length).toBe(8);
    expect(queue[0].status).toBe('pending_review');
  });

  it('validates photo upload ownership, MIME type, byte limit, and max count on server', async () => {
    const host1 = await loadSessionUserById(SEED_IDS.users.host1);
    const host2 = await loadSessionUserById(SEED_IDS.users.host2);

    // Ownership denied
    expect(() =>
      validatePhotoUpload({
        actor: host1,
        listingId: SEED_IDS.listings.camChauDraft,
        listingHostId: SEED_IDS.users.host2,
        existingPhotoCount: 0,
        mimeType: 'image/jpeg',
        sizeBytes: 1024,
        isDraft: true,
      })
    ).toThrow(/permission/i);

    // Disallowed MIME
    expect(() =>
      validatePhotoUpload({
        actor: host2,
        listingId: SEED_IDS.listings.camChauDraft,
        listingHostId: SEED_IDS.users.host2,
        existingPhotoCount: 0,
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        isDraft: true,
      })
    ).toThrow(/Unsupported image format/i);

    // Oversized image
    expect(() =>
      validatePhotoUpload({
        actor: host2,
        listingId: SEED_IDS.listings.camChauDraft,
        listingHostId: SEED_IDS.users.host2,
        existingPhotoCount: 0,
        mimeType: 'image/png',
        sizeBytes: 10 * 1024 * 1024,
        isDraft: true,
      })
    ).toThrow(/Image size/i);

    // Max count exceeded
    expect(() =>
      validatePhotoUpload({
        actor: host2,
        listingId: SEED_IDS.listings.camChauDraft,
        listingHostId: SEED_IDS.users.host2,
        existingPhotoCount: 12,
        mimeType: 'image/webp',
        sizeBytes: 500_000,
        isDraft: true,
      })
    ).toThrow(/at most 12 photos/i);

    // Valid draft upload stores inside drafts/ folder
    const valid = validatePhotoUpload({
      actor: host2,
      listingId: SEED_IDS.listings.camChauDraft,
      listingHostId: SEED_IDS.users.host2,
      existingPhotoCount: 2,
      mimeType: 'image/jpeg',
      sizeBytes: 350_000,
      isDraft: true,
    });
    expect(valid.storagePath).toMatch(
      /^listings\/drafts\/33333333-3333-4333-8333-333333333308\/.*\.jpg$/
    );
  });
});
