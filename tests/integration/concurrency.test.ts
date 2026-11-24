import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeDb, dbQuery } from '@/lib/db';
import { runMigrations } from '@/lib/db/migrate';
import { runSeed, SEED_IDS } from '@/lib/db/seed-data';
import { loadSessionUserById } from '@/lib/auth/session';
import { addDaysIso, getTodayIsoInTimezone } from '@/lib/format';
import { calculateStayQuote } from '@/modules/pricing';
import { confirmBookingRequest, createBookingRequest } from '@/modules/bookings';
import { blockHostDates } from '@/modules/host';

describe('Concurrency & atomic night locking guarantees', () => {
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

  it('allows exactly ONE confirmation when two overlapping pending requests are confirmed concurrently', async () => {
    const guest = await loadSessionUserById(SEED_IDS.users.guest);
    const host1 = await loadSessionUserById(SEED_IDS.users.host1);
    const host2 = await loadSessionUserById(SEED_IDS.users.host2);

    // Overlapping intervals on tayHoLoft: [today+60, today+63) and [today+61, today+64)
    const ci1 = addDaysIso(todayVn, 60);
    const co1 = addDaysIso(todayVn, 63);
    const ci2 = addDaysIso(todayVn, 61);
    const co2 = addDaysIso(todayVn, 64);

    const [q1, q2] = await Promise.all([
      calculateStayQuote({
        listingId: SEED_IDS.listings.tayHoLoft,
        checkIn: ci1,
        checkOut: co1,
        guestsCount: 1,
      }),
      calculateStayQuote({
        listingId: SEED_IDS.listings.tayHoLoft,
        checkIn: ci2,
        checkOut: co2,
        guestsCount: 1,
      }),
    ]);

    const r1 = await createBookingRequest(guest, {
      listingId: SEED_IDS.listings.tayHoLoft,
      checkIn: ci1,
      checkOut: co1,
      guestsCount: 1,
      idempotencyKey: 'concurrent-req-1',
      expectedQuoteHash: q1.quoteHash,
    });
    const r2 = await createBookingRequest(host2, {
      listingId: SEED_IDS.listings.tayHoLoft,
      checkIn: ci2,
      checkOut: co2,
      guestsCount: 1,
      idempotencyKey: 'concurrent-req-2',
      expectedQuoteHash: q2.quoteHash,
    });

    const outcomes = await Promise.allSettled([
      confirmBookingRequest(host1, r1.booking.id),
      confirmBookingRequest(host1, r2.booking.id),
    ]);

    const fulfilled = outcomes.filter((o) => o.status === 'fulfilled');
    const rejected = outcomes.filter((o) => o.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({
      code: 'DATES_UNAVAILABLE',
    });

    // Verify zero partial locks: occupancy_nights must have exactly 3 nights belonging ONLY to winner
    const winnerId =
      fulfilled[0].status === 'fulfilled' ? fulfilled[0].value.id : '';
    const loserId = winnerId === r1.booking.id ? r2.booking.id : r1.booking.id;

    const lockedRes = await dbQuery<{
      night_date: string;
      booking_id: string | null;
    }>(
      `SELECT night_date::text AS night_date, booking_id
       FROM occupancy_nights
       WHERE listing_id = $1
         AND night_date >= $2::date
         AND night_date < $3::date
       ORDER BY night_date ASC`,
      [SEED_IDS.listings.tayHoLoft, ci1, co2]
    );
    expect(lockedRes.rows).toHaveLength(3);
    expect(lockedRes.rows.every((row) => row.booking_id === winnerId)).toBe(true);

    // Losing booking remains 'pending'
    const loserRow = await dbQuery<{ status: string }>(
      `SELECT status FROM bookings WHERE id = $1`,
      [loserId]
    );
    expect(loserRow.rows[0].status).toBe('pending');
  });

  it('allows exactly ONE operation to claim nights when host block and booking confirmation race concurrently', async () => {
    const guest = await loadSessionUserById(SEED_IDS.users.guest);
    const host1 = await loadSessionUserById(SEED_IDS.users.host1);

    const ci = addDaysIso(todayVn, 70);
    const co = addDaysIso(todayVn, 73);
    const quote = await calculateStayQuote({
      listingId: SEED_IDS.listings.tayHoLoft,
      checkIn: ci,
      checkOut: co,
      guestsCount: 1,
    });
    const req = await createBookingRequest(guest, {
      listingId: SEED_IDS.listings.tayHoLoft,
      checkIn: ci,
      checkOut: co,
      guestsCount: 1,
      idempotencyKey: 'race-host-block-vs-confirm',
      expectedQuoteHash: quote.quoteHash,
    });

    // Race host blocking [today+71, today+72) vs host confirming [today+70, today+73)
    const outcomes = await Promise.allSettled([
      blockHostDates(host1, SEED_IDS.listings.tayHoLoft, {
        startDate: addDaysIso(todayVn, 71),
        endDate: addDaysIso(todayVn, 72),
        reason: 'Concurrent block',
      }),
      confirmBookingRequest(host1, req.booking.id),
    ]);

    const fulfilled = outcomes.filter((o) => o.status === 'fulfilled');
    const rejected = outcomes.filter((o) => o.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({
      code: 'DATES_UNAVAILABLE',
    });

    const nightsRes = await dbQuery<{ source_type: string; booking_id: string | null }>(
      `SELECT source_type, booking_id
       FROM occupancy_nights
       WHERE listing_id = $1
         AND night_date >= $2::date
         AND night_date < $3::date`,
      [SEED_IDS.listings.tayHoLoft, ci, co]
    );
    const sources = new Set(nightsRes.rows.map((r) => r.source_type));
    // Must never mix partial host_block with partial booking nights!
    expect(sources.size).toBe(1);
  });
});
