import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeDb } from '@/lib/db';
import { runMigrations } from '@/lib/db/migrate';
import { runSeed, SEED_IDS } from '@/lib/db/seed-data';
import { loadSessionUserById } from '@/lib/auth/session';
import { getAdminCrmDashboard, updateAdminCrmProfile } from '@/modules/crm';
import { getHostGuestsCrm } from '@/modules/host';
import { confirmBookingRequest, createBookingRequest } from '@/modules/bookings';
import { addDaysIso, getTodayIsoInTimezone } from '@/lib/format';
import { calculateStayQuote } from '@/modules/pricing';

describe('Admin CRM, Host Guests CRM, and RBAC privacy guarantees', () => {
  beforeAll(async () => {
    process.env.DATABASE_URL = '';
    process.env.PGLITE_DATA_DIR = 'memory://';
    await runMigrations();
    await runSeed();
  });

  afterAll(async () => {
    await closeDb();
  });

  it('enforces admin-only RBAC for CRM dashboard and updates', async () => {
    const guest = await loadSessionUserById(SEED_IDS.users.guest);
    const host = await loadSessionUserById(SEED_IDS.users.host1);

    await expect(getAdminCrmDashboard(null)).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
    await expect(getAdminCrmDashboard(guest)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(getAdminCrmDashboard(host)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(
      updateAdminCrmProfile(host, SEED_IDS.users.guest, {
        crmStage: 'vip',
        crmNote: 'Unauthorized update',
      })
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('returns segmented contacts, metrics, and persists CRM updates for admin', async () => {
    const admin = await loadSessionUserById(SEED_IDS.users.admin);

    const dashboard = await getAdminCrmDashboard(admin);
    expect(dashboard.summary.totalContacts).toBe(4);
    expect(dashboard.summary.guestsCount).toBeGreaterThanOrEqual(2);
    expect(dashboard.summary.hostsCount).toBe(2);
    expect(dashboard.summary.confirmedGmvVnd).toBeGreaterThan(0);

    const updated = await updateAdminCrmProfile(admin, SEED_IDS.users.guest, {
      crmStage: 'follow_up',
      crmNote: 'Ưu tiên gửi gợi ý căn hộ An Thượng tháng tới.',
    });
    expect(updated.crmStage).toBe('follow_up');
    expect(updated.crmNote).toBe('Ưu tiên gửi gợi ý căn hộ An Thượng tháng tới.');

    const filtered = await getAdminCrmDashboard(admin, {
      role: 'guest',
      stage: 'follow_up',
      q: 'Mercer',
    });
    expect(filtered.contacts).toHaveLength(1);
    expect(filtered.contacts[0].id).toBe(SEED_IDS.users.guest);
  });

  it('scopes host guest list strictly to own listings and hides contact details until confirmed', async () => {
    const guest = await loadSessionUserById(SEED_IDS.users.guest);
    const host1 = await loadSessionUserById(SEED_IDS.users.host1);
    const host2 = await loadSessionUserById(SEED_IDS.users.host2);

    await expect(getHostGuestsCrm(null)).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
    await expect(getHostGuestsCrm(guest)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });

    // Host 1 already has seeded confirmed + completed bookings from guest
    const host1Guests = await getHostGuestsCrm(host1);
    expect(host1Guests.length).toBeGreaterThanOrEqual(1);
    const mercerOnHost1 = host1Guests.find((g) => g.guestId === SEED_IDS.users.guest);
    expect(mercerOnHost1).toBeDefined();
    expect(mercerOnHost1?.email).toBe('guest@workinghome.demo');

    // Host 2 has NO bookings yet
    const host2GuestsBefore = await getHostGuestsCrm(host2);
    expect(host2GuestsBefore).toHaveLength(0);

    // Create a PENDING booking on Host 2's Cam Chau villa (host2 owns camChauVilla)
    const today = getTodayIsoInTimezone('Asia/Ho_Chi_Minh');
    const checkIn = addDaysIso(today, 30);
    const checkOut = addDaysIso(today, 33);
    const quote = await calculateStayQuote({
      listingId: SEED_IDS.listings.camChauVilla,
      checkIn,
      checkOut,
      guestsCount: 2,
    });

    const created = await createBookingRequest(guest, {
      listingId: SEED_IDS.listings.camChauVilla,
      checkIn,
      checkOut,
      guestsCount: 2,
      idempotencyKey: 'crm-pending-privacy-test-001',
      expectedQuoteHash: quote.quoteHash,
      guestNote: 'Cần bàn làm việc yên tĩnh',
    });

    // Before confirmation: Host 2 sees guest name & booking summary, but email/phone remain null
    const host2Pending = await getHostGuestsCrm(host2);
    expect(host2Pending).toHaveLength(1);
    expect(host2Pending[0].displayName).toBe('Alex Mercer');
    expect(host2Pending[0].email).toBeNull();
    expect(host2Pending[0].phone).toBeNull();
    expect(host2Pending[0].pendingCount).toBe(1);

    // Confirm booking -> email/phone unlock for Host 2
    await confirmBookingRequest(host2, created.booking.id, 'Chào mừng bạn!');
    const host2Confirmed = await getHostGuestsCrm(host2);
    expect(host2Confirmed).toHaveLength(1);
    expect(host2Confirmed[0].email).toBe('guest@workinghome.demo');
    expect(host2Confirmed[0].confirmedOrCompletedCount).toBe(1);
    expect(host2Confirmed[0].totalRevenueVnd).toBe(quote.totalVnd);
  });
});
