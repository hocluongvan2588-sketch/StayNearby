import { dbQuery, toNum } from '@/lib/db';
import { getTodayIsoVietnam, isValidUuid } from '@/lib/dates';
import { calculateStayQuote } from '@/lib/pricing';
import { getPlatformFeeConfig } from '@/modules/platform-settings';
import type { TiptapDoc, TiptapNode } from '@/lib/cms-core/schema';

export interface HydratedStayCard {
  id: string;
  slug: string;
  status: string;
  titleEn: string;
  titleVi: string;
  subtitleEn: string;
  subtitleVi: string;
  destinationSlug: string;
  destinationNameEn: string;
  destinationNameVi: string;
  neighborhoodEn: string;
  neighborhoodVi: string;
  heroImage: string;
  wifiDownloadMbps: number;
  isWifiVerified: boolean;
  isWorkReady: boolean;
  hasWorkspace: boolean;
  weekDisplayVnd: number | null;
  monthDisplayVnd: number | null;
}

export interface HydratedDestination {
  id: string;
  slug: string;
  nameEn: string;
  nameVi: string;
  taglineEn: string;
  taglineVi: string;
  avgWifiMbps: number;
  monthlyCostUsd: number;
  heroImage: string;
  mapX: number;
  mapY: number;
  liveStaysCount: number;
}

export interface HydratedNeighborhood {
  id: string;
  slug: string;
  destinationSlug: string;
  destinationNameEn: string;
  destinationNameVi: string;
  nameEn: string;
  nameVi: string;
  summaryEn: string;
  summaryVi: string;
  mapX: number;
  mapY: number;
}

export interface HydratedLocalPlace {
  id: string;
  slug: string;
  name: string;
  category: string;
  address: string;
  imageUrl: string;
  descriptionEn: string;
  descriptionVi: string;
  priceRange: string;
  openingHours: string;
  verificationStatus: string;
  destinationSlug: string;
  neighborhoodNameEn: string | null;
  neighborhoodNameVi: string | null;
}

export interface HydratedPartnerOffer {
  id: string;
  businessName: string;
  category: string;
  perkOffer: string;
  partnershipStatus: string;
  destinationSlug: string | null;
  destinationNameEn: string | null;
  destinationNameVi: string | null;
}

export interface HydratedPromotion {
  id: string;
  code: string;
  name: string;
  discountType: 'percent' | 'fixed_vnd';
  discountValue: number;
  minNights: number;
  validFrom: string;
  validTo: string;
  isActive: boolean;
  descriptionEn: string;
  descriptionVi: string;
}

export interface HydratedGuideCard {
  id: string;
  slug: string;
  contentType: string;
  titleEn: string;
  titleVi: string;
  excerptEn: string;
  excerptVi: string;
  featuredImageUrl: string;
  destinationNameEn: string | null;
  destinationNameVi: string | null;
  readingTimeMinutes: number;
}

export interface HydratedDynamicBlocksContext {
  staysById: Map<string, HydratedStayCard>;
  destinationsById: Map<string, HydratedDestination>;
  destinationsList: HydratedDestination[];
  neighborhoodsById: Map<string, HydratedNeighborhood>;
  placesById: Map<string, HydratedLocalPlace>;
  partnersById: Map<string, HydratedPartnerOffer>;
  promotionsById: Map<string, HydratedPromotion>;
  guidesById: Map<string, HydratedGuideCard>;
  recommendedStaysByKey: Map<string, HydratedStayCard[]>;
  relatedGuidesByKey: Map<string, HydratedGuideCard[]>;
  mapDetailsByDestId: Map<
    string,
    {
      neighborhoods: HydratedNeighborhood[];
      places: HydratedLocalPlace[];
      stays: HydratedStayCard[];
    }
  >;
}

function collectNodes(doc: TiptapDoc | null | undefined): TiptapNode[] {
  const out: TiptapNode[] = [];
  if (!doc || !Array.isArray(doc.content)) return out;
  const walk = (n: TiptapNode) => {
    out.push(n);
    if (Array.isArray(n.content)) {
      for (const c of n.content) walk(c);
    }
  };
  for (const n of doc.content) walk(n);
  return out;
}

export function buildRecommendedKey(attrs: Record<string, unknown>): string {
  return [
    String(attrs.destinationSlug ?? ''),
    String(attrs.lifestyleSlug ?? ''),
    Boolean(attrs.workReadyOnly) ? '1' : '0',
    String(Math.min(6, Math.max(1, Number(attrs.limit ?? 3)))),
  ].join('|');
}

