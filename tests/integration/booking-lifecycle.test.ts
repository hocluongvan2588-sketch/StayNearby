import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeDb, dbQuery } from '@/lib/db';
import { runMigrations } from '@/lib/db/migrate';
import { runSeed, SEED_IDS } from '@/lib/db/seed-data';
import { loadSessionUserById } from '@/lib/auth/session';
import { addDaysIso, getTodayIsoInTimezone } from '@/lib/format';
import { calculateStayQuote } from '@/modules/pricing';
import { searchPublishedStays } from '@/modules/catalog';
import {
  cancelConfirmedBooking,
  confirmBookingRequest,
  createBookingRequest,
  getBookingDetail,
  withdrawBookingRequest,
} from '@/modules/bookings';
import { setHostNightlyRates, blockHostDates } from '@/modules/host';

describe('End-to-end booking lifecycle, PRICE_CHANGED, idempotency, expiry & cancellation', () => {
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

  it('detects PRICE_CHANGED, preserves submitted snapshot when host later updates price, and deduplicates idempotency keys', async () => {
    const guest = await loadSessionUserById(SEED_IDS.users.guest);
    const host1 = await loadSessionUserById(SEED_IDS.users.host1);

    const checkIn = addDaysIso(todayVn, 30);
    const checkOut = addDaysIso(todayVn, 33);

    // 1. Guest gets quote
    const initialQuote = await calculateStayQuote({
      listingId: SEED_IDS.listings.tayHoStudio,
      checkIn,
      checkOut,
      guestsCount: 1,
    });

    // 2. Host overrides nightly rate for [today+30, today+32) before guest submits
    await setHostNightlyRates(host1, SEED_IDS.listings.tayHoStudio, {
      startDate: checkIn,
      endDate: addDaysIso(todayVn, 32),
      nightlyRateVnd: 1200000,
    });

    // 3. Guest submits with stale expectedQuoteHash -> MUST reject with PRICE_CHANGED + updatedQuote
    let caughtCode = '';
    let updatedHash = '';
    let updatedTotal = 0;
    try {
      await createBookingRequest(guest, {
        listingId: SEED_IDS.listings.tayHoStudio,
        checkIn,
        checkOut,
        guestsCount: 1,
        idempotencyKey: 'idem-price-change-1',
        expectedQuoteHash: initialQuote.quoteHash,
        guestNote: 'Working remotely',
      });
    } catch (err: unknown) {
      const e = err as { code?: string; details?: { updatedQuote?: { quoteHash: string; totalVnd: number } } };
      caughtCode = e.code ?? '';
      updatedHash = e.details?.updatedQuote?.quoteHash ?? '';
      updatedTotal = e.details?.updatedQuote?.totalVnd ?? 0;
    }
    expect(caughtCode).toBe('PRICE_CHANGED');
    // 2 * 1,200,000 + 1 * 980,000 + 180,000 cleaning = 3,560,000 VND
    expect(updatedTotal).toBe(3560000);

    // 4. Guest confirms updated price & submits with same idempotencyKey
    const created = await createBookingRequest(guest, {
      listingId: SEED_IDS.listings.tayHoStudio,
      checkIn,
      checkOut,
      guestsCount: 1,
      idempotencyKey: 'idem-price-change-1',
      expectedQuoteHash: updatedHash,
      guestNote: 'Working remotely',
    });
    expect(created.deduplicated).toBe(false);
    expect(created.booking.status).toBe('pending');
    expect(created.booking.totalVnd).toBe(3560000);
    // Address MUST remain masked while pending
    expect(created.booking.exactAddress).toBeNull();

    // 5. Repeat submission with same idempotencyKey & same payload -> returns existing booking
    const repeated = await createBookingRequest(guest, {
      listingId: SEED_IDS.listings.tayHoStudio,
      checkIn,
      checkOut,
      guestsCount: 1,
      idempotencyKey: 'idem-price-change-1',
      expectedQuoteHash: updatedHash,
      guestNote: 'Working remotely',
    });
    expect(repeated.deduplicated).toBe(true);
    expect(repeated.booking.id).toBe(created.booking.id);

    // 6. Same idempotencyKey with different payload -> rejected!
    await expect(
      createBookingRequest(guest, {
        listingId: SEED_IDS.listings.tayHoStudio,
        checkIn,
        checkOut,
        guestsCount: 2,
        idempotencyKey: 'idem-price-change-1',
        expectedQuoteHash: updatedHash,
      })
    ).rejects.toThrow(/idempotency key/i);

    // 7. Host raises nightly rates AFTER booking submitted -> existing booking snapshot stays 3,560,000!
    await setHostNightlyRates(host1, SEED_IDS.listings.tayHoStudio, {
      startDate: checkIn,
      endDate: checkOut,
      nightlyRateVnd: 2500000,
    });
    const detailAfterRateChange = await getBookingDetail(guest, created.booking.id);
    expect(detailAfterRateChange.totalVnd).toBe(3560000);

    // 8. Host confirms booking -> unlocks exactAddress and locks 3 nights
    const confirmed = await confirmBookingRequest(
      host1,
      created.booking.id,
      'Welcome!'
    );
    expect(confirmed.status).toBe('confirmed');

    const guestView = await getBookingDetail(guest, created.booking.id);
    expect(guestView.exactAddress).toContain('19/62 Xuân Diệu');
    expect(guestView.checkinInstructionsEn).toContain('lockbox');

    // 9. Same-day turnover [today+33, today+35) MUST remain available and confirmable!
    const turnoverCheckIn = checkOut;
    const turnoverCheckOut = addDaysIso(todayVn, 35);
    const turnoverSearch = await searchPublishedStays({
      area: 'tay-ho-hanoi',
      checkIn: turnoverCheckIn,
      checkOut: turnoverCheckOut,
      guests: 1,
    });
    expect(
      turnoverSearch.items.some((i) => i.id === SEED_IDS.listings.tayHoStudio)
    ).toBe(true);

    const turnoverQuote = await calculateStayQuote({
      listingId: SEED_IDS.listings.tayHoStudio,
      checkIn: turnoverCheckIn,
      checkOut: turnoverCheckOut,
      guestsCount: 1,
    });
    const turnoverReq = await createBookingRequest(guest, {
      listingId: SEED_IDS.listings.tayHoStudio,
      checkIn: turnoverCheckIn,
      checkOut: turnoverCheckOut,
      guestsCount: 1,
      idempotencyKey: 'idem-turnover-2',
      expectedQuoteHash: turnoverQuote.quoteHash,
    });
    const turnoverConfirmed = await confirmBookingRequest(
      host1,
      turnoverReq.booking.id
    );
    expect(turnoverConfirmed.status).toBe('confirmed');

    // 10. Host blocks [today+36, today+37)
    await blockHostDates(host1, SEED_IDS.listings.tayHoStudio, {
      startDate: addDaysIso(todayVn, 36),
      endDate: addDaysIso(todayVn, 37),
      reason: 'Maintenance',
    });

    // 11. Guest cancels booking 1 -> releases ONLY [today+30, today+33), leaving turnover booking & host_block intact!
    const cancelled = await cancelConfirmedBooking(
      guest,
      created.booking.id,
      'Flight changed'
    );
    expect(cancelled.status).toBe('cancelled');

    const occupancyLeft = await dbQuery<{ night_date: string; source_type: string }>(
      `SELECT night_date::text AS night_date, source_type
       FROM occupancy_nights
       WHERE listing_id = $1
         AND night_date >= $2::date
         AND night_date < $3::date
       ORDER BY night_date ASC`,
      [SEED_IDS.listings.tayHoStudio, checkIn, addDaysIso(todayVn, 37)]
    );
    expect(occupancyLeft.rows).toEqual([
      { night_date: addDaysIso(todayVn, 33), source_type: 'booking' },
      { night_date: addDaysIso(todayVn, 34), source_type: 'booking' },
      { night_date: addDaysIso(todayVn, 36), source_type: 'host_block' },
    ]);
  });

  it('prevents confirming an expired booking request and supports guest withdrawal', async () => {
    const guest = await loadSessionUserById(SEED_IDS.users.guest);
    const host1 = await loadSessionUserById(SEED_IDS.users.host1);

    const checkIn = addDaysIso(todayVn, 45);
    const checkOut = addDaysIso(todayVn, 47);

    const quote = await calculateStayQuote({
      listingId: SEED_IDS.listings.tayHoLoft,
      checkIn,
      checkOut,
      guestsCount: 1,
    });

    const b1 = await createBookingRequest(guest, {
      listingId: SEED_IDS.listings.tayHoLoft,
      checkIn,
      checkOut,
      guestsCount: 1,
      idempotencyKey: 'idem-expiry-test',
      expectedQuoteHash: quote.quoteHash,
    });

    // Force expires_at into the past
    await dbQuery(
      `UPDATE bookings SET expires_at = NOW() - INTERVAL '1 hour' WHERE id = $1`,
      [b1.booking.id]
    );

    await expect(confirmBookingRequest(host1, b1.booking.id)).rejects.toThrow(
      /deadline|expired/i
    );

    const b2 = await createBookingRequest(guest, {
      listingId: SEED_IDS.listings.tayHoLoft,
      checkIn,
      checkOut,
      guestsCount: 1,
      idempotencyKey: 'idem-withdraw-test',
      expectedQuoteHash: quote.quoteHash,
    });
    const withdrawn = await withdrawBookingRequest(guest, b2.booking.id, 'Changed plans');
    expect(withdrawn.status).toBe('withdrawn');
  });
});
