import crypto from 'crypto';
import { requireRole } from '@/lib/auth/rbac';
import type { SessionUser } from '@/lib/auth/session';
import { dbQuery, withTransaction } from '@/lib/db';
import { AppError } from '@/lib/errors';
import { logEvent } from '@/lib/logger';
import { assertUuid } from '@/lib/validation';

export type LocalGuideTheme = 'food' | 'culture' | 'leisure' | 'coworking';
export type LocalGuideDurationBucket = '1_2_hours' | 'half_day';
export type LocalGuideBudgetTier = 'budget' | 'moderate' | 'splurge';
export type LocalGuideCompanion = 'solo' | 'group';

export interface LocalGuideStopSummary {
  stopOrder: number;
  placeId: string;
  placeSlug: string;
  placeNameEn: string;
  placeNameVi: string;
  theme: LocalGuideTheme;
  shortDescriptionEn: string;
  shortDescriptionVi: string;
  imagePath: string | null;
  estimatedCostVnd: number;
  durationMinutes: number | null;
  hasVideoCallBooths: boolean;
  bookingRequired: boolean;
  coworkingNotesEn: string | null;
  coworkingNotesVi: string | null;
  directionsNoteEn: string | null;
  directionsNoteVi: string | null;
  mapsUrl: string;
  partnerBookingUrl: string | null;
  recommendedItemsEn: string | null;
  recommendedItemsVi: string | null;
  localNotesEn: string | null;
  localNotesVi: string | null;
}

export interface LocalGuideSummary {
  id: string;
  areaId: string;
  areaSlug: string;
  areaNameEn: string;
  areaNameVi: string;
  cityEn: string;
  cityVi: string;
  slug: string;
  titleEn: string;
  titleVi: string;
  summaryEn: string;
  summaryVi: string;
  directionsSummaryEn: string | null;
  directionsSummaryVi: string | null;
  theme: LocalGuideTheme;
  durationBucket: LocalGuideDurationBucket;
  budgetTier: LocalGuideBudgetTier;
  estimatedTotalVnd: number;
  suitableSolo: boolean;
  suitableGroup: boolean;
  coverImagePath: string | null;
  source: string;
  verifiedAt: string;
  isPublished: boolean;
  stops: LocalGuideStopSummary[];
}

export interface NearbyCoworkingPlace {
  id: string;
  slug: string;
  nameEn: string;
  nameVi: string;
  shortDescriptionEn: string;
  shortDescriptionVi: string;
  estimatedCostVnd: number;
  hasVideoCallBooths: boolean;
  bookingRequired: boolean;
  coworkingNotesEn: string | null;
  coworkingNotesVi: string | null;
  directionsNoteEn: string | null;
  directionsNoteVi: string | null;
  mapsUrl: string;
  partnerBookingUrl: string | null;
}

export interface NeighborhoodDayPreview {
  areaSlug: string;
  areaNameEn: string;
  areaNameVi: string;
  cityEn: string;
  cityVi: string;
  guides: LocalGuideSummary[];
  nearbyCoworking: NearbyCoworkingPlace[];
}

export interface ExploreAreaOption {
  id: string;
  slug: string;
  nameEn: string;
  nameVi: string;
  cityEn: string;
  cityVi: string;
  vibeSummaryEn: string;
  vibeSummaryVi: string;
  walkabilityNoteEn: string;
  walkabilityNoteVi: string;
  publishedGuidesCount: number;
}

export interface AdminLocalPlaceItem {
  id: string;
  areaId: string;
  areaSlug: string;
  areaNameVi: string;
  slug: string;
  nameEn: string;
  nameVi: string;
  theme: LocalGuideTheme;
  shortDescriptionEn: string;
  shortDescriptionVi: string;
  imagePath: string | null;
  estimatedCostVnd: number;
  budgetTier: LocalGuideBudgetTier;
  durationMinutes: number | null;
  suitableSolo: boolean;
  suitableGroup: boolean;
  hasVideoCallBooths: boolean;
  bookingRequired: boolean;
  coworkingNotesEn: string | null;
  coworkingNotesVi: string | null;
  directionsNoteEn: string | null;
  directionsNoteVi: string | null;
  mapsUrl: string;
  partnerBookingUrl: string | null;
  source: string;
  verifiedAt: string;
  isPublished: boolean;
}

export interface AdminLocalGuidesData {
  areas: ExploreAreaOption[];
  places: AdminLocalPlaceItem[];
  guides: LocalGuideSummary[];
}

function slugify(text: string, fallbackPrefix: string): string {
  const ascii = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  const suffix = crypto.randomBytes(2).toString('hex');
  return `${ascii || fallbackPrefix}-${suffix}`;
}

