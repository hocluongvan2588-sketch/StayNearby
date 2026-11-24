import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeDb, dbQuery } from '@/lib/db';
import { runMigrations } from '@/lib/db/migrate';
import { runSeed, SEED_IDS } from '@/lib/db/seed-data';
import { addDaysIso, getTodayIsoInTimezone } from '@/lib/format';
import { searchPublishedStays, getPublishedStayBySlug } from '@/modules/catalog';
import { calculateStayQuote } from '@/modules/pricing';

describe('Catalog search, availability boundaries, and integer VND pricing', () => {
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

  it('returns only published stays in public search and respects filters', async () => {
    const allPublished = await searchPublishedStays({ page: 1, pageSize: 12 });
    expect(allPublished.total).toBe(6);

    const slugs = allPublished.items.map((i) => i.slug);
    expect(slugs).not.toContain('tay-ho-courtyard-homestay-pending');
    expect(slugs).not.toContain('cam-chau-bamboo-draft');

    const wifiStays = await searchPublishedStays({ amenity: 'wifi' });
    expect(wifiStays.total).toBe(6);

    const lateCheckinStays = await searchPublishedStays({ lateCheckin: true });
    expect(lateCheckinStays.items.map((i) => i.slug)).toEqual(
      expect.arrayContaining([
        'tay-ho-sunlit-lake-loft',
        'an-thuong-coastal-work-apartment',
      ])
    );
    expect(lateCheckinStays.items.map((i) => i.slug)).not.toContain(
      'an-thuong-quiet-garden-house'
    );
  });

  it('excludes stays with blocked occupancy_nights and computes stayTotalVnd with overrides', async () => {
    // Tay Ho Loft has host_block on today+20 and today+21
    const checkInBlocked = addDaysIso(todayVn, 20);
    const checkOutBlocked = addDaysIso(todayVn, 22);

    const duringBlock = await searchPublishedStays({
      area: 'tay-ho-hanoi',
      checkIn: checkInBlocked,
      checkOut: checkOutBlocked,
      guests: 1,
    });
    expect(duringBlock.items.map((i) => i.slug)).not.toContain('tay-ho-sunlit-lake-loft');
    expect(duringBlock.items.map((i) => i.slug)).toContain('tay-ho-garden-terrace-studio');

    // Same-day turnover: checking in on today+22 (when block covered 20, 21) MUST succeed
    const adjacentCheckIn = addDaysIso(todayVn, 22);
    const adjacentCheckOut = addDaysIso(todayVn, 24);
    const afterBlock = await searchPublishedStays({
      area: 'tay-ho-hanoi',
      checkIn: adjacentCheckIn,
      checkOut: adjacentCheckOut,
      guests: 1,
    });
    const loftCard = afterBlock.items.find((i) => i.slug === 'tay-ho-sunlit-lake-loft');
    expect(loftCard).toBeDefined();
    // 2 * 1,450,000 + 250,000 cleaning = 3,150,000 VND
    expect(loftCard?.stayTotalVnd).toBe(3150000);
  });

  it('keeps pending booking dates available for quote until confirmed', async () => {
    // Seeded pending booking is on tay-ho-garden-terrace-studio [today+14, today+16)
    const quote = await calculateStayQuote({
      listingSlug: 'tay-ho-garden-terrace-studio',
      checkIn: addDaysIso(todayVn, 14),
      checkOut: addDaysIso(todayVn, 16),
      guestsCount: 1,
    });
    expect(quote.available).toBe(true);
    expect(quote.totalVnd).toBe(980000 * 2 + 180000);
  });

  it('applies nightly_rates overrides and changes quoteHash when rates change', async () => {
    // Tay Ho Loft has 1,750,000 override on today+5 and today+6, base 1,450,000 on today+7
    const checkIn = addDaysIso(todayVn, 5);
    const checkOut = addDaysIso(todayVn, 8);

    const quoteBefore = await calculateStayQuote({
      listingId: SEED_IDS.listings.tayHoLoft,
      checkIn,
      checkOut,
      guestsCount: 2,
    });

    expect(quoteBefore.nightlyBreakdown).toEqual([
      { date: addDaysIso(todayVn, 5), rateVnd: 1750000, isOverride: true },
      { date: addDaysIso(todayVn, 6), rateVnd: 1750000, isOverride: true },
      { date: addDaysIso(todayVn, 7), rateVnd: 1450000, isOverride: false },
    ]);
    expect(quoteBefore.accommodationSubtotalVnd).toBe(4950000);
    expect(quoteBefore.cleaningFeeVnd).toBe(250000);
    expect(quoteBefore.totalVnd).toBe(5200000);

    // Simulate host updating base rate -> quoteHash must differ for PRICE_CHANGED detection
    await dbQuery(
      `UPDATE listings SET base_nightly_rate_vnd = 1550000 WHERE id = $1`,
      [SEED_IDS.listings.tayHoLoft]
    );

    const quoteAfter = await calculateStayQuote({
      listingId: SEED_IDS.listings.tayHoLoft,
      checkIn,
      checkOut,
      guestsCount: 2,
    });

    expect(quoteAfter.totalVnd).toBe(5300000);
    expect(quoteAfter.quoteHash).not.toBe(quoteBefore.quoteHash);
  });

  it('never returns unpublished stays from public detail lookup', async () => {
    const pending = await getPublishedStayBySlug('tay-ho-courtyard-homestay-pending');
    const draft = await getPublishedStayBySlug('cam-chau-bamboo-draft');
    expect(pending).toBeNull();
    expect(draft).toBeNull();
  });
});
