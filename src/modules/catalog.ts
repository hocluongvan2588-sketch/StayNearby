import { dbQuery, toNum } from '@/lib/db';
import {
  MIN_NIGHTS_TECHNICAL,
  POLICY_MIN_NIGHTS,
  clampHostMinNights,
} from '@/lib/business-rules';
import { addDaysIso, enumerateStayNights, getTodayIsoVietnam } from '@/lib/dates';
import type { Locale } from '@/lib/i18n';
import { calculateStayQuote } from '@/lib/pricing';
import { normalizeWifiStatus, toNumOrNull, type WifiStatus } from '@/lib/wifi-status';
import { parseHouseRules, type HostHouseRules } from '@/modules/host';
import { getPlatformFeeConfig, type PlatformFeeConfig } from '@/modules/platform-settings';

export interface CoworkingSpot {
  name: string;
  distanceKm: number;
  hasCallBooth: boolean;
  dayPassVnd: number;
  noteEn: string;
  noteVi: string;
}

export interface StayCardItem {
  id: string;
  slug: string;
  titleEn: string;
  titleVi: string;
  subtitleEn: string;
  subtitleVi: string;
  destinationSlug: string;
  destinationNameEn: string;
  destinationNameVi: string;
  neighborhoodEn: string;
  neighborhoodVi: string;
  propertyType: string;
  businessModel: 'booking_flow';
  isInstantBook: boolean;
  cancellationPolicy: 'flexible' | 'moderate' | 'strict';
  // NULL = chưa cập nhật (Phase A integrity — never default/derived values).
  wifiHasService: boolean | null;
  wifiDownloadMbps: number | null;
  wifiUploadMbps: number | null;
  wifiPingMs: number | null;
  wifiJitterMs: number | null;
  verificationTier: 'SELF_DECLARED' | 'HOST_VERIFIED' | 'VIETNOMAD_CERTIFIED';
  isWifiVerified: boolean;
  isWorkReady: boolean;
  verifiedAt: string;
  hasWorkspace: boolean;
  hasErgonomicChair: boolean;
  hasExternalMonitor: boolean;
  hasCallBooth: boolean;
  kitchenType: string;
  laundryType: string;
  petFriendly: boolean;
  googleRating: number;
  googleReviewCount: number;
  // Internal VietNomad guest reviews (preferred over Google on cards).
  guestReviewsAvg: number | null;
  guestReviewsCount: number;
  // Price of the stay the guest actually selected (search with dates);
  // null when no dates chosen -> show7-night and30-night prices instead.
  selectedStayNights: number | null;
  selectedStayTotalVnd: number | null;
  heroImage: string;
  mapX: number;
  mapY: number;
  isEntirePlace: boolean;
  bedrooms: number | null;
  bathrooms: number | null;
  areaSqm: number | null;
  bedsCount: number;
  maxGuests: number;
  nearestCoworking: CoworkingSpot | null;
  lifestyleSlugs: string[];
  // Calculated upfront display totals in VND (12% Booking Fee online + Host Net paid at check-in)
  weekDisplayVnd: number;
  monthDisplayVnd: number;
  weekFeeOnlineVnd: number;
  weekPayAtCheckinVnd: number;
  monthFeeOnlineVnd: number;
  monthPayAtCheckinVnd: number;
  compareMonthDisplayVnd: number | null;
  weekNightVnd: number;
  monthNightVnd: number;
  stayLongerSavingsPct: number;
  dealSavingsPct: number;
  isDealFeatured: boolean;
  dealMonthLabel: string;
  isFeatured: boolean;
  featuredRank: number;
}

export interface DestinationSummary {
  id: string;
  slug: string;
  nameEn: string;
  nameVi: string;
  regionEn: string;
  regionVi: string;
  taglineEn: string;
  taglineVi: string;
  climateEn: string;
  climateVi: string;
  visaSummaryEn: string;
  visaSummaryVi: string;
  visaDetailsEn: string;
  visaDetailsVi: string;
  monthlyCostUsd: number;
  avgWifiMbps: number;
  heroImage: string;
  mapX: number;
  mapY: number;
  liveStaysCount: number;
}

export interface LifestyleItem {
  id: string;
  slug: string;
  nameEn: string;
  nameVi: string;
  descriptionEn: string;
  descriptionVi: string;
  heroImage: string;
  staysCount: number;
}

export interface StayRoomDetail {
  id: string;
  nameEn: string;
  nameVi: string;
  descriptionEn: string;
  descriptionVi: string;
  maxGuests: number;
  bedsCount: number;
  bedrooms: number | null;
  bathrooms: number | null;
  areaSqm: number | null;
  unitsTotal: number;
  roomImage: string;
  roomFeatures: string[];
  icalUrl: string | null;
  icalLastSyncedAt: string | null;
  icalSyncStatus: string;
  packages: {
    id: string;
    nameEn: string;
    nameVi: string;
    descriptionEn: string;
    descriptionVi: string;
    validFrom: string;
    validTo: string;
    wholesale7Vnd: number;
    wholesale14Vnd: number;
    wholesale21Vnd: number;
    wholesale30Vnd: number;
    compare30Vnd: number | null;
    extraNightVnd: number;
    dealMonthLabel: string;
  }[];
  unavailableDates: string[];
  customPricesByDate: Record<string, number>;
  minNightsByDate: Record<string, number>;
}

export interface StayGuestReviewItem {
  id: string;
  guestName: string;
  rating: number;
  comment: string;
  hostReply: string | null;
  hostRepliedAt: string | null;
  createdAt: string;
  // Wi-Fi quality (Phase A): null = guest skipped Wi-Fi. Guest-rated
  // experience only — never a verification of host-declared Mbps.
  wifiSpeedRating: number | null;
  wifiStabilityRating: number | null;
  wifiWorkRating: number | null;
  wifiComment: string | null;
}

export interface LocalDiscoveryPlace {
  id: string;
  slug: string;
  name: string;
  category: string;
  address: string;
  lat: number | null;
  lng: number | null;
  priceRange: string;
  openingHours: string;
  descriptionEn: string;
  descriptionVi: string;
  imageUrl: string;
  neighborhoodNameEn: string | null;
  neighborhoodNameVi: string | null;
  partnerName?: string | null;
  partnerPerk?: string | null;
  verificationStatus: string;
  distanceLabel?: string;
  rating: number | null;
  reviewCount: number | null;
}