function assertSafeHttpUrl(url: string, fieldName: string): string {
  const trimmed = url.trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new AppError('VALIDATION_ERROR', `${fieldName} must be a valid URL.`);
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new AppError(
      'VALIDATION_ERROR',
      `${fieldName} must use https:// or http://.`
    );
  }
  return parsed.toString();
}

async function hydrateStopsForGuideIds(
  guideIds: string[]
): Promise<Map<string, LocalGuideStopSummary[]>> {
  const map = new Map<string, LocalGuideStopSummary[]>();
  if (guideIds.length === 0) return map;

  const stopsRes = await dbQuery<{
    guide_id: string;
    stop_order: number;
    place_id: string;
    place_slug: string;
    place_name_en: string;
    place_name_vi: string | null;
    theme: LocalGuideTheme;
    short_description_en: string;
    short_description_vi: string | null;
    image_path: string | null;
    estimated_cost_vnd: number;
    duration_minutes: number | null;
    has_video_call_booths: boolean;
    booking_required: boolean;
    coworking_notes_en: string | null;
    coworking_notes_vi: string | null;
    directions_note_en: string | null;
    directions_note_vi: string | null;
    maps_url: string;
    partner_booking_url: string | null;
    recommended_items_en: string | null;
    recommended_items_vi: string | null;
    local_notes_en: string | null;
    local_notes_vi: string | null;
  }>(
    `SELECT gs.guide_id, gs.stop_order,
            p.id AS place_id, p.slug AS place_slug,
            p.name_en AS place_name_en, p.name_vi AS place_name_vi,
            p.theme, p.short_description_en, p.short_description_vi,
            p.image_path, p.estimated_cost_vnd, p.duration_minutes,
            p.has_video_call_booths, p.booking_required,
            p.coworking_notes_en, p.coworking_notes_vi,
            p.directions_note_en, p.directions_note_vi,
            p.maps_url, p.partner_booking_url,
            gs.recommended_items_en, gs.recommended_items_vi,
            gs.local_notes_en, gs.local_notes_vi
     FROM local_guide_stops gs
     JOIN local_places p ON p.id = gs.place_id
     WHERE gs.guide_id = ANY($1::uuid[])
     ORDER BY gs.guide_id ASC, gs.stop_order ASC`,
    [guideIds]
  );

  for (const s of stopsRes.rows) {
    const arr = map.get(s.guide_id) ?? [];
    arr.push({
      stopOrder: Number(s.stop_order),
      placeId: s.place_id,
      placeSlug: s.place_slug,
      placeNameEn: s.place_name_en,
      placeNameVi: s.place_name_vi || s.place_name_en,
      theme: s.theme,
      shortDescriptionEn: s.short_description_en,
      shortDescriptionVi: s.short_description_vi || s.short_description_en,
      imagePath: s.image_path,
      estimatedCostVnd: Number(s.estimated_cost_vnd),
      durationMinutes: s.duration_minutes !== null ? Number(s.duration_minutes) : null,
      hasVideoCallBooths: Boolean(s.has_video_call_booths),
      bookingRequired: Boolean(s.booking_required),
      coworkingNotesEn: s.coworking_notes_en,
      coworkingNotesVi: s.coworking_notes_vi || s.coworking_notes_en,
      directionsNoteEn: s.directions_note_en,
      directionsNoteVi: s.directions_note_vi || s.directions_note_en,
      mapsUrl: s.maps_url,
      partnerBookingUrl: s.partner_booking_url,
      recommendedItemsEn: s.recommended_items_en,
      recommendedItemsVi: s.recommended_items_vi || s.recommended_items_en,
      localNotesEn: s.local_notes_en,
      localNotesVi: s.local_notes_vi || s.local_notes_en,
    });
    map.set(s.guide_id, arr);
  }

  return map;
}

export async function listPublishedExploreAreas(): Promise<ExploreAreaOption[]> {
  const res = await dbQuery<{
    id: string;
    slug: string;
    name_en: string;
    name_vi: string;
    city_en: string;
    city_vi: string;
    vibe_summary_en: string;
    vibe_summary_vi: string;
    walkability_note_en: string;
    walkability_note_vi: string | null;
    published_guides_count: string;
  }>(
    `SELECT a.id, a.slug, a.name_en, a.name_vi, a.city_en, a.city_vi,
            a.vibe_summary_en, a.vibe_summary_vi,
            a.walkability_note_en, a.walkability_note_vi,
            COUNT(g.id)::text AS published_guides_count
     FROM areas a
     LEFT JOIN local_guides g ON g.area_id = a.id AND g.is_published = TRUE
     WHERE a.is_published = TRUE
     GROUP BY a.id
     ORDER BY a.city_en ASC, a.name_en ASC`
  );

  return res.rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    nameEn: r.name_en,
    nameVi: r.name_vi,
    cityEn: r.city_en,
    cityVi: r.city_vi,
    vibeSummaryEn: r.vibe_summary_en,
    vibeSummaryVi: r.vibe_summary_vi || r.vibe_summary_en,
    walkabilityNoteEn: r.walkability_note_en,
    walkabilityNoteVi: r.walkability_note_vi || r.walkability_note_en,
    publishedGuidesCount: Number(r.published_guides_count),
  }));
}

