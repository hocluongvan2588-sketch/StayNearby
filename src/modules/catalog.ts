import { dbQuery, toNum } from '@/lib/db';
import { addDaysIso, enumerateStayNights, getTodayIsoVietnam } from '@/lib/dates';
import type { Locale } from '@/lib/i18n';
import { calculateStayQuote } from '@/lib/pricing';

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
  businessModel: 'booking_flow' | 'stay_direct';
  isInstantBook: boolean;
  cancellationPolicy: 'flexible' | 'moderate' | 'strict';
  wifiDownloadMbps: number;
  wifiUploadMbps: number;
  wifiJitterMs: number;
  verificationTier: 'HOST_VERIFIED' | 'VIETNOMAD_CERTIFIED';
  verifiedAt: string;
  hasErgonomicChair: boolean;
  hasExternalMonitor: boolean;
  hasCallBooth: boolean;
  kitchenType: string;
  laundryType: string;
  petFriendly: boolean;
  googleRating: number;
  googleReviewCount: number;
  heroImage: string;
  mapX: number;
  mapY: number;
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
}

export interface StayDetail extends StayCardItem {
  hostName: string;
  hostNationality: string;
  hostWhatsapp: string;
  descriptionEn: string;
  descriptionVi: string;
  registrationCode: string;
  directBookingUrl: string | null;
  wifiTestedAt: string;
  wifiTesterNote: string;
  speedtestProofUrl: string | null;
  workspaceVideoUrl: string | null;
  workspaceSummaryEn: string;
  workspaceSummaryVi: string;
  workspacePhotoUrl: string;
  wheelchairFriendly: boolean;
  galleryImages: string[];
  amenities: string[];
  nearbyCoworking: CoworkingSpot[];
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

function mapStayRowToCard(row: Record<string, unknown>, lifestyleSlugs: string[]): StayCardItem {
  const businessModel = row.business_model as 'booking_flow' | 'stay_direct';
  const pkgInput = {
    wholesale7Vnd: toNum(row.wholesale_7_vnd),
    wholesale14Vnd: toNum(row.wholesale_14_vnd),
    wholesale21Vnd: toNum(row.wholesale_21_vnd),
    wholesale30Vnd: toNum(row.wholesale_30_vnd),
    compare30Vnd: row.compare_30_vnd ? toNum(row.compare_30_vnd) : null,
    extraNightVnd: toNum(row.extra_night_vnd),
  };

  const q7 = calculateStayQuote({ pkg: pkgInput, nights: 7, businessModel });
  const q30 = calculateStayQuote({ pkg: pkgInput, nights: 30, businessModel });

  const compareDisplay =
    pkgInput.compare30Vnd && pkgInput.compare30Vnd > pkgInput.wholesale30Vnd
      ? businessModel === 'booking_flow'
        ? Math.round(pkgInput.compare30Vnd * 1.12)
        : pkgInput.compare30Vnd
      : null;

  const dealSavingsPct =
    compareDisplay && compareDisplay > q30.guestTotalVnd
      ? Math.round(((compareDisplay - q30.guestTotalVnd) / compareDisplay) * 100)
      : 0;

  const coworking = parseJsonArray<CoworkingSpot>(row.nearby_coworking);

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
    businessModel,
    isInstantBook: Boolean(row.is_instant_book),
    cancellationPolicy: row.cancellation_policy as 'flexible' | 'moderate' | 'strict',
    wifiDownloadMbps: toNum(row.wifi_download_mbps),
    wifiUploadMbps: toNum(row.wifi_upload_mbps),
    wifiJitterMs: toNum(row.wifi_jitter_ms),
    verificationTier:
      row.verification_tier === 'HOST_VERIFIED'
        ? 'HOST_VERIFIED'
        : 'VIETNOMAD_CERTIFIED',
    verifiedAt: new Date(String(row.verified_at ?? row.wifi_tested_at ?? Date.now())).toISOString(),
    hasErgonomicChair: Boolean(row.has_ergonomic_chair),
    hasExternalMonitor: Boolean(row.has_external_monitor),
    hasCallBooth: Boolean(row.has_call_booth),
    kitchenType: String(row.kitchen_type),
    laundryType: String(row.laundry_type),
    petFriendly: Boolean(row.pet_friendly),
    googleRating: Number(row.google_rating ?? 4.8),
    googleReviewCount: toNum(row.google_review_count),
    heroImage: String(row.hero_image),
    mapX: Number(row.map_x ?? 50),
    mapY: Number(row.map_y ?? 50),
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
  businessModel?: 'booking_flow' | 'stay_direct' | 'all';
  hasMonitor?: boolean;
  hasCallBooth?: boolean;
  fullKitchen?: boolean;
  inUnitLaundry?: boolean;
  petFriendly?: boolean;
  maxMonthlyVnd?: number;
  sort?: 'wifi_desc' | 'price_asc' | 'savings_desc' | 'rating_desc';
}

export async function searchStays(filters: SearchStaysFilter = {}): Promise<StayCardItem[]> {
  const res = await dbQuery(
    `SELECT s.*,
            d.slug AS destination_slug, d.name_en AS destination_name_en, d.name_vi AS destination_name_vi,
            r.id AS default_room_id, r.beds_count, r.max_guests, r.units_total,
            p.wholesale_7_vnd, p.wholesale_14_vnd, p.wholesale_21_vnd, p.wholesale_30_vnd,
            p.compare_30_vnd, p.extra_night_vnd, p.is_deal_featured, p.deal_month_label,
            p.valid_from, p.valid_to
     FROM stays s
     JOIN destinations d ON d.id = s.destination_id
     JOIN LATERAL (
       SELECT * FROM stay_rooms sr WHERE sr.stay_id = s.id ORDER BY sr.max_guests DESC LIMIT 1
     ) r ON TRUE
     JOIN LATERAL (
       SELECT * FROM stay_packages sp WHERE sp.stay_id = s.id AND sp.is_listed = TRUE ORDER BY sp.wholesale_30_vnd ASC LIMIT 1
     ) p ON TRUE
     WHERE s.status = 'live'`
  );

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
  if (filters.checkIn && filters.nights && filters.nights >= 7) {
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
    .map((r) => mapStayRowToCard(r, lsMap.get(String(r.id)) ?? []));

  if (filters.destination && filters.destination !== 'all') {
    items = items.filter((s) => s.destinationSlug === filters.destination);
  }
  if (filters.lifestyle && filters.lifestyle !== 'all') {
    items = items.filter((s) => s.lifestyleSlugs.includes(filters.lifestyle!));
  }
  if (filters.minWifiMbps && filters.minWifiMbps > 0) {
    items = items.filter((s) => s.wifiDownloadMbps >= filters.minWifiMbps!);
  }
  if (filters.businessModel && filters.businessModel !== 'all') {
    items = items.filter((s) => s.businessModel === filters.businessModel);
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
  if (filters.maxMonthlyVnd && filters.maxMonthlyVnd > 0) {
    items = items.filter((s) => s.monthDisplayVnd <= filters.maxMonthlyVnd!);
  }

  const sortBy = filters.sort ?? 'wifi_desc';
  items.sort((a, b) => {
    if (sortBy === 'price_asc') return a.monthDisplayVnd - b.monthDisplayVnd;
    if (sortBy === 'savings_desc')
      return b.dealSavingsPct + b.stayLongerSavingsPct - (a.dealSavingsPct + a.stayLongerSavingsPct);
    if (sortBy === 'rating_desc') return b.googleRating - a.googleRating;
    return b.wifiDownloadMbps - a.wifiDownloadMbps;
  });

  return items;
}

export async function getStayDetailBySlug(slug: string): Promise<StayDetail | null> {
  const stayRes = await dbQuery(
    `SELECT s.*,
            u.full_name AS host_name, u.nationality AS host_nationality,
            d.id AS d_id, d.slug AS destination_slug, d.name_en AS destination_name_en,
            d.name_vi AS destination_name_vi, d.region_en, d.region_vi,
            d.tagline_en, d.tagline_vi, d.climate_en, d.climate_vi,
            d.visa_summary_en, d.visa_summary_vi, d.visa_details_en, d.visa_details_vi,
            d.monthly_cost_usd, d.avg_wifi_mbps, d.hero_image AS dest_hero_image,
            d.map_x AS dest_map_x, d.map_y AS dest_map_y,
            r.beds_count, r.max_guests,
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
  );

  const row = stayRes.rows[0];
  if (!row) return null;

  const lsRes = await dbQuery<{ slug: string }>(
    `SELECT l.slug FROM stay_lifestyles sl JOIN lifestyles l ON l.id = sl.lifestyle_id WHERE sl.stay_id = $1`,
    [row.id]
  );
  const card = mapStayRowToCard(
    row,
    lsRes.rows.map((x) => x.slug)
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
  const locksRes = await dbQuery<{
    room_id: string;
    stay_date: string | Date;
    booked_units: number;
    blocked_units: number;
  }>(
    `SELECT room_id, stay_date, booked_units, blocked_units
     FROM room_night_locks
     WHERE room_id = ANY($1::uuid[]) AND stay_date >= $2::date AND stay_date <= $3::date`,
    [roomsRes.rows.map((rm) => String(rm.id)), today, horizon]
  );

  const rooms: StayRoomDetail[] = roomsRes.rows.map((rm) => {
    const unitsTotal = toNum(rm.units_total, 1);
    const unavailableDates = locksRes.rows
      .filter(
        (l) =>
          l.room_id === String(rm.id) &&
          toNum(l.booked_units) + toNum(l.blocked_units) >= unitsTotal
      )
      .map((l) =>
        l.stay_date instanceof Date
          ? l.stay_date.toISOString().slice(0, 10)
          : String(l.stay_date).slice(0, 10)
      );

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
    };
  });

  return {
    ...card,
    hostName: String(row.host_name),
    hostNationality: String(row.host_nationality),
    hostWhatsapp: String(row.host_whatsapp ?? '+84901234567'),
    descriptionEn: String(row.description_en),
    descriptionVi: String(row.description_vi),
    registrationCode: String(row.registration_code ?? ''),
    directBookingUrl: row.direct_booking_url ? String(row.direct_booking_url) : null,
    wifiTestedAt: new Date(String(row.wifi_tested_at)).toISOString(),
    wifiTesterNote: String(row.wifi_tester_note),
    speedtestProofUrl: row.speedtest_proof_url ? String(row.speedtest_proof_url) : null,
    workspaceVideoUrl: row.workspace_video_url ? String(row.workspace_video_url) : null,
    workspaceSummaryEn: String(row.workspace_summary_en),
    workspaceSummaryVi: String(row.workspace_summary_vi),
    workspacePhotoUrl: String(row.workspace_photo_url),
    wheelchairFriendly: Boolean(row.wheelchair_friendly),
    galleryImages: parseJsonArray<string>(row.gallery_images),
    amenities: parseJsonArray<string>(row.amenities),
    nearbyCoworking: parseJsonArray<CoworkingSpot>(row.nearby_coworking),
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