export interface DestinationNeighborhood {
  id: string;
  slug: string;
  nameEn: string;
  nameVi: string;
  summaryEn: string;
  summaryVi: string;
  guideEn: string;
  guideVi: string;
}

export interface DestinationLocalPartner {
  id: string;
  businessName: string;
  category: string;
  perkOffer: string;
  contractRef: string;
}

export interface StayDetail extends StayCardItem {
  hostId: string;
  hostName: string;
  hostNationality: string;
  hostWhatsapp: string;
  hostBioEn: string;
  hostBioVi: string;
  hostAvatarUrl: string;
  hostVerified: boolean;
  lat: number | null;
  lng: number | null;
  descriptionEn: string;
  descriptionVi: string;
  registrationCode: string;
  checkinFrom: string;
  checkoutBefore: string;
  defaultMinNights: number;
  houseRules: HostHouseRules;
  reviews: StayGuestReviewItem[];
  reviewsAvg: number | null;
  reviewsCount: number;
  wifiTestedAt: string | null;
  wifiTesterNote: string | null;
  wifiStatus: WifiStatus;
  speedtestProofUrl: string | null;
  // Guest Wi-Fi quality — kept separate from host-declared figures above.
  wifiGuestAvgRating: number | null;
  wifiGuestReviewCount: number;
  wifiGuestRecentBookingCount: number;
  wifiVerifiedByGuests: boolean;
  workspaceVideoUrl: string | null;
  workspaceSummaryEn: string;
  workspaceSummaryVi: string;
  workspacePhotoUrl: string;
  wheelchairFriendly: boolean;
  galleryImages: string[];
  amenities: string[];
  nearbyCoworking: CoworkingSpot[];
  localPlaces: LocalDiscoveryPlace[];
  rooms: StayRoomDetail[];
  destination: DestinationSummary;
}