export async function getExploreAreaDetail(
  areaSlug: string
): Promise<ExploreAreaOption | null> {
  const cleanSlug = areaSlug.trim().toLowerCase();
  if (!cleanSlug) return null;

  const res = await dbQuery<{
    id: string;
    slug: string;
    name_en: string;
    name_vi: string;
    city_en: string;
    city_vi: string;
    vibe_summary_en: string;
    vibe_summary_vi: string;
    walkability_note_en: string;
    walkability_note_vi: string | null;
    published_guides_count: string;
  }>(
    `SELECT a.id, a.slug, a.name_en, a.name_vi, a.city_en, a.city_vi,
            a.vibe_summary_en, a.vibe_summary_vi,
            a.walkability_note_en, a.walkability_note_vi,
            COUNT(g.id)::text AS published_guides_count
     FROM areas a
     LEFT JOIN local_guides g ON g.area_id = a.id AND g.is_published = TRUE
     WHERE a.slug = $1 AND a.is_published = TRUE
     GROUP BY a.id
     LIMIT 1`,
    [cleanSlug]
  );

  const r = res.rows[0];
  if (!r) return null;

  return {
    id: r.id,
    slug: r.slug,
    nameEn: r.name_en,
    nameVi: r.name_vi,
    cityEn: r.city_en,
    cityVi: r.city_vi,
    vibeSummaryEn: r.vibe_summary_en,
    vibeSummaryVi: r.vibe_summary_vi || r.vibe_summary_en,
    walkabilityNoteEn: r.walkability_note_en,
    walkabilityNoteVi: r.walkability_note_vi || r.walkability_note_en,
    publishedGuidesCount: Number(r.published_guides_count),
  };
}

export async function listPublishedCoworkingForArea(
  areaSlug: string
): Promise<NearbyCoworkingPlace[]> {
  const res = await dbQuery<{
    id: string;
    slug: string;
    name_en: string;
    name_vi: string | null;
    short_description_en: string;
    short_description_vi: string | null;
    estimated_cost_vnd: number;
    has_video_call_booths: boolean;
    booking_required: boolean;
    coworking_notes_en: string | null;
    coworking_notes_vi: string | null;
    directions_note_en: string | null;
    directions_note_vi: string | null;
    maps_url: string;
    partner_booking_url: string | null;
  }>(
    `SELECT p.id, p.slug, p.name_en, p.name_vi,
            p.short_description_en, p.short_description_vi,
            p.estimated_cost_vnd, p.has_video_call_booths, p.booking_required,
            p.coworking_notes_en, p.coworking_notes_vi,
            p.directions_note_en, p.directions_note_vi,
            p.maps_url, p.partner_booking_url
     FROM local_places p
     JOIN areas a ON a.id = p.area_id
     WHERE a.slug = $1 AND a.is_published = TRUE
       AND p.theme = 'coworking' AND p.is_published = TRUE
     ORDER BY p.verified_at DESC`,
    [areaSlug.trim().toLowerCase()]
  );

  return res.rows.map((p) => ({
    id: p.id,
    slug: p.slug,
    nameEn: p.name_en,
    nameVi: p.name_vi || p.name_en,
    shortDescriptionEn: p.short_description_en,
    shortDescriptionVi: p.short_description_vi || p.short_description_en,
    estimatedCostVnd: Number(p.estimated_cost_vnd),
    hasVideoCallBooths: Boolean(p.has_video_call_booths),
    bookingRequired: Boolean(p.booking_required),
    coworkingNotesEn: p.coworking_notes_en,
    coworkingNotesVi: p.coworking_notes_vi || p.coworking_notes_en,
    directionsNoteEn: p.directions_note_en,
    directionsNoteVi: p.directions_note_vi || p.directions_note_en,
    mapsUrl: p.maps_url,
    partnerBookingUrl: p.partner_booking_url,
  }));
}

/**
 * Queries published curated guides for a specific area.
 * Returns at most 5 matching routes with ordered stops.
 * Intentionally decoupled from booking transactions.
 */
