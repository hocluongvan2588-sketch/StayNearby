import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeDb } from '@/lib/db';
import { runMigrations } from '@/lib/db/migrate';
import { runSeed, SEED_IDS } from '@/lib/db/seed-data';
import { loadSessionUserById } from '@/lib/auth/session';
import { addDaysIso, getTodayIsoInTimezone } from '@/lib/format';
import {
  cancelConfirmedBooking,
  confirmBookingRequest,
  createBookingRequest,
  declineBookingRequest,
  getAllAdminBookings,
  getBookingDetail,
  withdrawBookingRequest,
} from '@/modules/bookings';
import {
  blockHostDates,
  getHostCalendarData,
  getHostListingDetail,
  submitHostListingForReview,
  updateHostListing,
} from '@/modules/host';
import {
  approveAdminListing,
  getAdminListingQueue,
  suspendAdminListing,
} from '@/modules/admin';
import { getAdminOpsSnapshot, retryFailedOutboxEvent } from '@/modules/ops';

async function captureErrorCode(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
    return 'NO_ERROR';
  } catch (err: unknown) {
    return (err as { code?: string }).code ?? 'UNKNOWN';
  }
}

describe('Phase 3 security, IDOR, validation & admin exception audit', () => {
  const todayVn = getTodayIsoInTimezone('Asia/Ho_Chi_Minh');

  beforeAll(async () => {
    process.env.DATABASE_URL = '';
    process.env.PGLITE_DATA_DIR = 'memory://';
    await runMigrations();
    await runSeed();
  });

  afterAll(async () => {
    await closeDb();
  });

  it('rejects malformed UUIDs with VALIDATION_ERROR instead of 500 database errors', async () => {
    const guest = await loadSessionUserById(SEED_IDS.users.guest);
    const host1 = await loadSessionUserById(SEED_IDS.users.host1);
    const admin = await loadSessionUserById(SEED_IDS.users.admin);

    expect(
      await captureErrorCode(() => getBookingDetail(guest, 'not-a-uuid'))
    ).toBe('VALIDATION_ERROR');

    expect(
      await captureErrorCode(() => confirmBookingRequest(host1, 'invalid-id'))
    ).toBe('VALIDATION_ERROR');

    expect(
      await captureErrorCode(() => getHostListingDetail(host1, 'bad-listing-id'))
    ).toBe('VALIDATION_ERROR');

    expect(
      await captureErrorCode(() => approveAdminListing(admin, 'bad-admin-id'))
    ).toBe('VALIDATION_ERROR');

    expect(
      await captureErrorCode(() => retryFailedOutboxEvent(admin, 'bad-outbox-id'))
    ).toBe('VALIDATION_ERROR');
  });

  it('prevents cross-tenant IDOR across guest, host, and admin portals', async () => {
    const guest = await loadSessionUserById(SEED_IDS.users.guest);
    const host1 = await loadSessionUserById(SEED_IDS.users.host1);
    const host2 = await loadSessionUserById(SEED_IDS.users.host2);
    const admin = await loadSessionUserById(SEED_IDS.users.admin);

    // Unauthenticated access is denied everywhere
    expect(
      await captureErrorCode(() =>
        getBookingDetail(null, SEED_IDS.bookings.confirmedSample)
      )
    ).toBe('UNAUTHORIZED');
    expect(
      await captureErrorCode(() => getAdminOpsSnapshot(null))
    ).toBe('UNAUTHORIZED');

    // Host2 (another host) cannot view or act on Guest's booking for Host1's listing
    expect(
      await captureErrorCode(() =>
        getBookingDetail(host2, SEED_IDS.bookings.confirmedSample)
      )
    ).toBe('FORBIDDEN');

    expect(
      await captureErrorCode(() =>
        confirmBookingRequest(host2, SEED_IDS.bookings.pendingSample)
      )
    ).toBe('FORBIDDEN');

    expect(
      await captureErrorCode(() =>
        declineBookingRequest(host2, SEED_IDS.bookings.pendingSample)
      )
    ).toBe('FORBIDDEN');

    // Host1 cannot withdraw or cancel Guest's booking
    expect(
      await captureErrorCode(() =>
        withdrawBookingRequest(host1, SEED_IDS.bookings.pendingSample)
      )
    ).toBe('FORBIDDEN');

    expect(
      await captureErrorCode(() =>
        cancelConfirmedBooking(host1, SEED_IDS.bookings.confirmedSample, 'trying to cancel')
      )
    ).toBe('FORBIDDEN');

    // Host2 cannot read, edit, block calendar, or submit Host1's listing
    expect(
      await captureErrorCode(() =>
        getHostListingDetail(host2, SEED_IDS.listings.tayHoLoft)
      )
    ).toBe('FORBIDDEN');

    expect(
      await captureErrorCode(() =>
        getHostCalendarData(host2, SEED_IDS.listings.tayHoLoft)
      )
    ).toBe('FORBIDDEN');

    expect(
      await captureErrorCode(() =>
        blockHostDates(host2, SEED_IDS.listings.tayHoLoft, {
          startDate: addDaysIso(todayVn, 90),
          endDate: addDaysIso(todayVn, 92),
        })
      )
    ).toBe('FORBIDDEN');

    expect(
      await captureErrorCode(() =>
        submitHostListingForReview(host2, SEED_IDS.listings.tayHoLoft)
      )
    ).toBe('FORBIDDEN');

    expect(
      await captureErrorCode(() =>
        updateHostListing(host2, SEED_IDS.listings.tayHoLoft, {
          areaId: SEED_IDS.areas.tayHo,
          propertyType: 'apartment',
          maxGuests: 2,
          bedrooms: 1,
          beds: 1,
          bathrooms: 1,
          minNights: 1,
          maxNights: 30,
          baseNightlyRateVnd: 1000000,
          cleaningFeeVnd: 0,
          titleEn: 'Hijacked',
          summaryEn: 'Hijacked summary',
          descriptionEn: 'Hijacked description text',
          houseRulesEn: [],
          hasDedicatedDesk: true,
          exactAddress: '123 Fake Street',
          checkinInstructionsEn: 'None',
        })
      )
    ).toBe('FORBIDDEN');

    // Guest and Host cannot invoke Admin endpoints
    expect(
      await captureErrorCode(() => getAdminListingQueue(guest))
    ).toBe('FORBIDDEN');
    expect(
      await captureErrorCode(() => getAllAdminBookings(host1))
    ).toBe('FORBIDDEN');
    expect(
      await captureErrorCode(() =>
        suspendAdminListing(host1, SEED_IDS.listings.tayHoLoft, 'bad')
      )
    ).toBe('FORBIDDEN');
    expect(
      await captureErrorCode(() => getAdminOpsSnapshot(host1))
    ).toBe('FORBIDDEN');
    expect(
      await captureErrorCode(() =>
        retryFailedOutboxEvent(guest, '99999999-9999-4999-8999-999999999901')
      )
    ).toBe('FORBIDDEN');

    // Admin exception cancellation requires a reason, and releases nights cleanly when provided
    const checkIn = addDaysIso(todayVn, 95);
    const checkOut = addDaysIso(todayVn, 98);
    const req = await createBookingRequest(guest, {
      listingId: SEED_IDS.listings.tayHoStudio,
      checkIn,
      checkOut,
      guestsCount: 1,
      idempotencyKey: 'admin-cancel-audit-1',
    });
    await confirmBookingRequest(host1, req.booking.id);

    expect(
      await captureErrorCode(() =>
        cancelConfirmedBooking(admin, req.booking.id, '   ')
      )
    ).toBe('VALIDATION_ERROR');

    const cancelled = await cancelConfirmedBooking(
      admin,
      req.booking.id,
      'Host emergency plumbing maintenance'
    );
    expect(cancelled.status).toBe('cancelled');
    expect(
      cancelled.events.some(
        (e) =>
          e.actorRole === 'admin' &&
          e.toStatus === 'cancelled' &&
          e.reason === 'Host emergency plumbing maintenance'
      )
    ).toBe(true);
  });
});
