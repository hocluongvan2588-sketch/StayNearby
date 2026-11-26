import crypto from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NextRequest } from 'next/server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SessionUser } from '@/lib/auth/session';
import { addDaysIso, getTodayIsoVietnam } from '@/lib/dates';
import { closeDb, dbQuery, ensureDbReady } from '@/lib/db';
import { SEED_IDS } from '@/lib/db/seed-data';
import { getAdminActorContext } from '@/modules/admin-rbac';
import {
  createAdminPlace,
  createLocalPartner,
  createMarketingCampaign,
  createNeighborhood,
  createOrUpdateCmsContent,
  getOverviewDashboardData,
  listCampaignsAndFunnel,
  updateAdminPlace,
} from '@/modules/admin-bos';
import { confirmBookingFeePayment, createStayBooking } from '@/modules/bookings';
import {
  getDestinationLocalPartners,
  getDestinationLocalPlaces,
  getDestinationNeighborhoods,
} from '@/modules/catalog';
import {
  getIndexableCmsSlugs,
  getPublishedCmsBySlug,
  getPublishedCmsContents,
} from '@/modules/cms';
import { POST as trackRoutePost } from '@/app/api/track/route';

let tempDir: string;

async function fetchSessionUser(userId: string): Promise<SessionUser> {
  const res = await dbQuery(
    `SELECT id, email, full_name, role, nationality, membership_tier, membership_expires_at,
            reward_credit_vnd, vat_tax_id, preferred_locale, preferred_currency, phone
     FROM users WHERE id = $1`,
    [userId]
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
    preferredCurrency: (u.preferred_currency as SessionUser['preferredCurrency']) ?? 'USD',
    phone: u.phone ? String(u.phone) : null,
  };
}

beforeAll(async () => {
  tempDir = mkdtempSync(join(tmpdir(), 'vietnomad-phase3-sync-'));
  process.env.PGLITE_DATA_DIR = tempDir;
  delete process.env.DATABASE_URL;
  await ensureDbReady();
});

afterAll(async () => {
  await closeDb();
  rmSync(tempDir, { recursive: true, force: true });
});