export function buildRelatedGuidesKey(attrs: Record<string, unknown>): string {
  const ids = Array.isArray(attrs.contentIds) ? attrs.contentIds.join(',') : '';
  return [
    ids,
    String(attrs.destinationSlug ?? ''),
    String(attrs.categorySlug ?? ''),
    String(Math.min(6, Math.max(1, Number(attrs.limit ?? 3)))),
  ].join('|');
}

export async function hydrateDynamicBlocksForDoc(
  doc: TiptapDoc | null | undefined,
  options?: { excludeContentId?: string }
): Promise<HydratedDynamicBlocksContext> {
  const nodes = collectNodes(doc);
  const stayIds = new Set<string>();
  const destIds = new Set<string>();
  const neighborhoodIds = new Set<string>();
  const placeIds = new Set<string>();
  const partnerIds = new Set<string>();
  const promoIds = new Set<string>();
  const guideIds = new Set<string>();
  const recQueries = new Map<string, Record<string, unknown>>();
  const relQueries = new Map<string, Record<string, unknown>>();
  const mapDestIds = new Set<string>();

  for (const node of nodes) {
    const a = node.attrs ?? {};
    if (node.type === 'vnStayListing' && typeof a.stayId === 'string' && isValidUuid(a.stayId)) {
      stayIds.add(a.stayId);
    } else if (
      node.type === 'vnDestinationCard' &&
      typeof a.destinationId === 'string' &&
      isValidUuid(a.destinationId)
    ) {
      destIds.add(a.destinationId);
    } else if (
      node.type === 'vnNeighborhoodCard' &&
      typeof a.neighborhoodId === 'string' &&
      isValidUuid(a.neighborhoodId)
    ) {
      neighborhoodIds.add(a.neighborhoodId);
    } else if (
      node.type === 'vnLocalPlaceCard' &&
      typeof a.placeId === 'string' &&
      isValidUuid(a.placeId)
    ) {
      placeIds.add(a.placeId);
    } else if (
      node.type === 'vnDestinationMap' &&
      typeof a.destinationId === 'string' &&
      isValidUuid(a.destinationId)
    ) {
      destIds.add(a.destinationId);
      mapDestIds.add(a.destinationId);
    } else if (
      node.type === 'vnLocalPartnerOffer' &&
      typeof a.partnerId === 'string' &&
      isValidUuid(a.partnerId)
    ) {
      partnerIds.add(a.partnerId);
    } else if (
      node.type === 'vnPromotionBlock' &&
      typeof a.promotionId === 'string' &&
      isValidUuid(a.promotionId)
    ) {
      promoIds.add(a.promotionId);
    } else if (node.type === 'vnRecommendedStays') {
      recQueries.set(buildRecommendedKey(a), a);
    } else if (node.type === 'vnRelatedGuides') {
      if (Array.isArray(a.contentIds)) {
        for (const cid of a.contentIds) {
          if (typeof cid === 'string' && isValidUuid(cid)) guideIds.add(cid);
        }
      }
      relQueries.set(buildRelatedGuidesKey(a), a);
    }
  }

  const feeConfig = await getPlatformFeeConfig();

  const mapStayRow = (r: Record<string, unknown>): HydratedStayCard => {
    const w7 = r.wholesale_7_vnd !== null && r.wholesale_7_vnd !== undefined ? toNum(r.wholesale_7_vnd) : 0;
    const w30 = r.wholesale_30_vnd !== null && r.wholesale_30_vnd !== undefined ? toNum(r.wholesale_30_vnd) : 0;
    return {
      id: String(r.id),
      slug: String(r.slug),
      status: String(r.status),
      titleEn: String(r.title_en),
      titleVi: String(r.title_vi || r.title_en),
      subtitleEn: String(r.subtitle_en ?? ''),
      subtitleVi: String(r.subtitle_vi ?? r.subtitle_en ?? ''),
      destinationSlug: String(r.destination_slug ?? ''),
      destinationNameEn: String(r.destination_name_en ?? ''),
      destinationNameVi: String(r.destination_name_vi ?? r.destination_name_en ?? ''),
      neighborhoodEn: String(r.neighborhood_en ?? ''),
      neighborhoodVi: String(r.neighborhood_vi ?? r.neighborhood_en ?? ''),
      heroImage: String(r.hero_image ?? '/images/hero-vietnam-workation.jpg'),
      wifiDownloadMbps: toNum(r.wifi_download_mbps, 0),
      isWifiVerified: Boolean(r.is_wifi_verified),
      isWorkReady: Boolean(r.is_work_ready),
      hasWorkspace: Boolean(r.has_workspace),
      weekDisplayVnd:
        w7 > 0
          ? calculateStayQuote({
              pkg: {
                wholesale7Vnd: w7,
                wholesale14Vnd: w7 * 2,
                wholesale21Vnd: w7 * 3,
                wholesale30Vnd: w30 || w7 * 4,
                extraNightVnd: Math.round(w7 / 7),
              },
              nights: 7,
              serviceFeeRate: feeConfig.serviceFeeRate,
            }).guestTotalVnd
          : null,
      monthDisplayVnd:
        w30 > 0
          ? calculateStayQuote({
              pkg: {
                wholesale7Vnd: w7 || Math.round(w30 / 4),
                wholesale14Vnd: Math.round(w30 / 2),
                wholesale21Vnd: Math.round((w30 * 3) / 4),
                wholesale30Vnd: w30,
                extraNightVnd: Math.round(w30 / 30),
              },
              nights: 30,
              serviceFeeRate: feeConfig.serviceFeeRate,
            }).guestTotalVnd
          : null,
    };
  };

  const staySelectSql = `
    SELECT s.id, s.slug, s.status, s.title_en, s.title_vi, s.subtitle_en, s.subtitle_vi,
           s.neighborhood_en, s.neighborhood_vi, s.hero_image, s.wifi_download_mbps,
           s.is_wifi_verified, s.is_work_ready, s.has_workspace,
           d.slug AS destination_slug, d.name_en AS destination_name_en, d.name_vi AS destination_name_vi,
           (SELECT MIN(sp.wholesale_7_vnd) FROM stay_rooms sr JOIN stay_packages sp ON sp.room_id = sr.id WHERE sr.stay_id = s.id) AS wholesale_7_vnd,
           (SELECT MIN(sp.wholesale_30_vnd) FROM stay_rooms sr JOIN stay_packages sp ON sp.room_id = sr.id WHERE sr.stay_id = s.id) AS wholesale_30_vnd
    FROM stays s
    JOIN destinations d ON d.id = s.destination_id
  `;

  const [destsAllRes, staysRes, nbsRes, placesRes, partnersRes, promosRes, guidesRes] =
    await Promise.all([
      dbQuery(
        `SELECT d.*,
                (SELECT COUNT(*) FROM stays s WHERE s.destination_id = d.id AND s.status = 'live') AS live_stays_count
         FROM destinations d
         ORDER BY d.name_en ASC`
      ),
      stayIds.size > 0
        ? dbQuery(`${staySelectSql} WHERE s.id = ANY($1::uuid[])`, [[...stayIds]])
        : Promise.resolve({ rows: [] }),
      neighborhoodIds.size > 0
        ? dbQuery(
            `SELECT n.*, d.slug AS destination_slug, d.name_en AS destination_name_en, d.name_vi AS destination_name_vi
             FROM neighborhoods n
             JOIN destinations d ON d.id = n.destination_id
             WHERE n.id = ANY($1::uuid[])`,
            [[...neighborhoodIds]]
          )
        : Promise.resolve({ rows: [] }),
      placeIds.size > 0
        ? dbQuery(
            `SELECT p.*, d.slug AS destination_slug, n.name_en AS neighborhood_name_en, n.name_vi AS neighborhood_name_vi
             FROM places p
             JOIN destinations d ON d.id = p.destination_id
             LEFT JOIN neighborhoods n ON n.id = p.neighborhood_id
             WHERE p.id = ANY($1::uuid[])`,
            [[...placeIds]]
          )
        : Promise.resolve({ rows: [] }),
      partnerIds.size > 0
        ? dbQuery(
            `SELECT lp.*, d.slug AS destination_slug, d.name_en AS destination_name_en, d.name_vi AS destination_name_vi
             FROM local_partners lp
             LEFT JOIN destinations d ON d.id = lp.destination_id
             WHERE lp.id = ANY($1::uuid[])`,
            [[...partnerIds]]
          )
        : Promise.resolve({ rows: [] }),
      promoIds.size > 0
        ? dbQuery(`SELECT * FROM promotions WHERE id = ANY($1::uuid[])`, [[...promoIds]])
        : Promise.resolve({ rows: [] }),
      guideIds.size > 0
        ? dbQuery(
            `SELECT cc.id, cc.slug, cc.content_type, cc.title_en, cc.title_vi, cc.excerpt_en, cc.excerpt_vi,
                    cc.featured_image_url, cc.reading_time_minutes, cc.status,
                    d.name_en AS destination_name_en, d.name_vi AS destination_name_vi
             FROM cms_contents cc
             LEFT JOIN destinations d ON d.id = cc.destination_id
             WHERE cc.id = ANY($1::uuid[]) AND cc.status = 'published'`,
            [[...guideIds]]
          )
        : Promise.resolve({ rows: [] }),
    ]);

  const destinationsById = new Map<string, HydratedDestination>();
  const destinationsList: HydratedDestination[] = destsAllRes.rows.map((d) => {
    const item: HydratedDestination = {
      id: String(d.id),
      slug: String(d.slug),
      nameEn: String(d.name_en),
      nameVi: String(d.name_vi || d.name_en),
      taglineEn: String(d.tagline_en ?? ''),
      taglineVi: String(d.tagline_vi ?? d.tagline_en ?? ''),
      avgWifiMbps: toNum(d.avg_wifi_mbps, 100),
      monthlyCostUsd: toNum(d.monthly_cost_usd, 900),
      heroImage: String(d.hero_image ?? '/images/hero-vietnam-workation.jpg'),
      mapX: toNum(d.map_x, 50),
      mapY: toNum(d.map_y, 50),
      liveStaysCount: toNum(d.live_stays_count, 0),
    };
    destinationsById.set(item.id, item);
    return item;
  });

  const staysById = new Map<string, HydratedStayCard>();
  for (const r of staysRes.rows) {
    const s = mapStayRow(r);
    staysById.set(s.id, s);
  }

  const neighborhoodsById = new Map<string, HydratedNeighborhood>();
  for (const n of nbsRes.rows) {
    const nb: HydratedNeighborhood = {
      id: String(n.id),
      slug: String(n.slug),
      destinationSlug: String(n.destination_slug),
      destinationNameEn: String(n.destination_name_en),
      destinationNameVi: String(n.destination_name_vi || n.destination_name_en),
      nameEn: String(n.name_en),
      nameVi: String(n.name_vi || n.name_en),
      summaryEn: String(n.summary_en ?? ''),
      summaryVi: String(n.summary_vi ?? n.summary_en ?? ''),
      mapX: toNum(n.map_x, 50),
      mapY: toNum(n.map_y, 50),
    };
    neighborhoodsById.set(nb.id, nb);
  }

  const placesById = new Map<string, HydratedLocalPlace>();
  for (const p of placesRes.rows) {
    const pl: HydratedLocalPlace = {
      id: String(p.id),
      slug: String(p.slug),
      name: String(p.name),
      category: String(p.category),
      address: String(p.address ?? ''),
      imageUrl: String(p.image_url ?? ''),
      descriptionEn: String(p.description_en ?? ''),
      descriptionVi: String(p.description_vi ?? p.description_en ?? ''),
      priceRange: String(p.price_range ?? '$$'),
      openingHours: String(p.opening_hours ?? ''),
      verificationStatus: String(p.verification_status ?? 'verified'),
      destinationSlug: String(p.destination_slug ?? ''),
      neighborhoodNameEn: p.neighborhood_name_en ? String(p.neighborhood_name_en) : null,
      neighborhoodNameVi: p.neighborhood_name_vi ? String(p.neighborhood_name_vi) : null,
    };
    placesById.set(pl.id, pl);
  }

  const partnersById = new Map<string, HydratedPartnerOffer>();
  for (const pt of partnersRes.rows) {
    const item: HydratedPartnerOffer = {
      id: String(pt.id),
      businessName: String(pt.business_name),
      category: String(pt.category),
      perkOffer: String(pt.perk_offer ?? ''),
      partnershipStatus: String(pt.partnership_status),
      destinationSlug: pt.destination_slug ? String(pt.destination_slug) : null,
      destinationNameEn: pt.destination_name_en ? String(pt.destination_name_en) : null,
      destinationNameVi: pt.destination_name_vi ? String(pt.destination_name_vi) : null,
    };
    partnersById.set(item.id, item);
  }

  const today = getTodayIsoVietnam();
  const promotionsById = new Map<string, HydratedPromotion>();
  for (const pr of promosRes.rows) {
    const validFrom = String(pr.valid_from).slice(0, 10);
    const validTo = String(pr.valid_to).slice(0, 10);
    const activeNow = Boolean(pr.is_active) && today >= validFrom && today <= validTo;
    const item: HydratedPromotion = {
      id: String(pr.id),
      code: String(pr.code),
      name: String(pr.name),
      discountType: pr.discount_type === 'fixed_vnd' ? 'fixed_vnd' : 'percent',
      discountValue: toNum(pr.discount_value),
      minNights: toNum(pr.min_nights, 7),
      validFrom,
      validTo,
      isActive: activeNow,
      descriptionEn: String(pr.description_en ?? ''),
      descriptionVi: String(pr.description_vi ?? pr.description_en ?? ''),
    };
    promotionsById.set(item.id, item);
  }

  const mapGuideRow = (g: Record<string, unknown>): HydratedGuideCard => ({
    id: String(g.id),
    slug: String(g.slug),
    contentType: String(g.content_type),
    titleEn: String(g.title_en),
    titleVi: String(g.title_vi || g.title_en),
    excerptEn: String(g.excerpt_en ?? ''),
    excerptVi: String(g.excerpt_vi ?? g.excerpt_en ?? ''),
    featuredImageUrl: String(g.featured_image_url ?? ''),
    destinationNameEn: g.destination_name_en ? String(g.destination_name_en) : null,
    destinationNameVi: g.destination_name_vi ? String(g.destination_name_vi) : null,
    readingTimeMinutes: toNum(g.reading_time_minutes, 3),
  });

  const guidesById = new Map<string, HydratedGuideCard>();
  for (const g of guidesRes.rows) {
    const card = mapGuideRow(g);
    guidesById.set(card.id, card);
  }

  // Hydrate recommended stays queries
  const recommendedStaysByKey = new Map<string, HydratedStayCard[]>();
  await Promise.all(
    [...recQueries.entries()].map(async ([key, attrs]) => {
      const conds: string[] = [`s.status = 'live'`];
      const params: unknown[] = [];
      const destSlug = typeof attrs.destinationSlug === 'string' ? attrs.destinationSlug.trim() : '';
      const lifestyleSlug =
        typeof attrs.lifestyleSlug === 'string' ? attrs.lifestyleSlug.trim() : '';
      const workReadyOnly = Boolean(attrs.workReadyOnly);
      const limit = Math.min(6, Math.max(1, Number(attrs.limit ?? 3)));

      if (destSlug) {
        params.push(destSlug);
        conds.push(`d.slug = $${params.length}`);
      }
      if (workReadyOnly) {
        conds.push(`s.is_work_ready = TRUE`);
      }
      if (lifestyleSlug) {
        params.push(lifestyleSlug);
        conds.push(
          `EXISTS (SELECT 1 FROM stay_lifestyles sl JOIN lifestyles l ON l.id = sl.lifestyle_id WHERE sl.stay_id = s.id AND l.slug = $${params.length})`
        );
      }
      params.push(limit);
      const res = await dbQuery(
        `${staySelectSql} WHERE ${conds.join(' AND ')} ORDER BY s.is_featured DESC, s.featured_rank ASC, s.created_at DESC LIMIT $${params.length}`,
        params
      );
      recommendedStaysByKey.set(key, res.rows.map(mapStayRow));
    })
  );

  // Hydrate related guides queries
  const relatedGuidesByKey = new Map<string, HydratedGuideCard[]>();
  await Promise.all(
    [...relQueries.entries()].map(async ([key, attrs]) => {
      const explicitIds = Array.isArray(attrs.contentIds)
        ? attrs.contentIds.filter((id): id is string => typeof id === 'string' && isValidUuid(id))
        : [];
      if (explicitIds.length > 0) {
        const ordered = explicitIds
          .map((id) => guidesById.get(id))
          .filter((x): x is HydratedGuideCard => Boolean(x));
        relatedGuidesByKey.set(key, ordered);
        return;
      }

      const conds: string[] = [
        `cc.status = 'published'`,
        `cc.content_type NOT IN ('announcement', 'hero_banner')`,
        `(cc.publish_start_at IS NULL OR cc.publish_start_at <= NOW())`,
        `(cc.publish_end_at IS NULL OR cc.publish_end_at > NOW())`,
      ];
      const params: unknown[] = [];
      if (options?.excludeContentId && isValidUuid(options.excludeContentId)) {
        params.push(options.excludeContentId);
        conds.push(`cc.id <> $${params.length}`);
      }
      const destSlug = typeof attrs.destinationSlug === 'string' ? attrs.destinationSlug.trim() : '';
      if (destSlug) {
        params.push(destSlug);
        conds.push(`d.slug = $${params.length}`);
      }
      const categorySlug =
        typeof attrs.categorySlug === 'string' ? attrs.categorySlug.trim() : '';
      if (categorySlug) {
        params.push(categorySlug);
        conds.push(`cat.slug = $${params.length}`);
      }
      const limit = Math.min(6, Math.max(1, Number(attrs.limit ?? 3)));
      params.push(limit);

      const res = await dbQuery(
        `SELECT cc.id, cc.slug, cc.content_type, cc.title_en, cc.title_vi, cc.excerpt_en, cc.excerpt_vi,
                cc.featured_image_url, cc.reading_time_minutes,
                d.name_en AS destination_name_en, d.name_vi AS destination_name_vi
         FROM cms_contents cc
         LEFT JOIN destinations d ON d.id = cc.destination_id
         LEFT JOIN cms_categories cat ON cat.id = cc.category_id
         WHERE ${conds.join(' AND ')}
         ORDER BY cc.published_at DESC NULLS LAST, cc.updated_at DESC
         LIMIT $${params.length}`,
        params
      );
      relatedGuidesByKey.set(key, res.rows.map(mapGuideRow));
    })
  );

  // Hydrate Destination Maps
  const mapDetailsByDestId = new Map<
    string,
    {
      neighborhoods: HydratedNeighborhood[];
      places: HydratedLocalPlace[];
      stays: HydratedStayCard[];
    }
  >();
  await Promise.all(
    [...mapDestIds].map(async (destId) => {
      const [nbRes, plRes, stRes] = await Promise.all([
        dbQuery(
          `SELECT n.*, d.slug AS destination_slug, d.name_en AS destination_name_en, d.name_vi AS destination_name_vi
           FROM neighborhoods n JOIN destinations d ON d.id = n.destination_id
           WHERE n.destination_id = $1`,
          [destId]
        ),
        dbQuery(
          `SELECT p.*, d.slug AS destination_slug, n.name_en AS neighborhood_name_en, n.name_vi AS neighborhood_name_vi
           FROM places p JOIN destinations d ON d.id = p.destination_id
           LEFT JOIN neighborhoods n ON n.id = p.neighborhood_id
           WHERE p.destination_id = $1 AND p.verification_status = 'verified'
           ORDER BY p.is_featured DESC LIMIT 8`,
          [destId]
        ),
        dbQuery(
          `${staySelectSql} WHERE s.destination_id = $1 AND s.status = 'live' ORDER BY s.is_featured DESC LIMIT 6`,
          [destId]
        ),
      ]);

      mapDetailsByDestId.set(destId, {
        neighborhoods: nbRes.rows.map((n) => ({
          id: String(n.id),
          slug: String(n.slug),
          destinationSlug: String(n.destination_slug),
          destinationNameEn: String(n.destination_name_en),
          destinationNameVi: String(n.destination_name_vi || n.destination_name_en),
          nameEn: String(n.name_en),
          nameVi: String(n.name_vi || n.name_en),
          summaryEn: String(n.summary_en ?? ''),
          summaryVi: String(n.summary_vi ?? ''),
          mapX: toNum(n.map_x, 50),
          mapY: toNum(n.map_y, 50),
        })),
        places: plRes.rows.map((p) => ({
          id: String(p.id),
          slug: String(p.slug),
          name: String(p.name),
          category: String(p.category),
          address: String(p.address ?? ''),
          imageUrl: String(p.image_url ?? ''),
          descriptionEn: String(p.description_en ?? ''),
          descriptionVi: String(p.description_vi ?? ''),
          priceRange: String(p.price_range ?? '$$'),
          openingHours: String(p.opening_hours ?? ''),
          verificationStatus: String(p.verification_status ?? 'verified'),
          destinationSlug: String(p.destination_slug ?? ''),
          neighborhoodNameEn: p.neighborhood_name_en ? String(p.neighborhood_name_en) : null,
          neighborhoodNameVi: p.neighborhood_name_vi ? String(p.neighborhood_name_vi) : null,
        })),
        stays: stRes.rows.map(mapStayRow),
      });
    })
  );

  return {
    staysById,
    destinationsById,
    destinationsList,
    neighborhoodsById,
    placesById,
    partnersById,
    promotionsById,
    guidesById,
    recommendedStaysByKey,
    relatedGuidesByKey,
    mapDetailsByDestId,
  };
}