function parseJsonArray<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function toNullablePositiveInt(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

function toNullableNumber(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function mapStayRowToCard(
  row: Record<string, unknown>,
  lifestyleSlugs: string[],
  feeConfig?: PlatformFeeConfig,
  selectedNights?: number
): StayCardItem {
  const pkgInput = {
    wholesale7Vnd: toNum(row.wholesale_7_vnd),
    wholesale14Vnd: toNum(row.wholesale_14_vnd),
    wholesale21Vnd: toNum(row.wholesale_21_vnd),
    wholesale30Vnd: toNum(row.wholesale_30_vnd),
    compare30Vnd: row.compare_30_vnd ? toNum(row.compare_30_vnd) : null,
    extraNightVnd: toNum(row.extra_night_vnd),
  };

  const serviceFeeRate = feeConfig?.serviceFeeRate ?? 0.12;
  const vatDiscountRate = feeConfig?.vatDiscountRate ?? 0.05;
  const premiumRewardRate = feeConfig?.premiumRewardRate ?? 0.04;

  const q7 = calculateStayQuote({
    pkg: pkgInput,
    nights: 7,
    businessModel: 'booking_flow',
    serviceFeeRate,
    vatDiscountRate,
    premiumRewardRate,
  });
  const q30 = calculateStayQuote({
    pkg: pkgInput,
    nights: 30,
    businessModel: 'booking_flow',
    serviceFeeRate,
    vatDiscountRate,
    premiumRewardRate,
  });

  const compareDisplay =
    pkgInput.compare30Vnd && pkgInput.compare30Vnd > pkgInput.wholesale30Vnd
      ? Math.round(pkgInput.compare30Vnd * (1 + serviceFeeRate))
      : null;

  // Price of the stay the guest selected in search (same pricing engine).
  const selectedQuote =
    selectedNights && selectedNights > 0
      ? calculateStayQuote({
          pkg: pkgInput,
          nights: selectedNights,
          serviceFeeRate,
          vatDiscountRate,
          premiumRewardRate,
        })
      : null;

  const dealSavingsPct =
    compareDisplay && compareDisplay > q30.guestTotalVnd
      ? Math.round(((compareDisplay - q30.guestTotalVnd) / compareDisplay) * 100)
      : 0;

  const coworking = parseJsonArray<CoworkingSpot>(row.nearby_coworking);
  const rawTier = String(row.verification_tier ?? 'SELF_DECLARED');
  const verificationTier: StayCardItem['verificationTier'] =
    rawTier === 'VIETNOMAD_CERTIFIED'
      ? 'VIETNOMAD_CERTIFIED'
      : rawTier === 'HOST_VERIFIED'
        ? 'HOST_VERIFIED'
        : 'SELF_DECLARED';
  const isWifiVerified =
    row.is_wifi_verified !== undefined && row.is_wifi_verified !== null
      ? Boolean(row.is_wifi_verified)
      : verificationTier === 'VIETNOMAD_CERTIFIED';
  const hasWorkspace =
    row.has_workspace !== undefined && row.has_workspace !== null
      ? Boolean(row.has_workspace)
      : true;
  const isWorkReady =
    row.is_work_ready !== undefined && row.is_work_ready !== null
      ? Boolean(row.is_work_ready)
      : isWifiVerified && hasWorkspace;

  return {
    id: String(row.id),
    slug: String(row.slug),
    titleEn: String(row.title_en),
    titleVi: String(row.title_vi),
    subtitleEn: String(row.subtitle_en),
    subtitleVi: String(row.subtitle_vi),
    destinationSlug: String(row.destination_slug),
    destinationNameEn: String(row.destination_name_en),
    destinationNameVi: String(row.destination_name_vi),
    neighborhoodEn: String(row.neighborhood_en),
    neighborhoodVi: String(row.neighborhood_vi),
    propertyType: String(row.property_type),
    businessModel: 'booking_flow',
    isInstantBook: Boolean(row.is_instant_book),
    cancellationPolicy: row.cancellation_policy as 'flexible' | 'moderate' | 'strict',
    wifiHasService:
      row.wifi_has_service === null || row.wifi_has_service === undefined
        ? null
        : Boolean(row.wifi_has_service),
    wifiDownloadMbps: toNumOrNull(row.wifi_download_mbps),
    wifiUploadMbps: toNumOrNull(row.wifi_upload_mbps),
    wifiPingMs: toNumOrNull(row.wifi_ping_ms),
    wifiJitterMs: toNumOrNull(row.wifi_jitter_ms),
    verificationTier,
    isWifiVerified,
    isWorkReady,
    verifiedAt: new Date(String(row.verified_at ?? row.wifi_tested_at ?? Date.now())).toISOString(),
    hasWorkspace,
    hasErgonomicChair: Boolean(row.has_ergonomic_chair),
    hasExternalMonitor: Boolean(row.has_external_monitor),
    hasCallBooth: Boolean(row.has_call_booth),
    kitchenType: String(row.kitchen_type),
    laundryType: String(row.laundry_type),
    petFriendly: Boolean(row.pet_friendly),
    googleRating: Number(row.google_rating ?? 4.8),
    googleReviewCount: toNum(row.google_review_count),
    guestReviewsAvg:
      row.guest_reviews_avg === null || row.guest_reviews_avg === undefined
        ? null
        : Number(toNum(row.guest_reviews_avg).toFixed(1)),
    guestReviewsCount: toNum(row.guest_reviews_count),
    selectedStayNights: selectedQuote && selectedNights ? selectedNights : null,
    selectedStayTotalVnd: selectedQuote ? selectedQuote.guestTotalVnd : null,
    heroImage: String(row.hero_image),
    mapX: Number(row.map_x ?? 50),
    mapY: Number(row.map_y ?? 50),
    isEntirePlace:
      row.is_entire_place !== undefined && row.is_entire_place !== null
        ? Boolean(row.is_entire_place)
        : row.property_type !== 'coliving',
    bedrooms: toNullablePositiveInt(row.bedrooms) ?? toNullablePositiveInt(row.room_bedrooms),
    bathrooms: toNullablePositiveInt(row.bathrooms) ?? toNullablePositiveInt(row.room_bathrooms),
    areaSqm: toNullablePositiveInt(row.area_sqm) ?? toNullablePositiveInt(row.room_area_sqm),
    bedsCount: toNum(row.beds_count, 1),
    maxGuests: toNum(row.max_guests, 2),
    nearestCoworking: coworking[0] ?? null,
    lifestyleSlugs,
    weekDisplayVnd: q7.guestTotalVnd,
    monthDisplayVnd: q30.guestTotalVnd,
    weekFeeOnlineVnd: q7.feeOnlineVnd,
    weekPayAtCheckinVnd: q7.payAtCheckinVnd,
    monthFeeOnlineVnd: q30.feeOnlineVnd,
    monthPayAtCheckinVnd: q30.payAtCheckinVnd,
    compareMonthDisplayVnd: compareDisplay,
    weekNightVnd: q7.perNightDisplayVnd,
    monthNightVnd: q30.perNightDisplayVnd,
    stayLongerSavingsPct: q30.weeklySavingsPct,
    dealSavingsPct,
    isDealFeatured: Boolean(row.is_deal_featured),
    dealMonthLabel: String(row.deal_month_label ?? 'December'),
    isFeatured: Boolean(row.is_featured),
    featuredRank: toNum(row.featured_rank, 100),
  };
}

export async function getDestinations(): Promise<DestinationSummary[]> {
  const res = await dbQuery(
    `SELECT d.*, COUNT(s.id) FILTER (WHERE s.status = 'live') AS live_stays_count
     FROM destinations d
     LEFT JOIN stays s ON s.destination_id = d.id
     GROUP BY d.id
     ORDER BY d.monthly_cost_usd ASC, d.name_en ASC`
  );

  return res.rows.map((r) => ({
    id: String(r.id),
    slug: String(r.slug),
    nameEn: String(r.name_en),
    nameVi: String(r.name_vi),
    regionEn: String(r.region_en),
    regionVi: String(r.region_vi),
    taglineEn: String(r.tagline_en),
    taglineVi: String(r.tagline_vi),
    climateEn: String(r.climate_en),
    climateVi: String(r.climate_vi),
    visaSummaryEn: String(r.visa_summary_en),
    visaSummaryVi: String(r.visa_summary_vi),
    visaDetailsEn: String(r.visa_details_en),
    visaDetailsVi: String(r.visa_details_vi),
    monthlyCostUsd: toNum(r.monthly_cost_usd),
    avgWifiMbps: toNum(r.avg_wifi_mbps),
    heroImage: String(r.hero_image),
    mapX: Number(r.map_x),
    mapY: Number(r.map_y),
    liveStaysCount: toNum(r.live_stays_count),
  }));
}

export async function getLifestyles(): Promise<LifestyleItem[]> {
  const res = await dbQuery(
    `SELECT l.*, COUNT(DISTINCT sl.stay_id) AS stays_count
     FROM lifestyles l
     LEFT JOIN stay_lifestyles sl ON sl.lifestyle_id = l.id
     GROUP BY l.id
     ORDER BY stays_count DESC, l.name_en ASC`
  );

  return res.rows.map((r) => ({
    id: String(r.id),
    slug: String(r.slug),
    nameEn: String(r.name_en),
    nameVi: String(r.name_vi),
    descriptionEn: String(r.description_en),
    descriptionVi: String(r.description_vi),
    heroImage: String(r.hero_image),
    staysCount: toNum(r.stays_count),
  }));
}

export interface SearchStaysFilter {
  destination?: string;
  lifestyle?: string;
  checkIn?: string;
  nights?: number;
  minWifiMbps?: number;
  hasWorkspace?: boolean;
  hasErgonomicChair?: boolean;
  hasMonitor?: boolean;
  hasCallBooth?: boolean;
  fullKitchen?: boolean;
  inUnitLaundry?: boolean;
  petFriendly?: boolean;
  wifiVerifiedOnly?: boolean;
  workReadyOnly?: boolean;
  maxMonthlyVnd?: number;
  sort?: 'featured' | 'wifi_desc' | 'price_asc' | 'savings_desc' | 'rating_desc';
}

/** Wi-Fi sort rank: NULL (chưa cập nhật) always sorts last. */
function wifiRank(s: StayCardItem): number {
  return s.wifiDownloadMbps ?? -1;
}

export async function searchStays(filters: SearchStaysFilter = {}): Promise<StayCardItem[]> {
  const [res, feeConfig] = await Promise.all([
    dbQuery(
      `SELECT s.*,
              d.slug AS destination_slug, d.name_en AS destination_name_en, d.name_vi AS destination_name_vi,
              r.id AS default_room_id, r.beds_count, r.max_guests, r.units_total,
              r.bedrooms AS room_bedrooms, r.bathrooms AS room_bathrooms, r.area_sqm AS room_area_sqm,
              p.wholesale_7_vnd, p.wholesale_14_vnd, p.wholesale_21_vnd, p.wholesale_30_vnd,
              p.compare_30_vnd, p.extra_night_vnd, p.is_deal_featured, p.deal_month_label,
              p.valid_from, p.valid_to,
              rv.avg_rating AS guest_reviews_avg, rv.review_count AS guest_reviews_count
       FROM stays s
       JOIN destinations d ON d.id = s.destination_id
       JOIN LATERAL (
         SELECT * FROM stay_rooms sr WHERE sr.stay_id = s.id ORDER BY sr.max_guests DESC LIMIT 1
       ) r ON TRUE
       JOIN LATERAL (
         SELECT * FROM stay_packages sp WHERE sp.stay_id = s.id AND sp.is_listed = TRUE ORDER BY sp.wholesale_30_vnd ASC LIMIT 1
       ) p ON TRUE
       LEFT JOIN LATERAL (
         SELECT avg(sr2.rating)::numeric AS avg_rating, count(*)::int AS review_count
         FROM stay_reviews sr2 WHERE sr2.stay_id = s.id
       ) rv ON TRUE
       WHERE s.status = 'live'`
    ),
    getPlatformFeeConfig(),
  ]);

  const lifestyleRows = await dbQuery<{ stay_id: string; slug: string }>(
    `SELECT sl.stay_id, l.slug
     FROM stay_lifestyles sl
     JOIN lifestyles l ON l.id = sl.lifestyle_id`
  );
  const lsMap = new Map<string, string[]>();
  for (const row of lifestyleRows.rows) {
    const arr = lsMap.get(row.stay_id) ?? [];
    arr.push(row.slug);
    lsMap.set(row.stay_id, arr);
  }

  // If checkIn + nights provided, filter out stays whose rooms have zero units left on any requested night
  const unavailableRoomIds = new Set<string>();
  if (filters.checkIn && filters.nights && filters.nights >= MIN_NIGHTS_TECHNICAL) {
    const checkOut = addDaysIso(filters.checkIn, filters.nights);
    const stayDates = enumerateStayNights(filters.checkIn, checkOut);
    if (stayDates.length > 0) {
      const locksRes = await dbQuery<{
        room_id: string;
        units_total: number;
        booked_units: number;
        blocked_units: number;
      }>(
        `SELECT rnl.room_id, sr.units_total, rnl.booked_units, rnl.blocked_units
         FROM room_night_locks rnl
         JOIN stay_rooms sr ON sr.id = rnl.room_id
         WHERE rnl.stay_date >= $1::date AND rnl.stay_date < $2::date`,
        [filters.checkIn, checkOut]
      );
      for (const lock of locksRes.rows) {
        if (toNum(lock.booked_units) + toNum(lock.blocked_units) >= toNum(lock.units_total)) {
          unavailableRoomIds.add(lock.room_id);
        }
      }
    }
  }

  let items = res.rows
    .filter((r) => !unavailableRoomIds.has(String(r.default_room_id)))
    .map((r) =>
      mapStayRowToCard(r, lsMap.get(String(r.id)) ?? [], feeConfig, filters.nights)
    );

  if (filters.destination && filters.destination !== 'all') {
    items = items.filter((s) => s.destinationSlug === filters.destination);
  }
  if (filters.lifestyle && filters.lifestyle !== 'all') {
    items = items.filter((s) => s.lifestyleSlugs.includes(filters.lifestyle!));
  }
  if (filters.minWifiMbps && filters.minWifiMbps > 0) {
    // Only real declared/measured values — NULL (chưa cập nhật) never matches.
    items = items.filter(
      (s) => s.wifiDownloadMbps !== null && s.wifiDownloadMbps >= filters.minWifiMbps!
    );
  }
  if (filters.hasWorkspace) {
    items = items.filter((s) => s.hasWorkspace);
  }
  if (filters.hasErgonomicChair) {
    items = items.filter((s) => s.hasErgonomicChair);
  }
  if (filters.hasMonitor) {
    items = items.filter((s) => s.hasExternalMonitor);
  }
  if (filters.hasCallBooth) {
    items = items.filter((s) => s.hasCallBooth || Boolean(s.nearestCoworking?.hasCallBooth));
  }
  if (filters.fullKitchen) {
    items = items.filter((s) => s.kitchenType === 'full');
  }
  if (filters.inUnitLaundry) {
    items = items.filter((s) => s.laundryType === 'in_unit');
  }
  if (filters.petFriendly) {
    items = items.filter((s) => s.petFriendly);
  }
  if (filters.wifiVerifiedOnly) {
    items = items.filter((s) => s.isWifiVerified);
  }
  if (filters.workReadyOnly) {
    items = items.filter((s) => s.isWorkReady);
  }
  if (filters.maxMonthlyVnd && filters.maxMonthlyVnd > 0) {
    items = items.filter((s) => s.monthDisplayVnd <= filters.maxMonthlyVnd!);
  }

  const sortBy = filters.sort ?? 'featured';
  items.sort((a, b) => {
    if (sortBy === 'price_asc') return a.monthDisplayVnd - b.monthDisplayVnd;
    if (sortBy === 'savings_desc')
      return b.dealSavingsPct + b.stayLongerSavingsPct - (a.dealSavingsPct + a.stayLongerSavingsPct);
    if (sortBy === 'rating_desc') return b.googleRating - a.googleRating;
    if (sortBy === 'wifi_desc') return wifiRank(b) - wifiRank(a);
    if (a.isFeatured !== b.isFeatured) return a.isFeatured ? -1 : 1;
    if (a.featuredRank !== b.featuredRank) return a.featuredRank - b.featuredRank;
    return wifiRank(b) - wifiRank(a);
  });

  return items;
}

export async function getStayDetailBySlug(slug: string): Promise<StayDetail | null> {
  const [stayRes, feeConfig] = await Promise.all([
    dbQuery(
      `SELECT s.*,
              u.id AS host_user_id, u.full_name AS host_name, u.nationality AS host_nationality,
              u.avatar_url AS user_avatar_url, u.bio_en AS user_bio_en, u.bio_vi AS user_bio_vi,
              u.identity_verified AS user_identity_verified,
              d.id AS d_id, d.slug AS destination_slug, d.name_en AS destination_name_en,
              d.name_vi AS destination_name_vi, d.region_en, d.region_vi,
              d.tagline_en, d.tagline_vi, d.climate_en, d.climate_vi,
              d.visa_summary_en, d.visa_summary_vi, d.visa_details_en, d.visa_details_vi,
              d.monthly_cost_usd, d.avg_wifi_mbps, d.hero_image AS dest_hero_image,
              d.map_x AS dest_map_x, d.map_y AS dest_map_y,
              r.beds_count, r.max_guests, r.bedrooms AS room_bedrooms, r.bathrooms AS room_bathrooms, r.area_sqm AS room_area_sqm,
              p.wholesale_7_vnd, p.wholesale_14_vnd, p.wholesale_21_vnd, p.wholesale_30_vnd,
              p.compare_30_vnd, p.extra_night_vnd, p.is_deal_featured, p.deal_month_label
       FROM stays s
       JOIN users u ON u.id = s.host_id
       JOIN destinations d ON d.id = s.destination_id
       LEFT JOIN LATERAL (
         SELECT * FROM stay_rooms sr WHERE sr.stay_id = s.id ORDER BY sr.max_guests DESC LIMIT 1
       ) r ON TRUE
       LEFT JOIN LATERAL (
         SELECT * FROM stay_packages sp WHERE sp.stay_id = s.id AND sp.is_listed = TRUE ORDER BY sp.wholesale_30_vnd ASC LIMIT 1
       ) p ON TRUE
       WHERE s.slug = $1`,
      [slug]
    ),
    getPlatformFeeConfig(),
  ]);

  const row = stayRes.rows[0];
  if (!row) return null;

  const lsRes = await dbQuery<{ slug: string }>(
    `SELECT l.slug FROM stay_lifestyles sl JOIN lifestyles l ON l.id = sl.lifestyle_id WHERE sl.stay_id = $1`,
    [row.id]
  );
  const card = mapStayRowToCard(
    row,
    lsRes.rows.map((x) => x.slug),
    feeConfig
  );

  const roomsRes = await dbQuery(
    `SELECT * FROM stay_rooms WHERE stay_id = $1 ORDER BY max_guests ASC`,
    [row.id]
  );

  const pkgsRes = await dbQuery(
    `SELECT * FROM stay_packages WHERE stay_id = $1 AND is_listed = TRUE ORDER BY wholesale_30_vnd ASC`,
    [row.id]
  );

  const today = getTodayIsoVietnam();
  const horizon = addDaysIso(today, 90);
  const [locksRes, reviewsRes, placesRes] = await Promise.all([
    dbQuery<{
      room_id: string;
      stay_date: string | Date;
      booked_units: number;
      blocked_units: number;
      custom_nightly_vnd: string | number | null;
      min_nights: number | null;
    }>(
      `SELECT room_id, stay_date, booked_units, blocked_units, custom_nightly_vnd, min_nights
       FROM room_night_locks
       WHERE room_id = ANY($1::uuid[]) AND stay_date >= $2::date AND stay_date <= $3::date`,
      [roomsRes.rows.map((rm) => String(rm.id)), today, horizon]
    ),
    dbQuery<{
      id: string;
      guest_name: string;
      rating: number;
      comment: string;
      host_reply: string | null;
      host_replied_at: string | Date | null;
      created_at: string | Date;
      wifi_speed_rating: number | null;
      wifi_stability_rating: number | null;
      wifi_work_rating: number | null;
      wifi_comment: string | null;
    }>(
      `SELECT sr.id,
              COALESCE(u.full_name, 'Verified Guest') AS guest_name,
              sr.rating,
              sr.comment,
              sr.host_reply,
              sr.host_replied_at,
              sr.created_at,
              sr.wifi_speed_rating,
              sr.wifi_stability_rating,
              sr.wifi_work_rating,
              sr.wifi_comment
       FROM stay_reviews sr
       LEFT JOIN users u ON u.id = sr.guest_id
       WHERE sr.stay_id = $1
       ORDER BY sr.created_at DESC`,
      [row.id]
    ),
    dbQuery<{
      id: string;
      slug: string;
      name: string;
      category: string;
      address: string;
      lat: string | number | null;
      lng: string | number | null;
      price_range: string;
      opening_hours: string;
      description_en: string;
      description_vi: string;
      image_url: string;
      verification_status: string;
      neighborhood_name_en: string | null;
      neighborhood_name_vi: string | null;
      partner_name: string | null;
      partner_perk: string | null;
      distance_label: string | null;
      rating: string | number | null;
      review_count: number | null;
    }>(
      `SELECT p.id, p.slug, p.name, p.category, p.address, p.lat, p.lng,
              p.price_range, p.opening_hours,
              p.description_en, p.description_vi, p.image_url, p.verification_status,
              p.rating, p.review_count,
              n.name_en AS neighborhood_name_en, n.name_vi AS neighborhood_name_vi,
              CASE WHEN lp.partnership_status = 'active' THEN lp.business_name ELSE NULL END AS partner_name,
              CASE WHEN lp.partnership_status = 'active' THEN lp.perk_offer ELSE NULL END AS partner_perk,
              snp.distance_label
       FROM places p
       LEFT JOIN neighborhoods n ON n.id = p.neighborhood_id
       LEFT JOIN local_partners lp ON lp.id = p.partner_id
       LEFT JOIN stay_nearby_places snp ON snp.place_id = p.id AND snp.stay_id = $1
       WHERE p.destination_id = $2 AND p.verification_status = 'verified'
       ORDER BY (snp.place_id IS NOT NULL) DESC, p.is_featured DESC, p.name ASC
       LIMIT 24`,
      [row.id, row.d_id]
    ).catch(() => ({ rows: [] })),
  ]);

  const localPlaces: LocalDiscoveryPlace[] = placesRes.rows.map((p) => ({
    id: String(p.id),
    slug: String(p.slug),
    name: String(p.name),
    category: String(p.category),
    address: String(p.address ?? ''),
    lat: toNullableNumber(p.lat),
    lng: toNullableNumber(p.lng),
    priceRange: String(p.price_range ?? '$$'),
    openingHours: String(p.opening_hours ?? ''),
    descriptionEn: String(p.description_en ?? ''),
    descriptionVi: String(p.description_vi ?? ''),
    imageUrl: String(p.image_url ?? ''),
    neighborhoodNameEn: p.neighborhood_name_en ? String(p.neighborhood_name_en) : null,
    neighborhoodNameVi: p.neighborhood_name_vi ? String(p.neighborhood_name_vi) : null,
    partnerName: p.partner_name ? String(p.partner_name) : null,
    partnerPerk: p.partner_perk ? String(p.partner_perk) : null,
    verificationStatus: String(p.verification_status ?? 'verified'),
    distanceLabel: p.distance_label ? String(p.distance_label) : undefined,
    rating: toNullableNumber(p.rating),
    reviewCount: toNullablePositiveInt(p.review_count),
  }));

  const rooms: StayRoomDetail[] = roomsRes.rows.map((rm) => {
    const unitsTotal = toNum(rm.units_total, 1);
    const roomLocks = locksRes.rows.filter((l) => l.room_id === String(rm.id));
    const unavailableDates = roomLocks
      .filter((l) => toNum(l.booked_units) + toNum(l.blocked_units) >= unitsTotal)
      .map((l) =>
        l.stay_date instanceof Date
          ? l.stay_date.toISOString().slice(0, 10)
          : String(l.stay_date).slice(0, 10)
      );

    const customPricesByDate: Record<string, number> = {};
    const minNightsByDate: Record<string, number> = {};
    for (const l of roomLocks) {
      const iso =
        l.stay_date instanceof Date
          ? l.stay_date.toISOString().slice(0, 10)
          : String(l.stay_date).slice(0, 10);
      if (l.custom_nightly_vnd !== null && l.custom_nightly_vnd !== undefined) {
        const val = toNum(l.custom_nightly_vnd);
        if (val > 0) customPricesByDate[iso] = val;
      }
      if (l.min_nights !== null && l.min_nights !== undefined) {
        const mn = toNum(l.min_nights);
        if (mn > 0) minNightsByDate[iso] = mn;
      }
    }

    const roomPackages = pkgsRes.rows
      .filter((p) => String(p.room_id) === String(rm.id))
      .map((p) => ({
        id: String(p.id),
        nameEn: String(p.name_en),
        nameVi: String(p.name_vi),
        descriptionEn: String(p.description_en),
        descriptionVi: String(p.description_vi),
        validFrom:
          p.valid_from instanceof Date
            ? p.valid_from.toISOString().slice(0, 10)
            : String(p.valid_from).slice(0, 10),
        validTo:
          p.valid_to instanceof Date
            ? p.valid_to.toISOString().slice(0, 10)
            : String(p.valid_to).slice(0, 10),
        wholesale7Vnd: toNum(p.wholesale_7_vnd),
        wholesale14Vnd: toNum(p.wholesale_14_vnd),
        wholesale21Vnd: toNum(p.wholesale_21_vnd),
        wholesale30Vnd: toNum(p.wholesale_30_vnd),
        compare30Vnd: p.compare_30_vnd ? toNum(p.compare_30_vnd) : null,
        extraNightVnd: toNum(p.extra_night_vnd),
        dealMonthLabel: String(p.deal_month_label ?? 'Next Month'),
      }));

    return {
      id: String(rm.id),
      nameEn: String(rm.name_en),
      nameVi: String(rm.name_vi),
      descriptionEn: String(rm.description_en),
      descriptionVi: String(rm.description_vi),
      maxGuests: toNum(rm.max_guests, 2),
      bedsCount: toNum(rm.beds_count, 1),
      bedrooms: toNullablePositiveInt(rm.bedrooms),
      bathrooms: toNullablePositiveInt(rm.bathrooms),
      areaSqm: toNullablePositiveInt(rm.area_sqm),
      unitsTotal,
      roomImage: String(rm.room_image),
      roomFeatures: parseJsonArray<string>(rm.room_features),
      icalUrl: rm.ical_url ? String(rm.ical_url) : null,
      icalLastSyncedAt: rm.ical_last_synced_at
        ? new Date(String(rm.ical_last_synced_at)).toISOString()
        : null,
      icalSyncStatus: String(rm.ical_sync_status ?? 'idle'),
      packages: roomPackages,
      unavailableDates,
      customPricesByDate,
      minNightsByDate,
    };
  });

  const reviews: StayGuestReviewItem[] = reviewsRes.rows.map((rv) => ({
    id: String(rv.id),
    guestName: String(rv.guest_name),
    rating: toNum(rv.rating, 5),
    comment: String(rv.comment),
    hostReply: rv.host_reply ? String(rv.host_reply) : null,
    hostRepliedAt: rv.host_replied_at
      ? new Date(String(rv.host_replied_at)).toISOString()
      : null,
    createdAt: new Date(String(rv.created_at)).toISOString(),
    wifiSpeedRating: toNullablePositiveInt(rv.wifi_speed_rating),
    wifiStabilityRating: toNullablePositiveInt(rv.wifi_stability_rating),
    wifiWorkRating: toNullablePositiveInt(rv.wifi_work_rating),
    wifiComment: rv.wifi_comment ? String(rv.wifi_comment) : null,
  }));

  const reviewsCount = reviews.length;
  const reviewsAvg =
    reviewsCount > 0
      ? Number(
          (reviews.reduce((s, r) => s + r.rating, 0) / reviewsCount).toFixed(2)
        )
      : null;

  // Guest Wi-Fi quality — displayed as its own block, never merged with the
  // host-declared figures. "Verified by Guests" needs ALL of:
  //   1. ≥5 distinct completed bookings with Wi-Fi ratings in the last 90 days
  //   2. average ≥4.5/5 over those recent ratings
  //   3. no unresolved high/urgent Wi-Fi complaint ticket
  //   (the 90-day window is condition 1+2's data window)
  const wifiStatsRes = await dbQuery<{
    review_count: number;
    booking_count: number;
    avg_rating: string | number | null;
    recent_booking_count: number;
    recent_avg_rating: string | number | null;
    has_open_complaint: boolean;
  }>(
    `WITH wifi_reviews AS (
       SELECT r.booking_id,
              r.created_at,
              (COALESCE(r.wifi_speed_rating, 0) + COALESCE(r.wifi_stability_rating, 0) + COALESCE(r.wifi_work_rating, 0))::numeric /
                NULLIF(
                  (CASE WHEN r.wifi_speed_rating IS NOT NULL THEN 1 ELSE 0 END +
                   CASE WHEN r.wifi_stability_rating IS NOT NULL THEN 1 ELSE 0 END +
                   CASE WHEN r.wifi_work_rating IS NOT NULL THEN 1 ELSE 0 END), 0
                ) AS review_avg
       FROM stay_reviews r
       WHERE r.stay_id = $1
         AND (r.wifi_speed_rating IS NOT NULL
           OR r.wifi_stability_rating IS NOT NULL
           OR r.wifi_work_rating IS NOT NULL)
     ),
     agg AS (
       SELECT count(*)::int AS review_count,
              count(DISTINCT r.booking_id)::int AS booking_count,
              avg(r.review_avg)::numeric AS avg_rating,
              count(*) FILTER (WHERE r.created_at >= NOW() - INTERVAL '90 days')::int AS recent_count,
              count(DISTINCT r.booking_id) FILTER (WHERE r.created_at >= NOW() - INTERVAL '90 days')::int AS recent_booking_count,
              avg(r.review_avg) FILTER (WHERE r.created_at >= NOW() - INTERVAL '90 days')::numeric AS recent_avg_rating
       FROM wifi_reviews r
     )
     SELECT agg.review_count,
            agg.booking_count,
            agg.avg_rating,
            agg.recent_booking_count,
            agg.recent_avg_rating,
            EXISTS (
              SELECT 1 FROM support_tickets t
              WHERE t.stay_id = $1
                AND t.category = 'listing_accuracy'
                AND t.issue_sub_category IN ('wifi_speed_mismatch', 'wifi_or_property_issue')
                AND t.priority IN ('high', 'urgent')
                AND t.status NOT IN ('resolved', 'closed')
            ) AS has_open_complaint
     FROM agg`,
    [row.id]
  );
  const wifiStats = wifiStatsRes.rows[0];
  const wifiGuestReviewCount = wifiStats ? toNum(wifiStats.review_count) : 0;
  const wifiGuestAvgRating =
    wifiStats && wifiStats.avg_rating !== null && wifiGuestReviewCount > 0
      ? Number(toNum(wifiStats.avg_rating).toFixed(1))
      : null;
  const wifiGuestRecentBookingCount = wifiStats ? toNum(wifiStats.recent_booking_count) : 0;
  const wifiVerifiedByGuests = Boolean(
    wifiStats &&
      wifiGuestRecentBookingCount >= 5 &&
      wifiStats.recent_avg_rating !== null &&
      toNum(wifiStats.recent_avg_rating) >= 4.5 &&
      !wifiStats.has_open_complaint
  );

  return {
    ...card,
    hostId: String(row.host_user_id ?? row.host_id),
    hostName: String(row.host_name),
    hostNationality: String(row.host_nationality),
    hostWhatsapp: String(row.host_whatsapp ?? '+84901234567'),
    hostBioEn: String(row.host_bio_en || row.user_bio_en || ''),
    hostBioVi: String(row.host_bio_vi || row.user_bio_vi || ''),
    hostAvatarUrl: String(row.host_avatar_url || row.user_avatar_url || ''),
    hostVerified: Boolean(row.host_verified) || Boolean(row.user_identity_verified),
    lat: toNullableNumber(row.lat),
    lng: toNullableNumber(row.lng),
    descriptionEn: String(row.description_en),
    descriptionVi: String(row.description_vi),
    registrationCode: String(row.registration_code ?? ''),
    checkinFrom: String(row.checkin_from ?? '14:00'),
    checkoutBefore: String(row.checkout_before ?? '12:00'),
    defaultMinNights: clampHostMinNights(toNum(row.default_min_nights, POLICY_MIN_NIGHTS)),
    houseRules: parseHouseRules(row.house_rules),
    reviews,
    reviewsAvg,
    reviewsCount,
    wifiTestedAt: row.wifi_tested_at
      ? new Date(String(row.wifi_tested_at)).toISOString()
      : null,
    wifiTesterNote: row.wifi_tester_note ? String(row.wifi_tester_note) : null,
    wifiStatus: normalizeWifiStatus(row.wifi_status),
    speedtestProofUrl: row.speedtest_proof_url ? String(row.speedtest_proof_url) : null,
    wifiGuestAvgRating,
    wifiGuestReviewCount,
    wifiGuestRecentBookingCount,
    wifiVerifiedByGuests,
    workspaceVideoUrl: row.workspace_video_url ? String(row.workspace_video_url) : null,
    workspaceSummaryEn: String(row.workspace_summary_en),
    workspaceSummaryVi: String(row.workspace_summary_vi),
    workspacePhotoUrl: String(row.workspace_photo_url),
    wheelchairFriendly: Boolean(row.wheelchair_friendly),
    galleryImages: parseJsonArray<string>(row.gallery_images),
    amenities: parseJsonArray<string>(row.amenities),
    nearbyCoworking: parseJsonArray<CoworkingSpot>(row.nearby_coworking),
    localPlaces,
    rooms,
    destination: {
      id: String(row.d_id),
      slug: String(row.destination_slug),
      nameEn: String(row.destination_name_en),
      nameVi: String(row.destination_name_vi),
      regionEn: String(row.region_en),
      regionVi: String(row.region_vi),
      taglineEn: String(row.tagline_en),
      taglineVi: String(row.tagline_vi),
      climateEn: String(row.climate_en),
      climateVi: String(row.climate_vi),
      visaSummaryEn: String(row.visa_summary_en),
      visaSummaryVi: String(row.visa_summary_vi),
      visaDetailsEn: String(row.visa_details_en),
      visaDetailsVi: String(row.visa_details_vi),
      monthlyCostUsd: toNum(row.monthly_cost_usd),
      avgWifiMbps: toNum(row.avg_wifi_mbps),
      heroImage: String(row.dest_hero_image),
      mapX: Number(row.dest_map_x),
      mapY: Number(row.dest_map_y),
      liveStaysCount: 1,
    },
  };
}

export async function getDestinationLocalPlaces(destinationSlug: string): Promise<LocalDiscoveryPlace[]> {
  try {
    const res = await dbQuery<{
      id: string;
      slug: string;
      name: string;
      category: string;
      address: string;
      lat: string | number | null;
      lng: string | number | null;
      price_range: string;
      opening_hours: string;
      description_en: string;
      description_vi: string;
      image_url: string;
      verification_status: string;
      rating: string | number | null;
      review_count: number | null;
      neighborhood_name_en: string | null;
      neighborhood_name_vi: string | null;
      partner_name: string | null;
      partner_perk: string | null;
    }>(
      `SELECT p.id, p.slug, p.name, p.category, p.address, p.lat, p.lng, p.price_range, p.opening_hours,
              p.description_en, p.description_vi, p.image_url, p.verification_status,
              p.rating, p.review_count,
              n.name_en AS neighborhood_name_en, n.name_vi AS neighborhood_name_vi,
              CASE WHEN lp.partnership_status = 'active' THEN lp.business_name ELSE NULL END AS partner_name,
              CASE WHEN lp.partnership_status = 'active' THEN lp.perk_offer ELSE NULL END AS partner_perk
       FROM places p
       JOIN destinations d ON d.id = p.destination_id
       LEFT JOIN neighborhoods n ON n.id = p.neighborhood_id
       LEFT JOIN local_partners lp ON lp.id = p.partner_id
       WHERE d.slug = $1 AND p.verification_status = 'verified'
       ORDER BY p.is_featured DESC, p.category ASC, p.name ASC`,
      [destinationSlug]
    );
    return res.rows.map((p) => ({
      id: String(p.id),
      slug: String(p.slug),
      name: String(p.name),
      category: String(p.category),
      address: String(p.address ?? ''),
      lat: toNullableNumber(p.lat),
      lng: toNullableNumber(p.lng),
      priceRange: String(p.price_range ?? '$$'),
      openingHours: String(p.opening_hours ?? ''),
      descriptionEn: String(p.description_en ?? ''),
      descriptionVi: String(p.description_vi ?? ''),
      imageUrl: String(p.image_url ?? ''),
      neighborhoodNameEn: p.neighborhood_name_en ? String(p.neighborhood_name_en) : null,
      neighborhoodNameVi: p.neighborhood_name_vi ? String(p.neighborhood_name_vi) : null,
      partnerName: p.partner_name ? String(p.partner_name) : null,
      partnerPerk: p.partner_perk ? String(p.partner_perk) : null,
      verificationStatus: String(p.verification_status ?? 'verified'),
      rating: toNullableNumber(p.rating),
      reviewCount: toNullablePositiveInt(p.review_count),
    }));
  } catch {
    return [];
  }
}

export async function getDestinationNeighborhoods(
  destinationSlug: string
): Promise<DestinationNeighborhood[]> {
  try {
    const res = await dbQuery<{
      id: string;
      slug: string;
      name_en: string;
      name_vi: string;
      summary_en: string;
      summary_vi: string;
      guide_en: string;
      guide_vi: string;
    }>(
      `SELECT n.id, n.slug, n.name_en, n.name_vi, n.summary_en, n.summary_vi, n.guide_en, n.guide_vi
       FROM neighborhoods n
       JOIN destinations d ON d.id = n.destination_id
       WHERE d.slug = $1
       ORDER BY n.name_en ASC`,
      [destinationSlug]
    );
    return res.rows.map((n) => ({
      id: String(n.id),
      slug: String(n.slug),
      nameEn: String(n.name_en),
      nameVi: String(n.name_vi),
      summaryEn: String(n.summary_en ?? ''),
      summaryVi: String(n.summary_vi ?? ''),
      guideEn: String(n.guide_en ?? ''),
      guideVi: String(n.guide_vi ?? ''),
    }));
  } catch {
    return [];
  }
}

export async function getDestinationLocalPartners(
  destinationSlug: string
): Promise<DestinationLocalPartner[]> {
  try {
    const res = await dbQuery<{
      id: string;
      business_name: string;
      category: string;
      perk_offer: string;
      contract_ref: string;
    }>(
      `SELECT lp.id, lp.business_name, lp.category, lp.perk_offer, lp.contract_ref
       FROM local_partners lp
       JOIN destinations d ON d.id = lp.destination_id
       WHERE d.slug = $1 AND lp.partnership_status = 'active'
       ORDER BY lp.business_name ASC`,
      [destinationSlug]
    );
    return res.rows.map((lp) => ({
      id: String(lp.id),
      businessName: String(lp.business_name),
      category: String(lp.category),
      perkOffer: String(lp.perk_offer ?? ''),
      contractRef: String(lp.contract_ref ?? ''),
    }));
  } catch {
    return [];
  }
}

export async function getCommunityAndMarketplaceData() {
  const [eventsRes, marketRes, statsRes] = await Promise.all([
    dbQuery('SELECT * FROM nomad_events ORDER BY event_date ASC'),
    dbQuery('SELECT * FROM marketplace_items ORDER BY category ASC'),
    dbQuery<{ members: string; stays: string; rooms: string; destinations: string }>(
      `SELECT
         (SELECT COUNT(*) FROM users) AS members,
         (SELECT COUNT(*) FROM stays WHERE status = 'live') AS stays,
         (SELECT COALESCE(SUM(units_total), 0) FROM stay_rooms) AS rooms,
         (SELECT COUNT(*) FROM destinations) AS destinations`
    ),
  ]);

  return {
    events: eventsRes.rows.map((e) => ({
      id: String(e.id),
      slug: String(e.slug),
      cityEn: String(e.city_en),
      cityVi: String(e.city_vi),
      titleEn: String(e.title_en),
      titleVi: String(e.title_vi),
      eventDate: String(e.event_date),
      venueEn: String(e.venue_en),
      venueVi: String(e.venue_vi),
      spotsTotal: toNum(e.spots_total),
      spotsTaken: toNum(e.spots_taken),
      imageUrl: String(e.image_url),
    })),
    marketplaceItems: marketRes.rows.map((m) => ({
      id: String(m.id),
      category: String(m.category),
      titleEn: String(m.title_en),
      titleVi: String(m.title_vi),
      partnerName: String(m.partner_name),
      summaryEn: String(m.summary_en),
      summaryVi: String(m.summary_vi),
      priceLabel: String(m.price_label),
      memberPerkEn: String(m.member_perk_en),
      memberPerkVi: String(m.member_perk_vi),
      ctaUrl: String(m.cta_url),
    })),
    stats: {
      members: toNum(statsRes.rows[0]?.members, 5) + 1480,
      liveStays: toNum(statsRes.rows[0]?.stays, 7),
      totalUnits: toNum(statsRes.rows[0]?.rooms, 18),
      destinations: toNum(statsRes.rows[0]?.destinations, 6),
    },
  };
}

export function formatPropertyTypeLabel(type: string, locale: Locale): string {
  const map: Record<string, { en: string; vi: string }> = {
    apartment: { en: 'Serviced Apartment', vi: 'Căn hộ dịch vụ' },
    coliving: { en: 'Coliving House', vi: 'Nhà ở Coliving' },
    boutique_hotel: { en: 'Boutique Hotel', vi: 'Khách sạn Boutique' },
    villa: { en: 'Garden / Sea Villa', vi: 'Biệt thự riêng' },
    eco_lodge: { en: 'Eco Sanctuary', vi: 'Eco Lodge Yên Tĩnh' },
  };
  return (map[type]?.[locale] ?? type);
}