export async function listPublishedGuidesForArea(
  areaSlug: string,
  filters?: {
    theme?: LocalGuideTheme;
    durationBucket?: LocalGuideDurationBucket;
    budgetTier?: LocalGuideBudgetTier;
    companion?: LocalGuideCompanion;
  }
): Promise<LocalGuideSummary[]> {
  const conditions = [
    `a.slug = $1`,
    `a.is_published = TRUE`,
    `g.is_published = TRUE`,
  ];
  const values: unknown[] = [areaSlug.trim()];

  if (filters?.theme) {
    values.push(filters.theme);
    conditions.push(`g.theme = $${values.length}`);
  }
  if (filters?.durationBucket) {
    values.push(filters.durationBucket);
    conditions.push(`g.duration_bucket = $${values.length}`);
  }
  if (filters?.budgetTier) {
    values.push(filters.budgetTier);
    conditions.push(`g.budget_tier = $${values.length}`);
  }
  if (filters?.companion === 'solo') {
    conditions.push(`g.suitable_solo = TRUE`);
  } else if (filters?.companion === 'group') {
    conditions.push(`g.suitable_group = TRUE`);
  }

  const res = await dbQuery<{
    id: string;
    area_id: string;
    area_slug: string;
    area_name_en: string;
    area_name_vi: string;
    city_en: string;
    city_vi: string;
    slug: string;
    title_en: string;
    title_vi: string | null;
    summary_en: string;
    summary_vi: string | null;
    directions_summary_en: string | null;
    directions_summary_vi: string | null;
    theme: LocalGuideTheme;
    duration_bucket: LocalGuideDurationBucket;
    budget_tier: LocalGuideBudgetTier;
    estimated_total_vnd: number;
    suitable_solo: boolean;
    suitable_group: boolean;
    cover_image_path: string | null;
    source: string;
    verified_at: string;
    is_published: boolean;
  }>(
    `SELECT g.id, g.area_id, a.slug AS area_slug,
            a.name_en AS area_name_en, a.name_vi AS area_name_vi,
            a.city_en, a.city_vi,
            g.slug, g.title_en, g.title_vi, g.summary_en, g.summary_vi,
            g.directions_summary_en, g.directions_summary_vi,
            g.theme, g.duration_bucket, g.budget_tier, g.estimated_total_vnd,
            g.suitable_solo, g.suitable_group,
            g.cover_image_path, g.source, g.verified_at::text AS verified_at,
            g.is_published
     FROM local_guides g
     JOIN areas a ON a.id = g.area_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY g.verified_at DESC, g.created_at DESC
     LIMIT 5`,
    values
  );

  const stopsMap = await hydrateStopsForGuideIds(res.rows.map((r) => r.id));

  return res.rows.map((r) => ({
    id: r.id,
    areaId: r.area_id,
    areaSlug: r.area_slug,
    areaNameEn: r.area_name_en,
    areaNameVi: r.area_name_vi,
    cityEn: r.city_en,
    cityVi: r.city_vi,
    slug: r.slug,
    titleEn: r.title_en,
    titleVi: r.title_vi || r.title_en,
    summaryEn: r.summary_en,
    summaryVi: r.summary_vi || r.summary_en,
    directionsSummaryEn: r.directions_summary_en,
    directionsSummaryVi: r.directions_summary_vi || r.directions_summary_en,
    theme: r.theme,
    durationBucket: r.duration_bucket,
    budgetTier: r.budget_tier,
    estimatedTotalVnd: Number(r.estimated_total_vnd),
    suitableSolo: Boolean(r.suitable_solo),
    suitableGroup: Boolean(r.suitable_group),
    coverImagePath: r.cover_image_path,
    source: r.source,
    verifiedAt: r.verified_at,
    isPublished: Boolean(r.is_published),
    stops: stopsMap.get(r.id) ?? [],
  }));
}

/**
 * Moment 1 ("A day in this neighborhood") preview for /stays/[slug].
 * Returns null if the area has no published guides and no published coworking spots.
 */
