import { dbQuery } from '@/lib/db';
import { AppError } from '@/lib/errors';
import { addDaysIso, enumerateNights, getTodayIsoInTimezone } from '@/lib/format';
import {
  CANCELLATION_POLICIES,
  type CancellationPolicySpec,
  type CancellationPolicyVersion,
} from '@/lib/config';
import { getBlockedDatesForListing } from '@/modules/availability';

export interface PublicArea {
  id: string;
  slug: string;
  nameEn: string;
  nameVi: string;
  cityEn: string;
  cityVi: string;
  timezone: string;
  descriptionEn: string;
  descriptionVi: string;
  vibeSummaryEn: string;
  vibeSummaryVi: string;
  walkabilityNoteEn: string;
  walkabilityNoteVi: string;
  publishedStayCount: number;
}

export interface PublicPhoto {
  id: string;
  url: string;
  altTextEn: string;
  altTextVi: string;
  isCover: boolean;
  sortOrder: number;
}

export interface PublicAmenity {
  code: string;
  category: string;
  labelEn: string;
  labelVi: string;
  iconName: string;
  noteEn: string | null;
}

export interface PublicStayCard {
  id: string;
  slug: string;
  titleEn: string;
  titleVi: string;
  summaryEn: string;
  summaryVi: string;
  propertyType: 'apartment' | 'studio' | 'villa' | 'house' | 'homestay';
  areaSlug: string;
  areaNameEn: string;
  areaNameVi: string;
  cityEn: string;
  cityVi: string;
  areaVibeEn: string;
  areaVibeVi: string;
  maxGuests: number;
  bedrooms: number;
  beds: number;
  bathrooms: number;
  baseNightlyRateVnd: number;
  cleaningFeeVnd: number;
  hasDedicatedDesk: boolean;
  lateCheckinAvailable: boolean;
  declaredAmenities: string[];
  coverPhoto: PublicPhoto | null;
  isDemo: boolean;
  stayTotalVnd: number | null;
  nightsCount: number | null;
}

export interface PublicStayDetail extends PublicStayCard {
  timezone: string;
  walkabilityNoteEn: string;
  walkabilityNoteVi: string;
  descriptionEn: string;
  descriptionVi: string;
  houseRulesEn: string[];
  houseRulesVi: string[];
  workspaceNotesEn: string | null;
  workspaceNotesVi: string | null;
  checkinConditionsEn: string;
  checkinConditionsVi: string;
  minNights: number;
  maxNights: number;
  paymentTerms: string;
  paymentTermsDetailsEn: string;
  paymentTermsDetailsVi: string;
  cancellationPolicy: CancellationPolicySpec;
  hostDisplayName: string;
  photos: PublicPhoto[];
  amenities: PublicAmenity[];
  upcomingBlockedDates: string[];
}

export interface SearchStaysParams {
  area?: string;
  q?: string;
  checkIn?: string;
  checkOut?: string;
  guests?: number;
  propertyType?: string;
  amenity?: string;
  lateCheckin?: boolean;
  page?: number;
  pageSize?: number;
}