describe('Phase 3 Sync: Local Discovery, CMS Storefront Content & Attribution Integrity', () => {
  it('syncs neighborhoods, active-only local partners, and verified-only places to destination pages', async () => {
    const admin = await fetchSessionUser(SEED_IDS.users.admin);
    const actor = await getAdminActorContext(admin);

    // 1. Create a new neighborhood in Da Nang
    const nb = await createNeighborhood(actor, {
      destinationId: SEED_IDS.destinations.daNang,
      slug: 'an-thuong-beachside',
      nameEn: 'An Thuong Beachside',
      nameVi: 'Khu Phố Biển An Thượng',
      summaryEn: 'Walkable coastal district steps from My Khe beach.',
      summaryVi: 'Khu phố đi bộ ven biển cách bãi biển Mỹ Khê vài bước chân.',
    });

    // 2. Create 1 active partner & 1 paused partner
    const activePartner = await createLocalPartner(actor, {
      businessName: 'My Khe Surf & Wellness Club',
      category: 'gym_yoga',
      destinationId: SEED_IDS.destinations.daNang,
      partnershipStatus: 'active',
      perkOffer: '20% off monthly surf & yoga pass for VietNomad guests',
    });
    const pausedPartner = await createLocalPartner(actor, {
      businessName: 'Paused Cafe Partner',
      category: 'cafe',
      destinationId: SEED_IDS.destinations.daNang,
      partnershipStatus: 'paused',
      perkOffer: 'Should not appear on storefront',
    });

    // 3. Create 1 verified place linked to active partner & 1 outdated place
    const verifiedCreated = await createAdminPlace(actor, {
      destinationId: SEED_IDS.destinations.daNang,
      neighborhoodId: nb.id,
      partnerId: activePartner.id,
      category: 'attraction',
      name: 'My Khe Sunrise Promenade',
      address: 'Vo Nguyen Giap, Da Nang',
      descriptionEn: 'Scenic 4km beachfront boardwalk for morning walks and ocean views.',
      descriptionVi: 'Tuyến dạo bộ ven biển 4km ngắm bình minh Mỹ Khê.',
      isFeatured: true,
    });
    const outdatedCreated = await createAdminPlace(actor, {
      destinationId: SEED_IDS.destinations.daNang,
      category: 'restaurant',
      name: 'Outdated Hidden Bistro',
      address: 'Old St, Da Nang',
      descriptionEn: 'Old bistro',
    });
    await updateAdminPlace(actor, outdatedCreated.id, { verificationStatus: 'outdated' });

    const [nbs, partners, places] = await Promise.all([
      getDestinationNeighborhoods('da-nang'),
      getDestinationLocalPartners('da-nang'),
      getDestinationLocalPlaces('da-nang'),
    ]);

    expect(nbs.some((item) => item.slug === 'an-thuong-beachside')).toBe(true);
    expect(partners.some((p) => p.id === activePartner.id)).toBe(true);
    expect(partners.some((p) => p.id === pausedPartner.id)).toBe(false);

    const verifiedPlace = places.find((pl) => pl.id === verifiedCreated.id);
    expect(verifiedPlace).toBeDefined();
    expect(verifiedPlace!.partnerPerk).toContain('20% off monthly surf');
    expect(places.some((pl) => pl.id === outdatedCreated.id)).toBe(false);
  });

  it('enforces CMS publish lifecycle, scheduling windows, SEO metadata, and unpublish behavior', async () => {
    const admin = await fetchSessionUser(SEED_IDS.users.admin);
    const actor = await getAdminActorContext(admin);

    const pastIso = new Date(Date.now() - 86_400_000).toISOString();
    const futureIso = new Date(Date.now() + 86_400_000).toISOString();

    const liveArticle = await createOrUpdateCmsContent(actor, {
      contentType: 'destination_guide',
      category: 'living_guide',
      slug: 'living-in-da-nang-2026',
      titleEn: 'Living in Da Nang: 2026 Extended Stay Guide',
      titleVi: 'Kinh nghiệm ở dài ngày tại Đà Nẵng 2026',
      bodyEn: 'First paragraph about beaches and neighborhoods.\n\nSecond paragraph about food.',
      bodyVi: 'Đoạn một về bãi biển và khu phố.\n\nĐoạn hai về ẩm thực.',
      destinationId: SEED_IDS.destinations.daNang,
      seoTitle: 'Da Nang Living Guide 2026 | VietNomad',
      seoDescription: 'Complete guide to beaches, neighborhoods, and monthly stays in Da Nang.',
      robotsIndex: true,
      publishStartAt: pastIso,
      publishEndAt: futureIso,
      status: 'published',
    });

    await createOrUpdateCmsContent(actor, {
      contentType: 'announcement',
      category: 'promo',
      slug: 'spring-banner-2026',
      titleEn: 'Spring Coastal Stays Open Now',
      titleVi: 'Mở đặt phòng mùa xuân ven biển',
      bodyEn: 'Save on 30-night coastal apartments.',
      status: 'published',
    });

    // Draft and expired items must NEVER surface publicly
    await createOrUpdateCmsContent(actor, {
      contentType: 'article',
      category: 'living_guide',
      slug: 'internal-draft-guide',
      titleEn: 'Unpublished Draft',
      titleVi: 'Bản nháp',
      bodyEn: 'Draft content',
      status: 'draft',
    });
    await createOrUpdateCmsContent(actor, {
      contentType: 'article',
      category: 'living_guide',
      slug: 'expired-guide-2025',
      titleEn: 'Expired Guide',
      titleVi: 'Bài hết hạn',
      bodyEn: 'Expired content',
      publishEndAt: pastIso,
      status: 'published',
    });

    const [guides, announcements, bySlug, indexable] = await Promise.all([
      getPublishedCmsContents({ contentTypes: ['destination_guide', 'article'] }),
      getPublishedCmsContents({ contentTypes: ['announcement'] }),
      getPublishedCmsBySlug('living-in-da-nang-2026'),
      getIndexableCmsSlugs(),
    ]);

    expect(guides.some((g) => g.slug === 'living-in-da-nang-2026')).toBe(true);
    expect(guides.some((g) => g.slug === 'internal-draft-guide')).toBe(false);
    expect(guides.some((g) => g.slug === 'expired-guide-2025')).toBe(false);
    expect(announcements.some((a) => a.slug === 'spring-banner-2026')).toBe(true);
    expect(bySlug?.seoTitle).toBe('Da Nang Living Guide 2026 | VietNomad');
    expect(indexable.some((s) => s.slug === 'living-in-da-nang-2026')).toBe(true);
    expect(indexable.some((s) => s.slug === 'spring-banner-2026')).toBe(false);

    // Unpublish -> immediately disappears from storefront
    await createOrUpdateCmsContent(actor, {
      id: liveArticle.id,
      contentType: 'destination_guide',
      category: 'living_guide',
      slug: 'living-in-da-nang-2026',
      titleEn: 'Living in Da Nang: 2026 Extended Stay Guide',
      titleVi: 'Kinh nghiệm ở dài ngày tại Đà Nẵng 2026',
      bodyEn: 'Updated body',
      status: 'archived',
    });
    expect(await getPublishedCmsBySlug('living-in-da-nang-2026')).toBeNull();
  });

  it('enforces attribution deduplication, blocks client booking_completed spoofing, filters internal traffic, and links server-side booking_completed', async () => {
    const admin = await fetchSessionUser(SEED_IDS.users.admin);
    const actor = await getAdminActorContext(admin);
    const guest = await fetchSessionUser(SEED_IDS.users.nomadFree);

    const campaignCode = `camp_${crypto.randomUUID().slice(0, 6)}`;
    await createMarketingCampaign(actor, {
      name: 'Hanoi Autumn Remote Campaign',
      channel: 'paid_search',
      utmSource: 'google',
      utmMedium: 'cpc',
      utmCampaign: campaignCode,
      budgetVnd: 10_000_000,
      startDate: getTodayIsoVietnam(),
    });

    // 1. Client cannot spoof booking_completed via /api/track
    const spoofReq = new NextRequest('http://localhost/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionKey: 'ses_spoof_1',
        eventName: 'booking_completed',
      }),
    });
    const spoofJson = (await (await trackRoutePost(spoofReq)).json()) as { ok: boolean };
    expect(spoofJson.ok).toBe(false);

    // 2. Duplicate dedupeKey only records 1 row
    const sessionKey = `ses_public_${crypto.randomUUID().slice(0, 8)}`;
    const dedupeKey = `sv:${sessionKey}:${SEED_IDS.stays.tayHoJade}`;
    const trackPayload = {
      sessionKey,
      visitorId: 'vis_guest_1',
      eventName: 'stay_view',
      stayId: SEED_IDS.stays.tayHoJade,
      utmSource: 'google',
      utmMedium: 'cpc',
      utmCampaign: campaignCode,
      utmContent: 'ad_variant_a',
      utmTerm: 'hanoi_apartment',
      landingPath: '/stays/tay-ho-jade-sanctuary',
      dedupeKey,
    };

    const firstRes = (await (
      await trackRoutePost(
        new NextRequest('http://localhost/api/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(trackPayload),
        })
      )
    ).json()) as { ok: boolean; deduplicated?: boolean };
    const secondRes = (await (
      await trackRoutePost(
        new NextRequest('http://localhost/api/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(trackPayload),
        })
      )
    ).json()) as { ok: boolean; deduplicated?: boolean };

    expect(firstRes.ok).toBe(true);
    expect(secondRes.deduplicated).toBe(true);

    // 3. Internal admin route event is marked is_internal = TRUE and excluded from funnel
    const internalSession = `ses_admin_${crypto.randomUUID().slice(0, 6)}`;
    await trackRoutePost(
      new NextRequest('http://localhost/api/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionKey: internalSession,
          eventName: 'stay_view',
          utmCampaign: campaignCode,
          landingPath: '/admin/operations/listings',
          dedupeKey: `internal:${internalSession}`,
        }),
      })
    );

    const preBookingStats = await getOverviewDashboardData(actor, 30);
    const stayViewsBeforeBooking = preBookingStats.kpis.stayViews;

    // Adding another internal event should NOT increment public funnel metrics
    await trackRoutePost(
      new NextRequest('http://localhost/api/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionKey: internalSession,
          eventName: 'stay_view',
          utmCampaign: campaignCode,
          landingPath: '/host/listings',
          dedupeKey: `internal_host:${internalSession}`,
        }),
      })
    );
    const postInternalStats = await getOverviewDashboardData(actor, 30);
    expect(postInternalStats.kpis.stayViews).toBe(stayViewsBeforeBooking);

    // 4. Real booking creation + payment confirmation generates server-side booking_completed attributed to campaignCode
    const checkIn = addDaysIso(getTodayIsoVietnam(), 45);
    const booking = await createStayBooking(guest, {
      stayId: SEED_IDS.stays.tayHoJade,
      roomId: SEED_IDS.rooms.tayHoLakeSuite,
      packageId: SEED_IDS.packages.tayHoWork,
      checkIn,
      nights: 7,
      guestsCount: 1,
      checkoutMode: 'intent',
      attributionSessionKey: sessionKey,
      utmSource: 'google',
      utmMedium: 'cpc',
      utmCampaign: campaignCode,
      utmContent: 'ad_variant_a',
      utmTerm: 'hanoi_apartment',
      landingPath: '/stays/tay-ho-jade-sanctuary',
    });
    await confirmBookingFeePayment(guest, booking.bookingId);

    const growthData = await listCampaignsAndFunnel();
    const campRow = growthData.campaigns.find((c) => c.utmCampaign === campaignCode);
    expect(campRow).toBeDefined();
    expect(campRow!.bookingsCount).toBe(1);
    expect(campRow!.revenueVnd).toBeGreaterThan(0);
    // Internal events must not count toward campaign event totals (1 stay_view + 1 checkout_start + 1 booking_completed = 3)
    expect(campRow!.eventsCount).toBe(3);
  });
});