export async function getNeighborhoodDayPreview(
  areaSlug: string
): Promise<NeighborhoodDayPreview | null> {
  const areaRes = await dbQuery<{
    id: string;
    slug: string;
    name_en: string;
    name_vi: string;
    city_en: string;
    city_vi: string;
  }>(
    `SELECT id, slug, name_en, name_vi, city_en, city_vi
     FROM areas
     WHERE slug = $1 AND is_published = TRUE
     LIMIT 1`,
    [areaSlug.trim()]
  );

  const area = areaRes.rows[0];
  if (!area) return null;

  const [guides, coworkRes] = await Promise.all([
    listPublishedGuidesForArea(area.slug),
    dbQuery<{
      id: string;
      slug: string;
      name_en: string;
      name_vi: string | null;
      short_description_en: string;
      short_description_vi: string | null;
      estimated_cost_vnd: number;
      has_video_call_booths: boolean;
      booking_required: boolean;
      coworking_notes_en: string | null;
      coworking_notes_vi: string | null;
      directions_note_en: string | null;
      directions_note_vi: string | null;
      maps_url: string;
      partner_booking_url: string | null;
    }>(
      `SELECT id, slug, name_en, name_vi,
              short_description_en, short_description_vi,
              estimated_cost_vnd, has_video_call_booths, booking_required,
              coworking_notes_en, coworking_notes_vi,
              directions_note_en, directions_note_vi,
              maps_url, partner_booking_url
       FROM local_places
       WHERE area_id = $1 AND theme = 'coworking' AND is_published = TRUE
       ORDER BY verified_at DESC
       LIMIT 2`,
      [area.id]
    ),
  ]);

  if (guides.length === 0 && coworkRes.rows.length === 0) {
    return null;
  }

  return {
    areaSlug: area.slug,
    areaNameEn: area.name_en,
    areaNameVi: area.name_vi,
    cityEn: area.city_en,
    cityVi: area.city_vi,
    guides: guides.slice(0, 3),
    nearbyCoworking: coworkRes.rows.map((p) => ({
      id: p.id,
      slug: p.slug,
      nameEn: p.name_en,
      nameVi: p.name_vi || p.name_en,
      shortDescriptionEn: p.short_description_en,
      shortDescriptionVi: p.short_description_vi || p.short_description_en,
      estimatedCostVnd: Number(p.estimated_cost_vnd),
      hasVideoCallBooths: Boolean(p.has_video_call_booths),
      bookingRequired: Boolean(p.booking_required),
      coworkingNotesEn: p.coworking_notes_en,
      coworkingNotesVi: p.coworking_notes_vi || p.coworking_notes_en,
      directionsNoteEn: p.directions_note_en,
      directionsNoteVi: p.directions_note_vi || p.directions_note_en,
      mapsUrl: p.maps_url,
      partnerBookingUrl: p.partner_booking_url,
    })),
  };
}

export async function getAdminLocalGuidesData(
  actor: SessionUser | null
): Promise<AdminLocalGuidesData> {
  requireRole(actor, 'admin');

  const [areas, placesRes, guidesRes] = await Promise.all([
    listPublishedExploreAreas(),
    dbQuery<{
      id: string;
      area_id: string;
      area_slug: string;
      area_name_vi: string;
      slug: string;
      name_en: string;
      name_vi: string | null;
      theme: LocalGuideTheme;
      short_description_en: string;
      short_description_vi: string | null;
      image_path: string | null;
      estimated_cost_vnd: number;
      budget_tier: LocalGuideBudgetTier;
      duration_minutes: number | null;
      suitable_solo: boolean;
      suitable_group: boolean;
      has_video_call_booths: boolean;
      booking_required: boolean;
      coworking_notes_en: string | null;
      coworking_notes_vi: string | null;
      directions_note_en: string | null;
      directions_note_vi: string | null;
      maps_url: string;
      partner_booking_url: string | null;
      source: string;
      verified_at: string;
      is_published: boolean;
    }>(
      `SELECT p.id, p.area_id, a.slug AS area_slug, a.name_vi AS area_name_vi,
              p.slug, p.name_en, p.name_vi, p.theme,
              p.short_description_en, p.short_description_vi, p.image_path,
              p.estimated_cost_vnd, p.budget_tier, p.duration_minutes,
              p.suitable_solo, p.suitable_group,
              p.has_video_call_booths, p.booking_required,
              p.coworking_notes_en, p.coworking_notes_vi,
              p.directions_note_en, p.directions_note_vi,
              p.maps_url, p.partner_booking_url, p.source,
              p.verified_at::text AS verified_at, p.is_published
       FROM local_places p
       JOIN areas a ON a.id = p.area_id
       ORDER BY a.name_vi ASC, p.created_at DESC`
    ),
    dbQuery<{
      id: string;
      area_id: string;
      area_slug: string;
      area_name_en: string;
      area_name_vi: string;
      city_en: string;
      city_vi: string;
      slug: string;
      title_en: string;
      title_vi: string | null;
      summary_en: string;
      summary_vi: string | null;
      directions_summary_en: string | null;
      directions_summary_vi: string | null;
      theme: LocalGuideTheme;
      duration_bucket: LocalGuideDurationBucket;
      budget_tier: LocalGuideBudgetTier;
      estimated_total_vnd: number;
      suitable_solo: boolean;
      suitable_group: boolean;
      cover_image_path: string | null;
      source: string;
      verified_at: string;
      is_published: boolean;
    }>(
      `SELECT g.id, g.area_id, a.slug AS area_slug,
              a.name_en AS area_name_en, a.name_vi AS area_name_vi,
              a.city_en, a.city_vi,
              g.slug, g.title_en, g.title_vi, g.summary_en, g.summary_vi,
              g.directions_summary_en, g.directions_summary_vi,
              g.theme, g.duration_bucket, g.budget_tier, g.estimated_total_vnd,
              g.suitable_solo, g.suitable_group,
              g.cover_image_path, g.source, g.verified_at::text AS verified_at,
              g.is_published
       FROM local_guides g
       JOIN areas a ON a.id = g.area_id
       ORDER BY g.is_published DESC, g.verified_at DESC`
    ),
  ]);

  const stopsMap = await hydrateStopsForGuideIds(guidesRes.rows.map((g) => g.id));

  return {
    areas,
    places: placesRes.rows.map((p) => ({
      id: p.id,
      areaId: p.area_id,
      areaSlug: p.area_slug,
      areaNameVi: p.area_name_vi,
      slug: p.slug,
      nameEn: p.name_en,
      nameVi: p.name_vi || p.name_en,
      theme: p.theme,
      shortDescriptionEn: p.short_description_en,
      shortDescriptionVi: p.short_description_vi || p.short_description_en,
      imagePath: p.image_path,
      estimatedCostVnd: Number(p.estimated_cost_vnd),
      budgetTier: p.budget_tier,
      durationMinutes: p.duration_minutes !== null ? Number(p.duration_minutes) : null,
      suitableSolo: Boolean(p.suitable_solo),
      suitableGroup: Boolean(p.suitable_group),
      hasVideoCallBooths: Boolean(p.has_video_call_booths),
      bookingRequired: Boolean(p.booking_required),
      coworkingNotesEn: p.coworking_notes_en,
      coworkingNotesVi: p.coworking_notes_vi || p.coworking_notes_en,
      directionsNoteEn: p.directions_note_en,
      directionsNoteVi: p.directions_note_vi || p.directions_note_en,
      mapsUrl: p.maps_url,
      partnerBookingUrl: p.partner_booking_url,
      source: p.source,
      verifiedAt: p.verified_at,
      isPublished: Boolean(p.is_published),
    })),
    guides: guidesRes.rows.map((g) => ({
      id: g.id,
      areaId: g.area_id,
      areaSlug: g.area_slug,
      areaNameEn: g.area_name_en,
      areaNameVi: g.area_name_vi,
      cityEn: g.city_en,
      cityVi: g.city_vi,
      slug: g.slug,
      titleEn: g.title_en,
      titleVi: g.title_vi || g.title_en,
      summaryEn: g.summary_en,
      summaryVi: g.summary_vi || g.summary_en,
      directionsSummaryEn: g.directions_summary_en,
      directionsSummaryVi: g.directions_summary_vi || g.directions_summary_en,
      theme: g.theme,
      durationBucket: g.duration_bucket,
      budgetTier: g.budget_tier,
      estimatedTotalVnd: Number(g.estimated_total_vnd),
      suitableSolo: Boolean(g.suitable_solo),
      suitableGroup: Boolean(g.suitable_group),
      coverImagePath: g.cover_image_path,
      source: g.source,
      verifiedAt: g.verified_at,
      isPublished: Boolean(g.is_published),
      stops: stopsMap.get(g.id) ?? [],
    })),
  };
}