export interface SearchStaysResult {
  items: PublicStayCard[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  appliedDates: { checkIn: string; checkOut: string; nightsCount: number } | null;
}

export async function listPublishedAreas(): Promise<PublicArea[]> {
  const res = await dbQuery<{
    id: string;
    slug: string;
    name_en: string;
    name_vi: string;
    city_en: string;
    city_vi: string;
    timezone: string;
    description_en: string;
    description_vi: string;
    vibe_summary_en: string;
    vibe_summary_vi: string;
    walkability_note_en: string;
    walkability_note_vi: string;
    published_count: string;
  }>(
    `SELECT a.id, a.slug, a.name_en, a.name_vi, a.city_en, a.city_vi,
            a.timezone, a.description_en, a.description_vi,
            a.vibe_summary_en, a.vibe_summary_vi,
            a.walkability_note_en, a.walkability_note_vi,
            COUNT(l.id)::text AS published_count
     FROM areas a
     LEFT JOIN listings l ON l.area_id = a.id AND l.status = 'published'
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
    timezone: r.timezone,
    descriptionEn: r.description_en,
    descriptionVi: r.description_vi || r.description_en,
    vibeSummaryEn: r.vibe_summary_en,
    vibeSummaryVi: r.vibe_summary_vi || r.vibe_summary_en,
    walkabilityNoteEn: r.walkability_note_en,
    walkabilityNoteVi: r.walkability_note_vi || r.walkability_note_en,
    publishedStayCount: Number(r.published_count),
  }));
}

export async function searchPublishedStays(
  params: SearchStaysParams
): Promise<SearchStaysResult> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(24, Math.max(1, params.pageSize ?? 12));
  const offset = (page - 1) * pageSize;

  let nights: string[] | null = null;
  if (params.checkIn && params.checkOut) {
    nights = enumerateNights(params.checkIn, params.checkOut);
    const todayDefault = getTodayIsoInTimezone('Asia/Ho_Chi_Minh');
    if (params.checkIn < todayDefault) {
      throw new AppError('VALIDATION_ERROR', 'Check-in date cannot be in the past.');
    }
  } else if (params.checkIn || params.checkOut) {
    throw new AppError(
      'VALIDATION_ERROR',
      'Both check-in and check-out dates are required to filter by dates.'
    );
  }

  const conditions: string[] = [`l.status = 'published'`, `a.is_published = TRUE`];
  const values: unknown[] = [];

  if (params.area && params.area.trim()) {
    values.push(params.area.trim().toLowerCase());
    const idx = values.length;
    conditions.push(
      `(LOWER(a.slug) = $${idx} OR LOWER(a.city_en) LIKE '%' || $${idx} || '%' OR LOWER(a.city_vi) LIKE '%' || $${idx} || '%' OR LOWER(a.name_en) LIKE '%' || $${idx} || '%' OR LOWER(a.name_vi) LIKE '%' || $${idx} || '%')`
    );
  }

  if (params.q && params.q.trim()) {
    values.push(`%${params.q.trim().toLowerCase()}%`);
    const idx = values.length;
    conditions.push(
      `(LOWER(COALESCE(l.published_title_en, '')) LIKE $${idx} OR LOWER(COALESCE(l.published_title_vi, '')) LIKE $${idx} OR LOWER(COALESCE(l.published_summary_en, '')) LIKE $${idx} OR LOWER(COALESCE(l.published_summary_vi, '')) LIKE $${idx} OR LOWER(a.name_en) LIKE $${idx} OR LOWER(a.name_vi) LIKE $${idx} OR LOWER(a.city_en) LIKE $${idx} OR LOWER(a.city_vi) LIKE $${idx})`
    );
  }

  if (params.guests && params.guests > 0) {
    values.push(params.guests);
    conditions.push(`l.max_guests >= $${values.length}`);
  }

  if (params.propertyType && params.propertyType.trim()) {
    values.push(params.propertyType.trim());
    conditions.push(`l.property_type = $${values.length}`);
  }

  if (params.amenity && params.amenity.trim()) {
    values.push(params.amenity.trim());
    conditions.push(
      `EXISTS (SELECT 1 FROM listing_amenities laf WHERE laf.listing_id = l.id AND laf.amenity_code = $${values.length})`
    );
  }

  if (params.lateCheckin) {
    conditions.push(`l.published_late_checkin_available = TRUE`);
  }

  if (nights && params.checkIn && params.checkOut) {
    values.push(params.checkIn);
    const checkInParamIdx = values.length;
    values.push(params.checkOut);
    const checkOutParamIdx = values.length;
    values.push(nights.length);
    const nightsCountIdx = values.length;

    conditions.push(`l.min_nights <= $${nightsCountIdx} AND l.max_nights >= $${nightsCountIdx}`);
    conditions.push(
      `NOT EXISTS (
        SELECT 1 FROM occupancy_nights occ
        WHERE occ.listing_id = l.id
          AND occ.night_date >= $${checkInParamIdx}::date
          AND occ.night_date < $${checkOutParamIdx}::date
      )`
    );
  }

  const whereClause = conditions.join(' AND ');

  const countRes = await dbQuery<{ total: string }>(
    `SELECT COUNT(*)::text AS total
     FROM listings l
     JOIN areas a ON a.id = l.area_id
     WHERE ${whereClause}`,
    values
  );
  const total = Number(countRes.rows[0]?.total ?? 0);

  const pagedValues = [...values, pageSize, offset];
  const limitIdx = values.length + 1;
  const offsetIdx = values.length + 2;

  const listRes = await dbQuery<{
    id: string;
    slug: string;
    published_title_en: string;
    published_title_vi: string | null;
    published_summary_en: string;
    published_summary_vi: string | null;
    property_type: PublicStayCard['propertyType'];
    area_slug: string;
    area_name_en: string;
    area_name_vi: string;
    city_en: string;
    city_vi: string;
    vibe_summary_en: string;
    vibe_summary_vi: string;
    max_guests: number;
    bedrooms: number;
    beds: number;
    bathrooms: string;
    base_nightly_rate_vnd: number;
    cleaning_fee_vnd: number;
    published_has_dedicated_desk: boolean;
    published_late_checkin_available: boolean;
    is_demo: boolean;
    cover_id: string | null;
    cover_url: string | null;
    cover_alt: string | null;
    cover_alt_vi: string | null;
    amenity_codes: string[] | null;
  }>(
    `SELECT l.id, l.slug,
            COALESCE(l.published_title_en, 'WorkingHome Residence') AS published_title_en,
            l.published_title_vi,
            COALESCE(l.published_summary_en, '') AS published_summary_en,
            l.published_summary_vi,
            l.property_type,
            a.slug AS area_slug, a.name_en AS area_name_en, a.name_vi AS area_name_vi,
            a.city_en, a.city_vi,
            a.vibe_summary_en, a.vibe_summary_vi,
            l.max_guests, l.bedrooms, l.beds, l.bathrooms::text AS bathrooms,
            l.base_nightly_rate_vnd, l.cleaning_fee_vnd,
            l.published_has_dedicated_desk, l.published_late_checkin_available,
            l.is_demo,
            cp.id AS cover_id,
            COALESCE(cp.public_url, cp.storage_path) AS cover_url,
            cp.alt_text_en AS cover_alt,
            cp.alt_text_vi AS cover_alt_vi,
            ARRAY(
              SELECT la.amenity_code FROM listing_amenities la
              WHERE la.listing_id = l.id
              ORDER BY la.amenity_code ASC
            ) AS amenity_codes
     FROM listings l
     JOIN areas a ON a.id = l.area_id
     LEFT JOIN LATERAL (
       SELECT p.id, p.public_url, p.storage_path, p.alt_text_en, p.alt_text_vi
       FROM listing_photos p
       WHERE p.listing_id = l.id AND p.is_draft = FALSE
       ORDER BY p.is_cover DESC, p.sort_order ASC, p.created_at ASC
       LIMIT 1
     ) cp ON TRUE
     WHERE ${whereClause}
     ORDER BY l.created_at ASC, l.id ASC
     LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    pagedValues
  );

  const overrideMap = new Map<string, Map<string, number>>();
  if (nights && params.checkIn && params.checkOut && listRes.rows.length > 0) {
    const ids = listRes.rows.map((r) => r.id);
    const rateRes = await dbQuery<{
      listing_id: string;
      night_date: string;
      nightly_rate_vnd: number;
    }>(
      `SELECT listing_id, night_date::text AS night_date, nightly_rate_vnd
       FROM nightly_rates
       WHERE listing_id = ANY($1::uuid[])
         AND night_date >= $2::date
         AND night_date < $3::date`,
      [ids, params.checkIn, params.checkOut]
    );
    for (const row of rateRes.rows) {
      let inner = overrideMap.get(row.listing_id);
      if (!inner) {
        inner = new Map<string, number>();
        overrideMap.set(row.listing_id, inner);
      }
      inner.set(row.night_date, Number(row.nightly_rate_vnd));
    }
  }

  const items: PublicStayCard[] = listRes.rows.map((r) => {
    const baseRate = Number(r.base_nightly_rate_vnd);
    const cleaningFee = Number(r.cleaning_fee_vnd);
    let stayTotalVnd: number | null = null;
    if (nights) {
      const listingOverrides = overrideMap.get(r.id);
      const accommodation = nights.reduce((sum, d) => {
        return sum + (listingOverrides?.get(d) ?? baseRate);
      }, 0);
      stayTotalVnd = accommodation + cleaningFee;
    }

    const titleVi = r.published_title_vi || r.published_title_en;
    const summaryVi = r.published_summary_vi || r.published_summary_en;

    return {
      id: r.id,
      slug: r.slug,
      titleEn: r.published_title_en,
      titleVi,
      summaryEn: r.published_summary_en,
      summaryVi,
      propertyType: r.property_type,
      areaSlug: r.area_slug,
      areaNameEn: r.area_name_en,
      areaNameVi: r.area_name_vi,
      cityEn: r.city_en,
      cityVi: r.city_vi,
      areaVibeEn: r.vibe_summary_en,
      areaVibeVi: r.vibe_summary_vi || r.vibe_summary_en,
      maxGuests: Number(r.max_guests),
      bedrooms: Number(r.bedrooms),
      beds: Number(r.beds),
      bathrooms: Number(r.bathrooms),
      baseNightlyRateVnd: baseRate,
      cleaningFeeVnd: cleaningFee,
      hasDedicatedDesk: Boolean(r.published_has_dedicated_desk),
      lateCheckinAvailable: Boolean(r.published_late_checkin_available),
      declaredAmenities: Array.isArray(r.amenity_codes) ? r.amenity_codes : [],
      coverPhoto: r.cover_id && r.cover_url
        ? {
            id: r.cover_id,
            url: r.cover_url,
            altTextEn: r.cover_alt || r.published_title_en,
            altTextVi: r.cover_alt_vi || r.cover_alt || titleVi,
            isCover: true,
            sortOrder: 0,
          }
        : null,
      isDemo: Boolean(r.is_demo),
      stayTotalVnd,
      nightsCount: nights ? nights.length : null,
    };
  });

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    appliedDates:
      nights && params.checkIn && params.checkOut
        ? { checkIn: params.checkIn, checkOut: params.checkOut, nightsCount: nights.length }
        : null,
  };
}

