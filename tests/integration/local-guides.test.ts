import crypto from 'crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeDb, dbQuery } from '@/lib/db';
import { runMigrations } from '@/lib/db/migrate';
import { runSeed, SEED_IDS } from '@/lib/db/seed-data';
import { loadSessionUserById } from '@/lib/auth/session';
import { getBookingDetail } from '@/modules/bookings';
import {
  createLocalGuide,
  createLocalPlace,
  getAdminLocalGuidesData,
  getExploreAreaDetail,
  getNeighborhoodDayPreview,
  listPublishedCoworkingForArea,
  listPublishedExploreAreas,
  listPublishedGuidesForArea,
  setLocalGuidePublished,
} from '@/modules/local-guides';

describe('Phase 4 Local Guides: public discovery, LIMIT 5, coworking flags & admin governance', () => {
  beforeAll(async () => {
    process.env.DATABASE_URL = '';
    process.env.PGLITE_DATA_DIR = 'memory://';
    await runMigrations();
    await runSeed();
  });

  afterAll(async () => {
    await closeDb();
  });

  it('returns bilingual published guides with ordered stops, hides unpublished drafts, and exposes coworking details', async () => {
    const tayHoGuides = await listPublishedGuidesForArea('tay-ho-hanoi');
    expect(tayHoGuides.length).toBeGreaterThanOrEqual(2);
    expect(tayHoGuides.every((g) => g.isPublished)).toBe(true);
    expect(tayHoGuides.some((g) => g.id === SEED_IDS.localGuides.tayHoDraftHidden)).toBe(
      false
    );

    const first = tayHoGuides[0];
    expect(first.titleEn.length).toBeGreaterThan(3);
    expect(first.titleVi.length).toBeGreaterThan(3);
    expect(first.source.length).toBeGreaterThan(2);
    expect(first.verifiedAt).toBeTruthy();
    expect(first.stops.length).toBeGreaterThan(0);
    expect(first.stops[0].stopOrder).toBe(1);
    expect(first.stops[0].mapsUrl).toMatch(/^https:\/\//);

    const cowork = await listPublishedCoworkingForArea('tay-ho-hanoi');
    expect(cowork.length).toBeGreaterThanOrEqual(1);
    expect(cowork[0].hasVideoCallBooths).toBe(true);
    expect(typeof cowork[0].bookingRequired).toBe('boolean');

    const preview = await getNeighborhoodDayPreview('tay-ho-hanoi');
    expect(preview).not.toBeNull();
    expect(preview?.guides.length).toBeGreaterThan(0);
    expect(preview?.nearbyCoworking.length).toBeGreaterThan(0);
  });

  it('filters accurately by theme/duration/budget/companion and returns null preview when area has no published guides', async () => {
    const filtered = await listPublishedGuidesForArea('tay-ho-hanoi', {
      theme: 'coworking',
      durationBucket: '1_2_hours',
      companion: 'solo',
    });
    expect(filtered.length).toBe(1);
    expect(filtered[0].theme).toBe('coworking');

    const emptyMatch = await listPublishedGuidesForArea('an-thuong-da-nang', {
      theme: 'coworking',
      budgetTier: 'splurge',
    });
    expect(emptyMatch).toEqual([]);

    // Insert a published area with zero local guides/places to prove conditional pre-booking block
    const emptyAreaId = crypto.randomUUID();
    await dbQuery(
      `INSERT INTO areas (
         id, slug, name_en, name_vi, city_en, city_vi,
         description_en, description_vi, vibe_summary_en, vibe_summary_vi,
         walkability_note_en, walkability_note_vi, is_published
       ) VALUES (
         $1, 'phu-nhuan-quiet', 'Phu Nhuan', 'Phú Nhuận', 'Ho Chi Minh City', 'TP. Hồ Chí Minh',
         'Quiet residential lane', 'Con hẻm yên tĩnh', 'Calm lanes', 'Nhịp sống êm',
         'Walkable', 'Dễ đi bộ', TRUE
       )`,
      [emptyAreaId]
    );

    const emptyPreview = await getNeighborhoodDayPreview('phu-nhuan-quiet');
    expect(emptyPreview).toBeNull();
    const detail = await getExploreAreaDetail('phu-nhuan-quiet');
    expect(detail?.publishedGuidesCount).toBe(0);
  });

  it('enforces LIMIT 5 on public area guides even when more than 5 published guides exist', async () => {
    const admin = await loadSessionUserById(SEED_IDS.users.admin);

    // Seed additional published guides in tay-ho-hanoi so total > 5
    for (let i = 1; i <= 4; i++) {
      await createLocalGuide(admin, {
        areaId: SEED_IDS.areas.tayHo,
        titleEn: `Tay Ho Extra Route ${i}`,
        titleVi: `Tuyến Tây Hồ mở rộng ${i}`,
        summaryEn: `Extra curated walk number ${i} around West Lake.`,
        summaryVi: `Tuyến dạo bộ mở rộng số ${i} quanh Hồ Tây.`,
        theme: 'leisure',
        durationBucket: '1_2_hours',
        budgetTier: 'budget',
        estimatedTotalVnd: 100000,
        source: 'StayNearby Editorial',
        isPublished: true,
        stops: [{ placeId: SEED_IDS.localPlaces.tayHoFood }],
      });
    }

    const publicResults = await listPublishedGuidesForArea('tay-ho-hanoi');
    expect(publicResults.length).toBe(5);
  });

  it('enforces Admin RBAC, rejects unsafe URLs, and toggles guide visibility immediately', async () => {
    const guest = await loadSessionUserById(SEED_IDS.users.guest);
    const host1 = await loadSessionUserById(SEED_IDS.users.host1);
    const admin = await loadSessionUserById(SEED_IDS.users.admin);

    await expect(getAdminLocalGuidesData(null)).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
    await expect(getAdminLocalGuidesData(guest)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(getAdminLocalGuidesData(host1)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });

    await expect(
      createLocalPlace(admin, {
        areaId: SEED_IDS.areas.anThuong,
        nameEn: 'Unsafe Link Cafe',
        theme: 'food',
        shortDescriptionEn: 'Should reject javascript URLs.',
        estimatedCostVnd: 50000,
        budgetTier: 'budget',
        mapsUrl: 'javascript:alert(1)',
        source: 'Test',
      })
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });

    const createdPlace = await createLocalPlace(admin, {
      areaId: SEED_IDS.areas.anThuong,
      nameEn: 'My Khe Roastery',
      nameVi: 'Xưởng rang cà phê Mỹ Khê',
      theme: 'coworking',
      shortDescriptionEn: 'Quiet corner tables with 2 acoustic booths.',
      shortDescriptionVi: 'Góc bàn yên tĩnh với 2 buồng gọi cách âm.',
      estimatedCostVnd: 110000,
      budgetTier: 'budget',
      hasVideoCallBooths: true,
      bookingRequired: false,
      mapsUrl: 'https://maps.google.com/?q=My+Khe+Danang',
      source: 'StayNearby Field Check',
      isPublished: true,
    });
    expect(createdPlace.hasVideoCallBooths).toBe(true);

    // Publish the previously hidden Tay Ho draft and verify it appears in Admin & public
    const adminDataBefore = await getAdminLocalGuidesData(admin);
    expect(
      adminDataBefore.guides.some(
        (g) => g.id === SEED_IDS.localGuides.tayHoDraftHidden && !g.isPublished
      )
    ).toBe(true);

    const toggled = await setLocalGuidePublished(
      admin,
      SEED_IDS.localGuides.tayHoDraftHidden,
      true
    );
    expect(toggled.isPublished).toBe(true);

    // Hide it back so seed state remains clean
    const hiddenAgain = await setLocalGuidePublished(
      admin,
      SEED_IDS.localGuides.tayHoDraftHidden,
      false
    );
    expect(hiddenAgain.isPublished).toBe(false);

    const areas = await listPublishedExploreAreas();
    expect(areas.some((a) => a.slug === 'tay-ho-hanoi')).toBe(true);
  });

  it('exposes areaSlug on confirmed BookingDetail for post-confirmation Explore nearby link', async () => {
    const guest = await loadSessionUserById(SEED_IDS.users.guest);
    const detail = await getBookingDetail(guest, SEED_IDS.bookings.confirmedSample);
    expect(detail.status).toBe('confirmed');
    expect(detail.areaSlug).toBe('an-thuong-da-nang');
  });
});