export interface CreateLocalPlaceInput {
  areaId: string;
  nameEn: string;
  nameVi?: string;
  theme: LocalGuideTheme;
  shortDescriptionEn: string;
  shortDescriptionVi?: string;
  imagePath?: string;
  estimatedCostVnd: number;
  budgetTier: LocalGuideBudgetTier;
  durationMinutes?: number;
  suitableSolo?: boolean;
  suitableGroup?: boolean;
  hasVideoCallBooths?: boolean;
  bookingRequired?: boolean;
  coworkingNotesEn?: string;
  coworkingNotesVi?: string;
  directionsNoteEn?: string;
  directionsNoteVi?: string;
  mapsUrl: string;
  partnerBookingUrl?: string;
  source: string;
  isPublished?: boolean;
}

export async function createLocalPlace(
  actor: SessionUser | null,
  input: CreateLocalPlaceInput
): Promise<AdminLocalPlaceItem> {
  const admin = requireRole(actor, 'admin');
  const areaId = assertUuid(input.areaId, 'area ID');
  const safeMapsUrl = assertSafeHttpUrl(input.mapsUrl, 'Google Maps URL');
  const safePartnerUrl = input.partnerBookingUrl?.trim()
    ? assertSafeHttpUrl(input.partnerBookingUrl, 'Partner booking URL')
    : null;

  if (!Number.isInteger(input.estimatedCostVnd) || input.estimatedCostVnd < 0) {
    throw new AppError('VALIDATION_ERROR', 'Chi phí dự kiến phải là số nguyên >= 0 (VND).');
  }
  if (!input.source.trim()) {
    throw new AppError('VALIDATION_ERROR', 'Vui lòng ghi rõ nguồn kiểm chứng địa điểm.');
  }

  const areaCheck = await dbQuery<{ id: string }>(
    `SELECT id FROM areas WHERE id = $1`,
    [areaId]
  );
  if (!areaCheck.rows[0]) {
    throw new AppError('NOT_FOUND', 'Khu vực không tồn tại.');
  }

  const placeId = crypto.randomUUID();
  const slug = slugify(input.nameEn, 'place');

  await dbQuery(
    `INSERT INTO local_places (
       id, area_id, slug, name_en, name_vi, theme,
       short_description_en, short_description_vi, image_path,
       estimated_cost_vnd, budget_tier, duration_minutes,
       suitable_solo, suitable_group, has_video_call_booths, booking_required,
       coworking_notes_en, coworking_notes_vi,
       directions_note_en, directions_note_vi,
       maps_url, partner_booking_url, source, verified_at, is_published
     ) VALUES (
       $1, $2, $3, $4, $5, $6,
       $7, $8, $9,
       $10, $11, $12,
       $13, $14, $15, $16,
       $17, $18,
       $19, $20,
       $21, $22, $23, NOW(), $24
     )`,
    [
      placeId,
      areaId,
      slug,
      input.nameEn.trim(),
      input.nameVi?.trim() || input.nameEn.trim(),
      input.theme,
      input.shortDescriptionEn.trim(),
      input.shortDescriptionVi?.trim() || input.shortDescriptionEn.trim(),
      input.imagePath?.trim() || null,
      input.estimatedCostVnd,
      input.budgetTier,
      input.durationMinutes ?? null,
      input.suitableSolo ?? true,
      input.suitableGroup ?? true,
      Boolean(input.hasVideoCallBooths),
      Boolean(input.bookingRequired),
      input.coworkingNotesEn?.trim() || null,
      input.coworkingNotesVi?.trim() || input.coworkingNotesEn?.trim() || null,
      input.directionsNoteEn?.trim() || null,
      input.directionsNoteVi?.trim() || input.directionsNoteEn?.trim() || null,
      safeMapsUrl,
      safePartnerUrl,
      input.source.trim(),
      Boolean(input.isPublished),
    ]
  );

  logEvent('info', 'admin.local_place_created', { placeId, adminId: admin.id });

  const data = await getAdminLocalGuidesData(admin);
  const created = data.places.find((p) => p.id === placeId);
  if (!created) throw new AppError('INTERNAL_ERROR', 'Failed to read created place.');
  return created;
}