export async function getPublishedStayBySlug(
  slug: string
): Promise<PublicStayDetail | null> {
  // Explicit public column projection: never select exact_address, checkin_instructions_en, checkin_instructions_vi, or host_contact_phone
  const res = await dbQuery<{
    id: string;
    slug: string;
    published_title_en: string;
    published_title_vi: string | null;
    published_summary_en: string;
    published_summary_vi: string | null;
    published_description_en: string;
    published_description_vi: string | null;
    published_house_rules_en: string[];
    published_house_rules_vi: string[];
    published_has_dedicated_desk: boolean;
    published_workspace_notes_en: string | null;
    published_workspace_notes_vi: string | null;
    published_checkin_conditions_en: string;
    published_checkin_conditions_vi: string;
    published_late_checkin_available: boolean;
    property_type: PublicStayCard['propertyType'];
    area_slug: string;
    area_name_en: string;
    area_name_vi: string;
    city_en: string;
    city_vi: string;
    timezone: string;
    vibe_summary_en: string;
    vibe_summary_vi: string;
    walkability_note_en: string;
    walkability_note_vi: string;
    max_guests: number;
    bedrooms: number;
    beds: number;
    bathrooms: string;
    min_nights: number;
    max_nights: number;
    base_nightly_rate_vnd: number;
    cleaning_fee_vnd: number;
    cancellation_policy_version: string;
    payment_terms: string;
    payment_terms_details_en: string;
    payment_terms_details_vi: string;
    is_demo: boolean;
    host_display_name: string;
  }>(
    `SELECT l.id, l.slug,
            COALESCE(l.published_title_en, 'WorkingHome Residence') AS published_title_en,
            l.published_title_vi,
            COALESCE(l.published_summary_en, '') AS published_summary_en,
            l.published_summary_vi,
            COALESCE(l.published_description_en, '') AS published_description_en,
            l.published_description_vi,
            l.published_house_rules_en,
            l.published_house_rules_vi,
            l.published_has_dedicated_desk,
            l.published_workspace_notes_en,
            l.published_workspace_notes_vi,
            l.published_checkin_conditions_en,
            l.published_checkin_conditions_vi,
            l.published_late_checkin_available,
            l.property_type,
            a.slug AS area_slug, a.name_en AS area_name_en, a.name_vi AS area_name_vi,
            a.city_en, a.city_vi, a.timezone,
            a.vibe_summary_en, a.vibe_summary_vi,
            a.walkability_note_en, a.walkability_note_vi,
            l.max_guests, l.bedrooms, l.beds, l.bathrooms::text AS bathrooms,
            l.min_nights, l.max_nights,
            l.base_nightly_rate_vnd, l.cleaning_fee_vnd,
            l.cancellation_policy_version, l.payment_terms,
            l.payment_terms_details_en, l.payment_terms_details_vi,
            l.is_demo,
            p.display_name AS host_display_name
     FROM listings l
     JOIN areas a ON a.id = l.area_id
     JOIN profiles p ON p.id = l.host_id
     WHERE l.slug = $1
       AND l.status = 'published'
       AND a.is_published = TRUE`,
    [slug]
  );

  const row = res.rows[0];
  if (!row) return null;

  const photosRes = await dbQuery<{
    id: string;
    url: string;
    alt_text_en: string;
    alt_text_vi: string | null;
    is_cover: boolean;
    sort_order: number;
  }>(
    `SELECT id, COALESCE(public_url, storage_path) AS url, alt_text_en, alt_text_vi, is_cover, sort_order
     FROM listing_photos
     WHERE listing_id = $1 AND is_draft = FALSE
     ORDER BY is_cover DESC, sort_order ASC, created_at ASC`,
    [row.id]
  );

  const amenitiesRes = await dbQuery<{
    code: string;
    category: string;
    label_en: string;
    label_vi: string;
    icon_name: string;
    note_en: string | null;
  }>(
    `SELECT am.code, am.category, am.label_en, am.label_vi, am.icon_name, la.note_en
     FROM listing_amenities la
     JOIN amenities am ON am.code = la.amenity_code
     WHERE la.listing_id = $1
     ORDER BY am.category ASC, am.label_en ASC`,
    [row.id]
  );

  const today = getTodayIsoInTimezone(row.timezone);
  const windowEnd = addDaysIso(today, 90);
  const upcomingBlockedDates = await getBlockedDatesForListing(
    row.id,
    today,
    windowEnd
  );

  const titleVi = row.published_title_vi || row.published_title_en;

  const photos: PublicPhoto[] = photosRes.rows.map((p) => ({
    id: p.id,
    url: p.url,
    altTextEn: p.alt_text_en,
    altTextVi: p.alt_text_vi || p.alt_text_en || titleVi,
    isCover: Boolean(p.is_cover),
    sortOrder: Number(p.sort_order),
  }));

  const amenities: PublicAmenity[] = amenitiesRes.rows.map((a) => ({
    code: a.code,
    category: a.category,
    labelEn: a.label_en,
    labelVi: a.label_vi || a.label_en,
    iconName: a.icon_name,
    noteEn: a.note_en,
  }));

  const policyKey = (row.cancellation_policy_version in CANCELLATION_POLICIES
    ? row.cancellation_policy_version
    : 'flexible_24h') as CancellationPolicyVersion;

  const houseRulesEn = Array.isArray(row.published_house_rules_en)
    ? row.published_house_rules_en
    : [];
  const houseRulesViRaw = Array.isArray(row.published_house_rules_vi)
    ? row.published_house_rules_vi
    : [];

  return {
    id: row.id,
    slug: row.slug,
    titleEn: row.published_title_en,
    titleVi,
    summaryEn: row.published_summary_en,
    summaryVi: row.published_summary_vi || row.published_summary_en,
    descriptionEn: row.published_description_en,
    descriptionVi: row.published_description_vi || row.published_description_en,
    houseRulesEn,
    houseRulesVi: houseRulesViRaw.length > 0 ? houseRulesViRaw : houseRulesEn,
    propertyType: row.property_type,
    areaSlug: row.area_slug,
    areaNameEn: row.area_name_en,
    areaNameVi: row.area_name_vi,
    cityEn: row.city_en,
    cityVi: row.city_vi,
    timezone: row.timezone,
    areaVibeEn: row.vibe_summary_en,
    areaVibeVi: row.vibe_summary_vi || row.vibe_summary_en,
    walkabilityNoteEn: row.walkability_note_en,
    walkabilityNoteVi: row.walkability_note_vi || row.walkability_note_en,
    maxGuests: Number(row.max_guests),
    bedrooms: Number(row.bedrooms),
    beds: Number(row.beds),
    bathrooms: Number(row.bathrooms),
    minNights: Number(row.min_nights),
    maxNights: Number(row.max_nights),
    baseNightlyRateVnd: Number(row.base_nightly_rate_vnd),
    cleaningFeeVnd: Number(row.cleaning_fee_vnd),
    hasDedicatedDesk: Boolean(row.published_has_dedicated_desk),
    workspaceNotesEn: row.published_workspace_notes_en,
    workspaceNotesVi:
      row.published_workspace_notes_vi || row.published_workspace_notes_en,
    checkinConditionsEn: row.published_checkin_conditions_en,
    checkinConditionsVi:
      row.published_checkin_conditions_vi || row.published_checkin_conditions_en,
    lateCheckinAvailable: Boolean(row.published_late_checkin_available),
    declaredAmenities: amenities.map((a) => a.code),
    paymentTerms: row.payment_terms,
    paymentTermsDetailsEn: row.payment_terms_details_en,
    paymentTermsDetailsVi:
      row.payment_terms_details_vi || row.payment_terms_details_en,
    cancellationPolicy: CANCELLATION_POLICIES[policyKey],
    hostDisplayName: row.host_display_name,
    coverPhoto: photos[0] ?? null,
    photos,
    amenities,
    upcomingBlockedDates,
    isDemo: Boolean(row.is_demo),
    stayTotalVnd: null,
    nightsCount: null,
  };
}
