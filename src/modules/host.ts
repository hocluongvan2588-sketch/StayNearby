import crypto from 'node:crypto';
import type { SessionUser } from '@/lib/auth/session';
import { getTodayIsoVietnam, isValidIsoDate, isValidUuid } from '@/lib/dates';
import { dbQuery, dbTransaction, toNum } from '@/lib/db';
import { AppError } from '@/lib/errors';
import { syncRoomIcalFeed } from '@/lib/ical';
import { deleteStayUploadedMedia, getMediaStorageStatus } from '@/lib/storage';

export interface HostCoworkingSpot {
  name: string;
  distance: string;
}

export interface HostStayRoomItem {
  id: string;
  stayId: string;
  nameEn: string;
  nameVi: string;
  descriptionEn: string;
  descriptionVi: string;
  maxGuests: number;
  bedsCount: number;
  unitsTotal: number;
  roomImage: string;
  roomFeatures: string[];
  icalUrl: string;
  icalLastSyncedAt: string | null;
  icalSyncStatus: string;
  packageId: string | null;
  wholesale7Vnd: number;
  wholesale14Vnd: number;
  wholesale21Vnd: number;
  wholesale30Vnd: number;
  extraNightVnd: number;
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

function isSafeImageUrl(url: string): boolean {
  const trimmed = url.trim();
  return (
    trimmed.startsWith('https://') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('/images/') ||
    trimmed.startsWith('/api/uploads/')
  );
}

export async function assertHostOwnsStay(user: SessionUser, stayId: string) {
  if (!isValidUuid(stayId)) {
    throw new AppError('VALIDATION_ERROR', 'Invalid stay identifier.');
  }
  const res = await dbQuery<{
    id: string;
    host_id: string;
    hero_image: string;
    workspace_photo_url: string;
    gallery_images: unknown;
  }>(
    'SELECT id, host_id, hero_image, workspace_photo_url, gallery_images FROM stays WHERE id = $1',
    [stayId]
  );
  const row = res.rows[0];
  if (!row) throw new AppError('NOT_FOUND', 'Stay not found.');
  if (row.host_id !== user.id && user.role !== 'admin') {
    throw new AppError('FORBIDDEN', 'You do not own this property.');
  }
  return row;
}

export async function getHostConsoleData(user: SessionUser) {
  const [walletRes, staysRes, roomsRes, appsRes, bookingsRes, referralsRes, blocksRes, notifRes] =
    await Promise.all([
      dbQuery<{ balance_vnd: string | number; updated_at: string | Date }>(
        'SELECT balance_vnd, updated_at FROM host_wallets WHERE host_id = $1',
        [user.id]
      ),
      dbQuery(
        `SELECT s.*, d.name_en AS destination_name_en, d.name_vi AS destination_name_vi,
                r.id AS room_id, r.name_en AS room_name_en, r.name_vi AS room_name_vi, r.units_total,
                r.ical_url, r.ical_last_synced_at, r.ical_sync_status,
                p.id AS package_id, p.name_en AS package_name_en, p.is_listed,
                p.wholesale_7_vnd, p.wholesale_14_vnd, p.wholesale_21_vnd, p.wholesale_30_vnd,
                p.extra_night_vnd, p.is_deal_featured, p.deal_month_label
         FROM stays s
         JOIN destinations d ON d.id = s.destination_id
         LEFT JOIN LATERAL (
           SELECT * FROM stay_rooms sr WHERE sr.stay_id = s.id ORDER BY sr.max_guests ASC LIMIT 1
         ) r ON TRUE
         LEFT JOIN LATERAL (
           SELECT * FROM stay_packages sp WHERE sp.stay_id = s.id ORDER BY sp.wholesale_30_vnd ASC LIMIT 1
         ) p ON TRUE
         WHERE s.host_id = $1
         ORDER BY s.created_at DESC`,
        [user.id]
      ),
      dbQuery(
        `SELECT sr.*,
                p.id AS package_id,
                p.wholesale_7_vnd, p.wholesale_14_vnd, p.wholesale_21_vnd, p.wholesale_30_vnd,
                p.extra_night_vnd
         FROM stay_rooms sr
         JOIN stays s ON s.id = sr.stay_id
         LEFT JOIN LATERAL (
           SELECT id, wholesale_7_vnd, wholesale_14_vnd, wholesale_21_vnd, wholesale_30_vnd, extra_night_vnd
           FROM stay_packages sp
           WHERE sp.room_id = sr.id
           ORDER BY sp.is_listed DESC, sp.wholesale_30_vnd ASC
           LIMIT 1
         ) p ON TRUE
         WHERE s.host_id = $1
         ORDER BY sr.max_guests ASC, sr.name_en ASC`,
        [user.id]
      ),
      dbQuery(
        `SELECT * FROM host_applications WHERE applicant_user_id = $1 ORDER BY created_at DESC`,
        [user.id]
      ),
      dbQuery(
        `SELECT b.*, s.title_en, s.title_vi, u.full_name AS guest_name, u.email AS guest_email, u.nationality
         FROM bookings b
         JOIN stays s ON s.id = b.stay_id
         JOIN users u ON u.id = b.guest_id
         WHERE s.host_id = $1
         ORDER BY b.created_at DESC`,
        [user.id]
      ),
      dbQuery(
        `SELECT sr.*, s.title_en, s.title_vi, u.full_name AS member_name
         FROM staydirect_referrals sr
         JOIN stays s ON s.id = sr.stay_id
         JOIN users u ON u.id = sr.member_id
         WHERE s.host_id = $1
         ORDER BY sr.created_at DESC`,
        [user.id]
      ),
      dbQuery(
        `SELECT rnl.*, sr.name_en AS room_name_en, s.title_en AS stay_title_en
         FROM room_night_locks rnl
         JOIN stay_rooms sr ON sr.id = rnl.room_id
         JOIN stays s ON s.id = sr.stay_id
         WHERE s.host_id = $1 AND rnl.stay_date >= $2::date
         ORDER BY rnl.stay_date ASC
         LIMIT 60`,
        [user.id, getTodayIsoVietnam()]
      ),
      dbQuery(
        `SELECT bn.*, b.booking_code
         FROM booking_notifications bn
         JOIN bookings b ON b.id = bn.booking_id
         JOIN stays s ON s.id = b.stay_id
         WHERE s.host_id = $1 AND bn.recipient_role = 'host'
         ORDER BY bn.created_at DESC
         LIMIT 20`,
        [user.id]
      ),
    ]);

  const roomsByStay = new Map<string, HostStayRoomItem[]>();
  for (const r of roomsRes.rows) {
    const stayId = String(r.stay_id);
    const list = roomsByStay.get(stayId) ?? [];
    list.push({
      id: String(r.id),
      stayId,
      nameEn: String(r.name_en),
      nameVi: String(r.name_vi),
      descriptionEn: String(r.description_en),
      descriptionVi: String(r.description_vi),
      maxGuests: toNum(r.max_guests, 2),
      bedsCount: toNum(r.beds_count, 1),
      unitsTotal: toNum(r.units_total, 1),
      roomImage: String(r.room_image),
      roomFeatures: parseJsonArray<string>(r.room_features),
      icalUrl: r.ical_url ? String(r.ical_url) : '',
      icalLastSyncedAt: r.ical_last_synced_at
        ? new Date(String(r.ical_last_synced_at)).toISOString()
        : null,
      icalSyncStatus: String(r.ical_sync_status ?? 'idle'),
      packageId: r.package_id ? String(r.package_id) : null,
      wholesale7Vnd: toNum(r.wholesale_7_vnd, 0),
      wholesale14Vnd: toNum(r.wholesale_14_vnd, 0),
      wholesale21Vnd: toNum(r.wholesale_21_vnd, 0),
      wholesale30Vnd: toNum(r.wholesale_30_vnd, 0),
      extraNightVnd: toNum(r.extra_night_vnd, 0),
    });
    roomsByStay.set(stayId, list);
  }

  return {
    mediaStorage: getMediaStorageStatus(),
    walletBalanceVnd: toNum(walletRes.rows[0]?.balance_vnd, 0),
    stays: staysRes.rows.map((s) => {
      const stayId = String(s.id);
      return {
        id: stayId,
        slug: String(s.slug),
        titleEn: String(s.title_en),
        titleVi: String(s.title_vi),
        subtitleEn: String(s.subtitle_en),
        subtitleVi: String(s.subtitle_vi),
        descriptionEn: String(s.description_en),
        descriptionVi: String(s.description_vi),
        neighborhoodEn: String(s.neighborhood_en),
        neighborhoodVi: String(s.neighborhood_vi),
        exactAddress: String(s.exact_address),
        checkinInstructionsEn: String(s.checkin_instructions_en),
        checkinInstructionsVi: String(s.checkin_instructions_vi),
        destinationNameEn: String(s.destination_name_en),
        destinationNameVi: String(s.destination_name_vi),
        propertyType: String(s.property_type) as
          | 'apartment'
          | 'coliving'
          | 'boutique_hotel'
          | 'villa'
          | 'eco_lodge',
        businessModel: s.business_model as 'booking_flow' | 'stay_direct',
        status: String(s.status),
        isInstantBook: Boolean(s.is_instant_book),
        cancellationPolicy: String(s.cancellation_policy) as
          | 'flexible'
          | 'moderate'
          | 'strict',
        wifiDownloadMbps: toNum(s.wifi_download_mbps),
        wifiUploadMbps: toNum(s.wifi_upload_mbps),
        wifiJitterMs: toNum(s.wifi_jitter_ms),
        wifiTestedAt: new Date(String(s.wifi_tested_at)).toISOString(),
        verifiedAt: new Date(String(s.verified_at ?? s.wifi_tested_at)).toISOString(),
        verificationTier: String(s.verification_tier ?? 'VIETNOMAD_CERTIFIED'),
        speedtestProofUrl: s.speedtest_proof_url ? String(s.speedtest_proof_url) : '',
        workspaceVideoUrl: s.workspace_video_url ? String(s.workspace_video_url) : '',
        workspaceSummaryEn: String(s.workspace_summary_en),
        workspaceSummaryVi: String(s.workspace_summary_vi),
        workspacePhotoUrl: String(s.workspace_photo_url),
        hasErgonomicChair: Boolean(s.has_ergonomic_chair),
        hasExternalMonitor: Boolean(s.has_external_monitor),
        hasCallBooth: Boolean(s.has_call_booth),
        kitchenType: String(s.kitchen_type) as 'full' | 'kitchenette' | 'shared',
        laundryType: String(s.laundry_type) as 'in_unit' | 'building' | 'service',
        petFriendly: Boolean(s.pet_friendly),
        wheelchairFriendly: Boolean(s.wheelchair_friendly),
        heroImage: String(s.hero_image),
        galleryImages: parseJsonArray<string>(s.gallery_images),
        amenities: parseJsonArray<string>(s.amenities),
        nearbyCoworking: parseJsonArray<HostCoworkingSpot>(s.nearby_coworking),
        hostWhatsapp: String(s.host_whatsapp ?? '+84901234567'),
        roomId: s.room_id ? String(s.room_id) : null,
        roomNameEn: s.room_name_en ? String(s.room_name_en) : '',
        unitsTotal: toNum(s.units_total, 1),
        icalUrl: s.ical_url ? String(s.ical_url) : '',
        icalLastSyncedAt: s.ical_last_synced_at
          ? new Date(String(s.ical_last_synced_at)).toISOString()
          : null,
        icalSyncStatus: String(s.ical_sync_status ?? 'idle'),
        packageId: s.package_id ? String(s.package_id) : null,
        isListed: Boolean(s.is_listed),
        isDealFeatured: Boolean(s.is_deal_featured),
        dealMonthLabel: String(s.deal_month_label ?? 'Next Month'),
        wholesale7Vnd: toNum(s.wholesale_7_vnd),
        wholesale14Vnd: toNum(s.wholesale_14_vnd),
        wholesale21Vnd: toNum(s.wholesale_21_vnd),
        wholesale30Vnd: toNum(s.wholesale_30_vnd),
        extraNightVnd: toNum(s.extra_night_vnd),
        directBookingUrl: s.direct_booking_url ? String(s.direct_booking_url) : '',
        rooms: roomsByStay.get(stayId) ?? [],
      };
    }),
    applications: appsRes.rows.map((a) => ({
      id: String(a.id),
      businessName: String(a.business_name),
      stayName: String(a.stay_name),
      destinationSlug: String(a.destination_slug),
      propertyType: String(a.property_type),
      businessModel: String(a.business_model),
      measuredDownloadMbps: toNum(a.measured_download_mbps),
      status: String(a.status),
      reviewNote: String(a.review_note ?? ''),
      createdAt: new Date(String(a.created_at)).toISOString(),
    })),
    bookings: bookingsRes.rows.map((b) => {
      const unlocked = ['RESERVED_LOCKED', 'CHECKED_IN_COMPLETED', 'confirmed', 'completed'].includes(
        String(b.status)
      );
      const feeOnlineVnd =
        toNum(b.booking_fee_online_vnd) > 0
          ? toNum(b.booking_fee_online_vnd)
          : toNum(b.service_fee_vnd);
      const payAtCheckinVnd =
        toNum(b.pay_at_checkin_vnd) > 0
          ? toNum(b.pay_at_checkin_vnd)
          : toNum(b.wholesale_total_vnd);
      return {
        id: String(b.id),
        bookingCode: String(b.booking_code),
        stayTitleEn: String(b.title_en),
        stayTitleVi: String(b.title_vi),
        guestName: String(b.guest_name),
        guestEmail: unlocked ? String(b.guest_email) : 'Hidden until 12% locked',
        nationality: String(b.nationality),
        businessModel: String(b.business_model),
        status: String(b.status),
        checkIn:
          b.check_in instanceof Date
            ? b.check_in.toISOString().slice(0, 10)
            : String(b.check_in).slice(0, 10),
        checkOut:
          b.check_out instanceof Date
            ? b.check_out.toISOString().slice(0, 10)
            : String(b.check_out).slice(0, 10),
        nights: toNum(b.nights),
        wholesaleTotalVnd: toNum(b.wholesale_total_vnd),
        feeOnlineVnd,
        payAtCheckinVnd,
        guestTotalVnd: toNum(b.guest_total_vnd),
      };
    }),
    referrals: referralsRes.rows.map((r) => ({
      id: String(r.id),
      stayTitleEn: String(r.title_en),
      memberName: String(r.member_name),
      nights: toNum(r.nights),
      retailTotalVnd: toNum(r.retail_total_vnd),
      referralFeeVnd: toNum(r.referral_fee_vnd),
      createdAt: new Date(String(r.created_at)).toISOString(),
    })),
    availabilityLocks: blocksRes.rows.map((l) => ({
      id: String(l.id),
      roomId: String(l.room_id),
      stayTitleEn: String(l.stay_title_en),
      roomNameEn: String(l.room_name_en),
      stayDate:
        l.stay_date instanceof Date
          ? l.stay_date.toISOString().slice(0, 10)
          : String(l.stay_date).slice(0, 10),
      bookedUnits: toNum(l.booked_units),
      blockedUnits: toNum(l.blocked_units),
    })),
    notifications: notifRes.rows.map((n) => ({
      id: String(n.id),
      bookingCode: String(n.booking_code),
      subject: String(n.subject),
      status: String(n.status),
      createdAt: new Date(String(n.created_at)).toISOString(),
    })),
  };
}

export async function submitHostApplication(
  user: SessionUser,
  input: {
    businessName: string;
    stayName: string;
    destinationSlug: string;
    propertyType: string;
    businessModel: 'booking_flow' | 'stay_direct';
    measuredDownloadMbps: number;
    hasKitchen: boolean;
    hasLaundry: boolean;
    hasWorkspace: boolean;
    directBookingUrl?: string;
  }
) {
  if (!input.hasKitchen || !input.hasLaundry || !input.hasWorkspace) {
    throw new AppError(
      'VALIDATION_ERROR',
      'Listings require a kitchen, laundry, and a dedicated desk.'
    );
  }
  if (input.businessModel === 'stay_direct' && !input.directBookingUrl?.startsWith('http')) {
    throw new AppError(
      'VALIDATION_ERROR',
      'Direct Booking requires a valid HTTPS booking URL.'
    );
  }

  const id = crypto.randomUUID();
  await dbTransaction(async (tx) => {
    await tx.query(
      `INSERT INTO host_applications (
        id, applicant_user_id, business_name, stay_name, destination_slug,
        property_type, business_model, application_fee_eur, application_fee_paid,
        measured_download_mbps, has_kitchen, has_laundry, has_workspace,
        direct_booking_url, status, review_note
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,39,TRUE,$8,$9,$10,$11,$12,'submitted','€39 verification fee settled, queued for review')`,
      [
        id,
        user.id,
        input.businessName.trim(),
        input.stayName.trim(),
        input.destinationSlug,
        input.propertyType,
        input.businessModel,
        Math.max(10, Math.round(input.measuredDownloadMbps)),
        input.hasKitchen,
        input.hasLaundry,
        input.hasWorkspace,
        input.directBookingUrl?.trim() || null,
      ]
    );

    if (user.role === 'nomad') {
      await tx.query(`UPDATE users SET role = 'host' WHERE id = $1`, [user.id]);
    }
    await tx.query(
      `INSERT INTO host_wallets (host_id, balance_vnd) VALUES ($1, 1270000) ON CONFLICT (host_id) DO NOTHING`,
      [user.id]
    );
  });

  return { applicationId: id, status: 'submitted' as const };
}

export async function attachMediaToStay(
  user: SessionUser,
  stayId: string,
  input: {
    url: string;
    role: 'hero' | 'workspace' | 'gallery' | 'room';
    roomId?: string;
  }
) {
  if (!isSafeImageUrl(input.url)) {
    throw new AppError('VALIDATION_ERROR', 'Invalid media URL.');
  }
  const stay = await assertHostOwnsStay(user, stayId);
  const existingGallery = parseJsonArray<string>(stay.gallery_images);
  const nextGallery = existingGallery.includes(input.url)
    ? existingGallery
    : input.role === 'hero'
      ? [input.url, ...existingGallery]
      : [...existingGallery, input.url];

  await dbTransaction(async (tx) => {
    if (input.role === 'hero') {
      await tx.query(
        `UPDATE stays SET hero_image = $1, gallery_images = $2::jsonb WHERE id = $3`,
        [input.url, JSON.stringify(nextGallery.slice(0, 24)), stayId]
      );
    } else if (input.role === 'workspace') {
      await tx.query(
        `UPDATE stays SET workspace_photo_url = $1, gallery_images = $2::jsonb WHERE id = $3`,
        [input.url, JSON.stringify(nextGallery.slice(0, 24)), stayId]
      );
    } else if (input.role === 'room' && input.roomId && isValidUuid(input.roomId)) {
      await tx.query(
        `UPDATE stay_rooms SET room_image = $1 WHERE id = $2 AND stay_id = $3`,
        [input.url, input.roomId, stayId]
      );
      await tx.query(
        `UPDATE stays SET gallery_images = $1::jsonb WHERE id = $2`,
        [JSON.stringify(nextGallery.slice(0, 24)), stayId]
      );
    } else {
      await tx.query(
        `UPDATE stays SET gallery_images = $1::jsonb WHERE id = $2`,
        [JSON.stringify(nextGallery.slice(0, 24)), stayId]
      );
    }
  });

  return { ok: true, galleryImages: nextGallery.slice(0, 24) };
}

export async function removeMediaFromStay(
  user: SessionUser,
  stayId: string,
  mediaUrl: string
) {
  const stay = await assertHostOwnsStay(user, stayId);
  const currentGallery = parseJsonArray<string>(stay.gallery_images);
  const filteredGallery = currentGallery.filter((img) => img !== mediaUrl);

  const fallbackPool = [
    ...filteredGallery,
    String(stay.hero_image),
    String(stay.workspace_photo_url),
  ].filter((u) => u && u !== mediaUrl);

  if (fallbackPool.length === 0) {
    throw new AppError(
      'VALIDATION_ERROR',
      'A listing must keep at least one active photo.'
    );
  }

  const nextHero =
    String(stay.hero_image) === mediaUrl ? fallbackPool[0]! : String(stay.hero_image);
  const nextWorkspace =
    String(stay.workspace_photo_url) === mediaUrl
      ? fallbackPool[0]!
      : String(stay.workspace_photo_url);

  await dbTransaction(async (tx) => {
    await tx.query(
      `UPDATE stays
       SET hero_image = $1,
           workspace_photo_url = $2,
           gallery_images = $3::jsonb
       WHERE id = $4`,
      [nextHero, nextWorkspace, JSON.stringify(filteredGallery), stayId]
    );
    await tx.query(
      `UPDATE stay_rooms SET room_image = $1 WHERE stay_id = $2 AND room_image = $3`,
      [nextHero, stayId, mediaUrl]
    );
  });

  await deleteStayUploadedMedia(stayId, mediaUrl);

  return {
    ok: true,
    heroImage: nextHero,
    workspacePhotoUrl: nextWorkspace,
    galleryImages: filteredGallery,
  };
}

export interface UpdateHostStayFullInput {
  // Pricing & Business model (compatible with legacy PATCH)
  businessModel?: 'booking_flow' | 'stay_direct';
  directBookingUrl?: string;
  wholesale7Vnd?: number;
  wholesale14Vnd?: number;
  wholesale21Vnd?: number;
  wholesale30Vnd?: number;
  extraNightVnd?: number;
  isDealFeatured?: boolean;
  dealMonthLabel?: string;