export async function setLocalPlacePublished(
  actor: SessionUser | null,
  placeId: string,
  isPublished: boolean
): Promise<AdminLocalPlaceItem> {
  const admin = requireRole(actor, 'admin');
  const validId = assertUuid(placeId, 'place ID');

  const res = await dbQuery<{ id: string }>(
    `UPDATE local_places
     SET is_published = $2,
         verified_at = CASE WHEN $2 = TRUE THEN NOW() ELSE verified_at END,
         updated_at = NOW()
     WHERE id = $1
     RETURNING id`,
    [validId, isPublished]
  );
  if (!res.rows[0]) {
    throw new AppError('NOT_FOUND', 'Địa điểm không tồn tại.');
  }

  logEvent('info', 'admin.local_place_publish_toggled', {
    placeId: validId,
    isPublished,
    adminId: admin.id,
  });

  const data = await getAdminLocalGuidesData(admin);
  const updated = data.places.find((p) => p.id === validId);
  if (!updated) throw new AppError('NOT_FOUND', 'Địa điểm không tồn tại.');
  return updated;
}

export interface CreateLocalGuideInput {
  areaId: string;
  titleEn: string;
  titleVi?: string;
  summaryEn: string;
  summaryVi?: string;
  directionsSummaryEn?: string;
  directionsSummaryVi?: string;
  theme: LocalGuideTheme;
  durationBucket: LocalGuideDurationBucket;
  budgetTier: LocalGuideBudgetTier;
  estimatedTotalVnd: number;
  suitableSolo?: boolean;
  suitableGroup?: boolean;
  coverImagePath?: string;
  source: string;
  isPublished?: boolean;
  stops: Array<{
    placeId: string;
    recommendedItemsEn?: string;
    recommendedItemsVi?: string;
    localNotesEn?: string;
    localNotesVi?: string;
  }>;
}

export async function createLocalGuide(
  actor: SessionUser | null,
  input: CreateLocalGuideInput
): Promise<LocalGuideSummary> {
  const admin = requireRole(actor, 'admin');
  const areaId = assertUuid(input.areaId, 'area ID');

  if (!Number.isInteger(input.estimatedTotalVnd) || input.estimatedTotalVnd < 0) {
    throw new AppError('VALIDATION_ERROR', 'Tổng chi phí dự kiến phải là số nguyên >= 0 (VND).');
  }
  if (!input.source.trim()) {
    throw new AppError('VALIDATION_ERROR', 'Vui lòng ghi rõ nguồn kiểm chứng tuyến trải nghiệm.');
  }
  if (!input.stops || input.stops.length === 0) {
    throw new AppError('VALIDATION_ERROR', 'Tuyến gợi ý cần ít nhất 1 điểm dừng.');
  }

  const cleanStops = input.stops.map((s) => ({
    ...s,
    placeId: assertUuid(s.placeId, 'stop place ID'),
  }));

  const guideId = crypto.randomUUID();
  const slug = slugify(input.titleEn, 'guide');

  await withTransaction(
    async (tx) => {
      const areaCheck = await tx.query<{ id: string }>(
        `SELECT id FROM areas WHERE id = $1`,
        [areaId]
      );
      if (!areaCheck.rows[0]) {
        throw new AppError('NOT_FOUND', 'Khu vực không tồn tại.');
      }

      const placeIds = cleanStops.map((s) => s.placeId);
      const placesRes = await tx.query<{ id: string; area_id: string }>(
        `SELECT id, area_id FROM local_places WHERE id = ANY($1::uuid[])`,
        [placeIds]
      );
      if (placesRes.rows.length !== new Set(placeIds).size) {
        throw new AppError('VALIDATION_ERROR', 'Một hoặc nhiều điểm dừng không tồn tại.');
      }
      if (placesRes.rows.some((r) => r.area_id !== areaId)) {
        throw new AppError(
          'VALIDATION_ERROR',
          'Các điểm dừng phải thuộc cùng khu vực với tuyến trải nghiệm.'
        );
      }

      await tx.query(
        `INSERT INTO local_guides (
           id, area_id, slug, title_en, title_vi, summary_en, summary_vi,
           directions_summary_en, directions_summary_vi,
           theme, duration_bucket, budget_tier, estimated_total_vnd,
           suitable_solo, suitable_group, cover_image_path,
           source, verified_at, is_published
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7,
           $8, $9,
           $10, $11, $12, $13,
           $14, $15, $16,
           $17, NOW(), $18
         )`,
        [
          guideId,
          areaId,
          slug,
          input.titleEn.trim(),
          input.titleVi?.trim() || input.titleEn.trim(),
          input.summaryEn.trim(),
          input.summaryVi?.trim() || input.summaryEn.trim(),
          input.directionsSummaryEn?.trim() || null,
          input.directionsSummaryVi?.trim() || input.directionsSummaryEn?.trim() || null,
          input.theme,
          input.durationBucket,
          input.budgetTier,
          input.estimatedTotalVnd,
          input.suitableSolo ?? true,
          input.suitableGroup ?? true,
          input.coverImagePath?.trim() || null,
          input.source.trim(),
          Boolean(input.isPublished),
        ]
      );

      for (let i = 0; i < cleanStops.length; i++) {
        const stop = cleanStops[i];
        await tx.query(
          `INSERT INTO local_guide_stops (
             guide_id, place_id, stop_order,
             recommended_items_en, recommended_items_vi,
             local_notes_en, local_notes_vi
           ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            guideId,
            stop.placeId,
            i + 1,
            stop.recommendedItemsEn?.trim() || null,
            stop.recommendedItemsVi?.trim() || stop.recommendedItemsEn?.trim() || null,
            stop.localNotesEn?.trim() || null,
            stop.localNotesVi?.trim() || stop.localNotesEn?.trim() || null,
          ]
        );
      }
    },
    { actorId: admin.id }
  );

  logEvent('info', 'admin.local_guide_created', { guideId, adminId: admin.id });

  const data = await getAdminLocalGuidesData(admin);
  const created = data.guides.find((g) => g.id === guideId);
  if (!created) throw new AppError('INTERNAL_ERROR', 'Failed to read created guide.');
  return created;
}

export async function setLocalGuidePublished(
  actor: SessionUser | null,
  guideId: string,
  isPublished: boolean
): Promise<LocalGuideSummary> {
  const admin = requireRole(actor, 'admin');
  const validId = assertUuid(guideId, 'guide ID');

  const res = await dbQuery<{ id: string }>(
    `UPDATE local_guides
     SET is_published = $2,
         verified_at = CASE WHEN $2 = TRUE THEN NOW() ELSE verified_at END,
         updated_at = NOW()
     WHERE id = $1
     RETURNING id`,
    [validId, isPublished]
  );
  if (!res.rows[0]) {
    throw new AppError('NOT_FOUND', 'Tuyến gợi ý không tồn tại.');
  }

  logEvent('info', 'admin.local_guide_publish_toggled', {
    guideId: validId,
    isPublished,
    adminId: admin.id,
  });

  const data = await getAdminLocalGuidesData(admin);
  const updated = data.guides.find((g) => g.id === validId);
  if (!updated) throw new AppError('NOT_FOUND', 'Tuyến gợi ý không tồn tại.');
  return updated;
}