  // Media
  heroImage?: string;
  workspacePhotoUrl?: string;
  galleryImages?: string[];

  // Property Details & Workspace
  titleEn?: string;
  titleVi?: string;
  subtitleEn?: string;
  subtitleVi?: string;
  descriptionEn?: string;
  descriptionVi?: string;
  neighborhoodEn?: string;
  neighborhoodVi?: string;
  exactAddress?: string;
  checkinInstructionsEn?: string;
  checkinInstructionsVi?: string;
  propertyType?: 'apartment' | 'coliving' | 'boutique_hotel' | 'villa' | 'eco_lodge';
  cancellationPolicy?: 'flexible' | 'moderate' | 'strict';
  isInstantBook?: boolean;
  workspaceSummaryEn?: string;
  workspaceSummaryVi?: string;
  hasErgonomicChair?: boolean;
  hasExternalMonitor?: boolean;
  hasCallBooth?: boolean;
  kitchenType?: 'full' | 'kitchenette' | 'shared';
  laundryType?: 'in_unit' | 'building' | 'service';
  petFriendly?: boolean;
  wheelchairFriendly?: boolean;
  amenities?: string[];
  nearbyCoworking?: HostCoworkingSpot[];
}

export async function updateHostStayConfiguration(
  user: SessionUser,
  stayId: string,
  input: UpdateHostStayFullInput
) {
  if (!isValidUuid(stayId)) {
    throw new AppError('VALIDATION_ERROR', 'Invalid stay identifier.');
  }

  return dbTransaction(async (tx) => {
    const stayRes = await tx.query<Record<string, unknown>>(
      'SELECT * FROM stays WHERE id = $1 FOR UPDATE',
      [stayId]
    );
    const current = stayRes.rows[0];
    if (!current) throw new AppError('NOT_FOUND', 'Stay not found.');
    if (String(current.host_id) !== user.id && user.role !== 'admin') {
      throw new AppError('FORBIDDEN', 'You do not own this property.');
    }

    const nextBusinessModel =
      input.businessModel ?? (current.business_model as 'booking_flow' | 'stay_direct');
    const nextDirectUrl =
      input.directBookingUrl !== undefined
        ? input.directBookingUrl.trim() || null
        : current.direct_booking_url
          ? String(current.direct_booking_url)
          : null;

    if (nextBusinessModel === 'stay_direct' && (!nextDirectUrl || !nextDirectUrl.startsWith('http'))) {
      throw new AppError('VALIDATION_ERROR', 'Direct Booking requires a valid booking URL.');
    }

    const nextHero = input.heroImage?.trim() || String(current.hero_image);
    const nextWorkspacePhoto =
      input.workspacePhotoUrl?.trim() || String(current.workspace_photo_url);
    if (!isSafeImageUrl(nextHero) || !isSafeImageUrl(nextWorkspacePhoto)) {
      throw new AppError('VALIDATION_ERROR', 'Hero and workspace image URLs must be valid HTTPS or uploaded paths.');
    }

    let nextGallery =
      input.galleryImages !== undefined
        ? input.galleryImages.map((u) => u.trim()).filter((u) => isSafeImageUrl(u))
        : parseJsonArray<string>(current.gallery_images);
    if (!nextGallery.includes(nextHero)) {
      nextGallery = [nextHero, ...nextGallery];
    }
    nextGallery = Array.from(new Set(nextGallery)).slice(0, 24);

    const nextAmenities =
      input.amenities !== undefined
        ? input.amenities.map((a) => a.trim()).filter(Boolean).slice(0, 30)
        : parseJsonArray<string>(current.amenities);

    const nextCoworking =
      input.nearbyCoworking !== undefined
        ? input.nearbyCoworking
            .map((c) => ({ name: c.name.trim(), distance: c.distance.trim() }))
            .filter((c) => c.name && c.distance)
            .slice(0, 8)
        : parseJsonArray<HostCoworkingSpot>(current.nearby_coworking);

    await tx.query(
      `UPDATE stays
       SET business_model = $1,
           direct_booking_url = $2,
           title_en = $3,
           title_vi = $4,
           subtitle_en = $5,
           subtitle_vi = $6,
           description_en = $7,
           description_vi = $8,
           neighborhood_en = $9,
           neighborhood_vi = $10,
           exact_address = $11,
           checkin_instructions_en = $12,
           checkin_instructions_vi = $13,
           property_type = $14,
           cancellation_policy = $15,
           is_instant_book = $16,
           workspace_summary_en = $17,
           workspace_summary_vi = $18,
           workspace_photo_url = $19,
           has_ergonomic_chair = $20,
           has_external_monitor = $21,
           has_call_booth = $22,
           kitchen_type = $23,
           laundry_type = $24,
           pet_friendly = $25,
           wheelchair_friendly = $26,
           hero_image = $27,
           gallery_images = $28::jsonb,
           amenities = $29::jsonb,
           nearby_coworking = $30::jsonb
       WHERE id = $31`,
      [
        nextBusinessModel,
        nextDirectUrl,
        input.titleEn?.trim() || String(current.title_en),
        input.titleVi?.trim() || String(current.title_vi),
        input.subtitleEn?.trim() || String(current.subtitle_en),
        input.subtitleVi?.trim() || String(current.subtitle_vi),
        input.descriptionEn?.trim() || String(current.description_en),
        input.descriptionVi?.trim() || String(current.description_vi),
        input.neighborhoodEn?.trim() || String(current.neighborhood_en),
        input.neighborhoodVi?.trim() || String(current.neighborhood_vi),
        input.exactAddress?.trim() || String(current.exact_address),
        input.checkinInstructionsEn?.trim() || String(current.checkin_instructions_en),
        input.checkinInstructionsVi?.trim() || String(current.checkin_instructions_vi),
        input.propertyType ?? String(current.property_type),
        input.cancellationPolicy ?? String(current.cancellation_policy),
        input.isInstantBook ?? Boolean(current.is_instant_book),
        input.workspaceSummaryEn?.trim() || String(current.workspace_summary_en),
        input.workspaceSummaryVi?.trim() || String(current.workspace_summary_vi),
        nextWorkspacePhoto,
        input.hasErgonomicChair ?? Boolean(current.has_ergonomic_chair),
        input.hasExternalMonitor ?? Boolean(current.has_external_monitor),
        input.hasCallBooth ?? Boolean(current.has_call_booth),
        input.kitchenType ?? String(current.kitchen_type),
        input.laundryType ?? String(current.laundry_type),
        input.petFriendly ?? Boolean(current.pet_friendly),
        input.wheelchairFriendly ?? Boolean(current.wheelchair_friendly),
        nextHero,
        JSON.stringify(nextGallery),
        JSON.stringify(nextAmenities),
        JSON.stringify(nextCoworking),
        stayId,
      ]
    );

    if (
      input.wholesale7Vnd !== undefined ||
      input.wholesale14Vnd !== undefined ||
      input.wholesale21Vnd !== undefined ||
      input.wholesale30Vnd !== undefined ||
      input.extraNightVnd !== undefined ||
      input.isDealFeatured !== undefined ||
      input.dealMonthLabel !== undefined
    ) {
      await tx.query(
        `UPDATE stay_packages
         SET wholesale_7_vnd = COALESCE($1, wholesale_7_vnd),
             wholesale_14_vnd = COALESCE($2, wholesale_14_vnd),
             wholesale_21_vnd = COALESCE($3, wholesale_21_vnd),
             wholesale_30_vnd = COALESCE($4, wholesale_30_vnd),
             extra_night_vnd = COALESCE($5, extra_night_vnd),
             is_deal_featured = COALESCE($6, is_deal_featured),
             deal_month_label = COALESCE($7, deal_month_label)
         WHERE stay_id = $8`,
        [
          input.wholesale7Vnd !== undefined ? Math.round(input.wholesale7Vnd) : null,
          input.wholesale14Vnd !== undefined ? Math.round(input.wholesale14Vnd) : null,
          input.wholesale21Vnd !== undefined ? Math.round(input.wholesale21Vnd) : null,
          input.wholesale30Vnd !== undefined ? Math.round(input.wholesale30Vnd) : null,
          input.extraNightVnd !== undefined ? Math.round(input.extraNightVnd) : null,
          input.isDealFeatured !== undefined ? input.isDealFeatured : null,
          input.dealMonthLabel?.trim() || null,
          stayId,
        ]
      );
    }

    return { ok: true };
  });
}

export interface RoomInput {
  nameEn: string;
  nameVi?: string;
  descriptionEn: string;
  descriptionVi?: string;
  maxGuests: number;
  bedsCount: number;
  unitsTotal: number;
  roomImage?: string;
  roomFeatures?: string[];
  wholesale7Vnd?: number;
  wholesale14Vnd?: number;
  wholesale21Vnd?: number;
  wholesale30Vnd?: number;
  extraNightVnd?: number;
}

export async function createHostStayRoom(
  user: SessionUser,
  stayId: string,
  input: RoomInput
) {
  const stay = await assertHostOwnsStay(user, stayId);
  const roomImage = input.roomImage?.trim() || String(stay.hero_image);
  if (!isSafeImageUrl(roomImage)) {
    throw new AppError('VALIDATION_ERROR', 'Invalid room image URL.');
  }

  const roomId = crypto.randomUUID();
  const packageId = crypto.randomUUID();

  return dbTransaction(async (tx) => {
    // Inherit base pricing from existing package if not specified
    const basePkgRes = await tx.query<Record<string, unknown>>(
      `SELECT wholesale_7_vnd, wholesale_14_vnd, wholesale_21_vnd, wholesale_30_vnd, extra_night_vnd, deal_month_label
       FROM stay_packages WHERE stay_id = $1 ORDER BY wholesale_30_vnd ASC LIMIT 1`,
      [stayId]
    );
    const basePkg = basePkgRes.rows[0];
    const w7 = Math.round(input.wholesale7Vnd ?? toNum(basePkg?.wholesale_7_vnd, 6_000_000));
    const w14 = Math.round(input.wholesale14Vnd ?? toNum(basePkg?.wholesale_14_vnd, 11_400_000));
    const w21 = Math.round(input.wholesale21Vnd ?? toNum(basePkg?.wholesale_21_vnd, 16_200_000));
    const w30 = Math.round(input.wholesale30Vnd ?? toNum(basePkg?.wholesale_30_vnd, 21_500_000));
    const extra = Math.round(input.extraNightVnd ?? toNum(basePkg?.extra_night_vnd, 720_000));

    const nameEn = input.nameEn.trim();
    const nameVi = input.nameVi?.trim() || nameEn;
    const descEn = input.descriptionEn.trim();
    const descVi = input.descriptionVi?.trim() || descEn;
    const features = (input.roomFeatures ?? []).map((f) => f.trim()).filter(Boolean).slice(0, 12);

    await tx.query(
      `INSERT INTO stay_rooms (
        id, stay_id, name_en, name_vi, description_en, description_vi,
        max_guests, beds_count, units_total, room_image, room_features
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)`,
      [
        roomId,
        stayId,
        nameEn,
        nameVi,
        descEn,
        descVi,
        Math.max(1, Math.min(12, Math.round(input.maxGuests))),
        Math.max(1, Math.min(10, Math.round(input.bedsCount))),
        Math.max(1, Math.min(50, Math.round(input.unitsTotal))),
        roomImage,
        JSON.stringify(features),
      ]
    );

    await tx.query(
      `INSERT INTO stay_packages (
        id, stay_id, room_id, name_en, name_vi, description_en, description_vi,
        valid_from, valid_to, is_listed, wholesale_7_vnd, wholesale_14_vnd,
        wholesale_21_vnd, wholesale_30_vnd, compare_30_vnd, extra_night_vnd,
        is_deal_featured, deal_month_label
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,
        '2025-01-01'::date,'2028-12-31'::date,TRUE,
        $8,$9,$10,$11,$12,$13,FALSE,$14
      )`,
      [
        packageId,
        stayId,
        roomId,
        `${nameEn} Nomad Package`,
        `Gói ${nameVi}`,
        'Private apartment package with fiber Wi-Fi and utilities included.',
        'Gói phòng riêng kèm Wi-Fi cáp quang và chi phí sinh hoạt.',
        w7,
        w14,
        w21,
        w30,
        Math.round(w30 * 1.18),
        extra,
        basePkg?.deal_month_label ? String(basePkg.deal_month_label) : 'Next Month',
      ]
    );

    return { ok: true, roomId, packageId };
  });
}

export async function updateHostStayRoom(
  user: SessionUser,
  stayId: string,
  roomId: string,
  input: Partial<RoomInput>
) {
  if (!isValidUuid(roomId)) {
    throw new AppError('VALIDATION_ERROR', 'Invalid room identifier.');
  }
  await assertHostOwnsStay(user, stayId);

  return dbTransaction(async (tx) => {
    const roomRes = await tx.query<Record<string, unknown>>(
      'SELECT * FROM stay_rooms WHERE id = $1 AND stay_id = $2 FOR UPDATE',
      [roomId, stayId]
    );
    const cur = roomRes.rows[0];
    if (!cur) throw new AppError('NOT_FOUND', 'Room not found for this stay.');

    const nextImage = input.roomImage?.trim() || String(cur.room_image);
    if (!isSafeImageUrl(nextImage)) {
      throw new AppError('VALIDATION_ERROR', 'Invalid room image URL.');
    }

    const nextFeatures =
      input.roomFeatures !== undefined
        ? input.roomFeatures.map((f) => f.trim()).filter(Boolean).slice(0, 12)
        : parseJsonArray<string>(cur.room_features);

    await tx.query(
      `UPDATE stay_rooms
       SET name_en = $1,
           name_vi = $2,
           description_en = $3,
           description_vi = $4,
           max_guests = $5,
           beds_count = $6,
           units_total = $7,
           room_image = $8,
           room_features = $9::jsonb
       WHERE id = $10 AND stay_id = $11`,
      [
        input.nameEn?.trim() || String(cur.name_en),
        input.nameVi?.trim() || String(cur.name_vi),
        input.descriptionEn?.trim() || String(cur.description_en),
        input.descriptionVi?.trim() || String(cur.description_vi),
        input.maxGuests !== undefined
          ? Math.max(1, Math.min(12, Math.round(input.maxGuests)))
          : toNum(cur.max_guests, 2),
        input.bedsCount !== undefined
          ? Math.max(1, Math.min(10, Math.round(input.bedsCount)))
          : toNum(cur.beds_count, 1),
        input.unitsTotal !== undefined
          ? Math.max(1, Math.min(50, Math.round(input.unitsTotal)))
          : toNum(cur.units_total, 1),
        nextImage,
        JSON.stringify(nextFeatures),
        roomId,
        stayId,
      ]
    );

    if (
      input.wholesale7Vnd !== undefined ||
      input.wholesale14Vnd !== undefined ||
      input.wholesale21Vnd !== undefined ||
      input.wholesale30Vnd !== undefined ||
      input.extraNightVnd !== undefined
    ) {
      await tx.query(
        `UPDATE stay_packages
         SET wholesale_7_vnd = COALESCE($1, wholesale_7_vnd),
             wholesale_14_vnd = COALESCE($2, wholesale_14_vnd),
             wholesale_21_vnd = COALESCE($3, wholesale_21_vnd),
             wholesale_30_vnd = COALESCE($4, wholesale_30_vnd),
             extra_night_vnd = COALESCE($5, extra_night_vnd)
         WHERE room_id = $6 AND stay_id = $7`,
        [
          input.wholesale7Vnd !== undefined ? Math.round(input.wholesale7Vnd) : null,
          input.wholesale14Vnd !== undefined ? Math.round(input.wholesale14Vnd) : null,
          input.wholesale21Vnd !== undefined ? Math.round(input.wholesale21Vnd) : null,
          input.wholesale30Vnd !== undefined ? Math.round(input.wholesale30Vnd) : null,
          input.extraNightVnd !== undefined ? Math.round(input.extraNightVnd) : null,
          roomId,
          stayId,
        ]
      );
    }

    return { ok: true };
  });
}

export async function deleteHostStayRoom(
  user: SessionUser,
  stayId: string,
  roomId: string
) {
  if (!isValidUuid(roomId)) {
    throw new AppError('VALIDATION_ERROR', 'Invalid room identifier.');
  }
  await assertHostOwnsStay(user, stayId);

  return dbTransaction(async (tx) => {
    const countRes = await tx.query<{ cnt: string | number }>(
      'SELECT COUNT(*) AS cnt FROM stay_rooms WHERE stay_id = $1',
      [stayId]
    );
    if (toNum(countRes.rows[0]?.cnt) <= 1) {
      throw new AppError(
        'CONFLICT',
        'A property must retain at least one active room category.'
      );
    }

    const activeBookingRes = await tx.query<{ cnt: string | number }>(
      `SELECT COUNT(*) AS cnt FROM bookings
       WHERE room_id = $1
         AND status IN ('PENDING_PAYMENT', 'RESERVED_LOCKED', 'confirmed', 'CHECKED_IN_COMPLETED', 'completed')`,
      [roomId]
    );
    if (toNum(activeBookingRes.rows[0]?.cnt) > 0) {
      throw new AppError(
        'CONFLICT',
        'Cannot remove a room that has active or historical bookings.'
      );
    }

    const del = await tx.query(
      'DELETE FROM stay_rooms WHERE id = $1 AND stay_id = $2 RETURNING id',
      [roomId, stayId]
    );
    if (del.rows.length === 0) {
      throw new AppError('NOT_FOUND', 'Room not found.');
    }

    return { ok: true };
  });
}

export async function recordWifiSpeedTest(
  user: SessionUser,
  stayId: string,
  input: {
    downloadMbps: number;
    uploadMbps: number;
    jitterMs: number;
    note?: string;
    speedtestProofUrl?: string;
    workspaceVideoUrl?: string;
  }
) {
  if (!isValidUuid(stayId)) throw new AppError('VALIDATION_ERROR', 'Invalid stay ID.');
  const res = await dbQuery<{ host_id: string }>(
    'SELECT host_id FROM stays WHERE id = $1',
    [stayId]
  );
  const row = res.rows[0];
  if (!row) throw new AppError('NOT_FOUND', 'Stay not found.');
  if (row.host_id !== user.id && user.role !== 'admin') {
    throw new AppError('FORBIDDEN', 'Only the property host or verifier admin can update Wi-Fi tests.');
  }

  await dbQuery(
    `UPDATE stays
     SET wifi_download_mbps = $1,
         wifi_upload_mbps = $2,
         wifi_jitter_ms = $3,
         wifi_tested_at = NOW(),
         verified_at = NOW(),
         wifi_tester_note = $4,
         speedtest_proof_url = COALESCE($5, speedtest_proof_url),
         workspace_video_url = COALESCE($6, workspace_video_url)
     WHERE id = $7`,
    [
      Math.max(10, Math.round(input.downloadMbps)),
      Math.max(5, Math.round(input.uploadMbps)),
      Math.max(0, Math.round(input.jitterMs)),
      input.note?.trim() || 'Live router speed check verified',
      input.speedtestProofUrl?.trim() || null,
      input.workspaceVideoUrl?.trim() || null,
      stayId,
    ]
  );

  return { ok: true };
}

export async function syncHostRoomIcal(
  user: SessionUser,
  roomId: string,
  icalUrl: string
) {
  if (!isValidUuid(roomId)) {
    throw new AppError('VALIDATION_ERROR', 'Invalid room ID.');
  }
  const res = await dbQuery<{ host_id: string }>(
    `SELECT s.host_id FROM stay_rooms sr JOIN stays s ON s.id = sr.stay_id WHERE sr.id = $1`,
    [roomId]
  );
  const row = res.rows[0];
  if (!row) throw new AppError('NOT_FOUND', 'Room not found.');
  if (row.host_id !== user.id && user.role !== 'admin') {
    throw new AppError('FORBIDDEN', 'Not your property room.');
  }

  return syncRoomIcalFeed(roomId, icalUrl);
}

export async function toggleHostRoomBlock(
  user: SessionUser,
  roomId: string,
  stayDate: string,
  block: boolean
) {
  if (!isValidUuid(roomId) || !isValidIsoDate(stayDate)) {
    throw new AppError('VALIDATION_ERROR', 'Valid room ID and YYYY-MM-DD date required.');
  }

  return dbTransaction(async (tx) => {
    const ownerRes = await tx.query<{ host_id: string; units_total: number }>(
      `SELECT s.host_id, sr.units_total
       FROM stay_rooms sr
       JOIN stays s ON s.id = sr.stay_id
       WHERE sr.id = $1`,
      [roomId]
    );
    const rm = ownerRes.rows[0];
    if (!rm) throw new AppError('NOT_FOUND', 'Room not found.');
    if (rm.host_id !== user.id && user.role !== 'admin') {
      throw new AppError('FORBIDDEN', 'Not your property room.');
    }

    await tx.query(
      `INSERT INTO room_night_locks (id, room_id, stay_date, booked_units, blocked_units)
       VALUES ($1, $2, $3::date, 0, 0)
       ON CONFLICT (room_id, stay_date) DO NOTHING`,
      [crypto.randomUUID(), roomId, stayDate]
    );

    const lockRes = await tx.query<{ id: string; booked_units: number; blocked_units: number }>(
      'SELECT id, booked_units, blocked_units FROM room_night_locks WHERE room_id = $1 AND stay_date = $2::date FOR UPDATE',
      [roomId, stayDate]
    );
    const lock = lockRes.rows[0];
    const unitsTotal = toNum(rm.units_total, 1);

    if (block) {
      if (toNum(lock.booked_units) >= unitsTotal) {
        throw new AppError('CONFLICT', 'Cannot block date because all units are booked by guests.');
      }
      await tx.query(
        'UPDATE room_night_locks SET blocked_units = $1 WHERE id = $2',
        [Math.max(1, unitsTotal - toNum(lock.booked_units)), lock.id]
      );
    } else {
      await tx.query('UPDATE room_night_locks SET blocked_units = 0 WHERE id = $1', [lock.id]);
    }
    return { ok: true };
  });
}

export async function topUpHostAdWallet(user: SessionUser, amountUsd: number) {
  if (![50, 100, 200].includes(amountUsd)) {
    throw new AppError('VALIDATION_ERROR', 'Choose $50, $100, or $200 preset top-up.');
  }
  const vndToAdd = amountUsd * 25400;
  await dbQuery(
    `INSERT INTO host_wallets (host_id, balance_vnd, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (host_id)
     DO UPDATE SET balance_vnd = host_wallets.balance_vnd + $2, updated_at = NOW()`,
    [user.id, vndToAdd]
  );
  const res = await dbQuery<{ balance_vnd: string | number }>(
    'SELECT balance_vnd FROM host_wallets WHERE host_id = $1',
    [user.id]
  );
  return { balanceVnd: toNum(res.rows[0]?.balance_vnd, vndToAdd) };
}
