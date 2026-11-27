import crypto from 'node:crypto';
import type { SessionUser } from '@/lib/auth/session';
import { addDaysIso, getTodayIsoVietnam, isValidIsoDate, isValidUuid } from '@/lib/dates';
import { assertHostSubmitForReview } from '@/modules/listing-lifecycle';
import {
  captureStayRevision,
  pickChangedRoomProposals,
  pickChangedStayProposals,
  splitProtectedRoomPatch,
  splitProtectedStayPatch,
  stagePendingRevision,
} from '@/modules/listing-revisions';
import { clampHostMinNights, POLICY_MIN_NIGHTS } from '@/lib/business-rules';
import { dbQuery, dbTransaction, toNum } from '@/lib/db';
import { AppError } from '@/lib/errors';
import { syncRoomIcalFeed } from '@/lib/ical';
import { syncHostLeadFromApplicationTx } from '@/modules/host-lead-sync';
import { deleteStayUploadedMedia, getMediaStorageStatus } from '@/lib/storage';

export interface HostCoworkingSpot {
  name: string;
  distance: string;
}

export interface HostHouseRules {
  quietHours: string;
  smokingAllowed: boolean;
  partiesAllowed: boolean;
  petsNote: string;
  extraGuestNote: string;
}

export function parseHouseRules(raw: unknown): HostHouseRules {
  let obj: Record<string, unknown> = {};
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    obj = raw as Record<string, unknown>;
  } else if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') obj = parsed as Record<string, unknown>;
    } catch {
      obj = {};
    }
  }
  return {
    quietHours: typeof obj.quietHours === 'string' && obj.quietHours ? obj.quietHours : '22:00 - 07:00',
    smokingAllowed: Boolean(obj.smokingAllowed),
    partiesAllowed: Boolean(obj.partiesAllowed),
    petsNote: typeof obj.petsNote === 'string' ? obj.petsNote : '',
    extraGuestNote: typeof obj.extraGuestNote === 'string' ? obj.extraGuestNote : '',
  };
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
    status: string;
  }>(
    'SELECT id, host_id, hero_image, workspace_photo_url, gallery_images, status FROM stays WHERE id = $1',
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
  const [staysRes, roomsRes, appsRes, bookingsRes, blocksRes, notifRes] =
    await Promise.all([
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
    stays: staysRes.rows.map((s) => {
      const stayId = String(s.id);
      return {
        id: stayId,
        slug: String(s.slug),
        registrationCode: String(s.registration_code ?? ''),
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
        businessModel: 'booking_flow' as const,
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
        verificationTier: String(s.verification_tier ?? 'SELF_DECLARED'),
        isWifiVerified: Boolean(s.is_wifi_verified),
        isWorkReady: Boolean(s.is_work_ready),
        speedtestProofUrl: s.speedtest_proof_url ? String(s.speedtest_proof_url) : '',
        workspaceVideoUrl: s.workspace_video_url ? String(s.workspace_video_url) : '',
        workspaceSummaryEn: String(s.workspace_summary_en),
        workspaceSummaryVi: String(s.workspace_summary_vi),
        workspacePhotoUrl: String(s.workspace_photo_url),
        hasWorkspace: s.has_workspace !== undefined && s.has_workspace !== null ? Boolean(s.has_workspace) : true,
        hasErgonomicChair: Boolean(s.has_ergonomic_chair),
        hasExternalMonitor: Boolean(s.has_external_monitor),
        hasCallBooth: Boolean(s.has_call_booth),
        kitchenType: String(s.kitchen_type) as 'full' | 'kitchenette' | 'shared' | 'none',
        laundryType: String(s.laundry_type) as 'in_unit' | 'building' | 'service' | 'none',
        petFriendly: Boolean(s.pet_friendly),
        wheelchairFriendly: Boolean(s.wheelchair_friendly),
        houseRules: parseHouseRules(s.house_rules),
        checkinFrom: String(s.checkin_from ?? '14:00'),
        checkoutBefore: String(s.checkout_before ?? '12:00'),
        defaultMinNights: clampHostMinNights(toNum(s.default_min_nights, POLICY_MIN_NIGHTS)),
        googleRating: toNum(s.google_rating, 4.8),
        googleReviewCount: toNum(s.google_review_count, 0),
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
        rooms: roomsByStay.get(stayId) ?? [],
      };
    }),
    applications: appsRes.rows.map((a) => ({
      id: String(a.id),
      businessName: String(a.business_name),
      stayName: String(a.stay_name),
      destinationSlug: String(a.destination_slug),
      propertyType: String(a.property_type),
      businessModel: 'booking_flow',
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
        guestEmail: unlocked ? String(b.guest_email) : 'Hidden until fee locked',
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
    measuredDownloadMbps?: number;
    hasKitchen?: boolean;
    hasLaundry?: boolean;
    hasWorkspace?: boolean;
    hasErgonomicChair?: boolean;
    hasExternalMonitor?: boolean;
    kitchenType?: 'full' | 'kitchenette' | 'shared' | 'none';
    laundryType?: 'in_unit' | 'building' | 'service' | 'none';
    sourceDetail?: string;
    utmSource?: string;
    utmCampaign?: string;
  }
) {
  const id = crypto.randomUUID();
  const hasKitchen = input.hasKitchen ?? (input.kitchenType ? input.kitchenType !== 'none' : false);
  const hasLaundry = input.hasLaundry ?? (input.laundryType ? input.laundryType !== 'none' : false);
  const hasWorkspace = input.hasWorkspace ?? false;
  const declaredWifi = Math.max(0, Math.round(input.measuredDownloadMbps ?? 0));

  const syncResult = await dbTransaction(async (tx) => {
    const userRes = await tx.query<{ email: string; full_name: string; phone: string | null }>(
      'SELECT email, full_name, phone FROM users WHERE id = $1',
      [user.id]
    );
    const dbUser = userRes.rows[0];

    await tx.query(
      `INSERT INTO host_applications (
        id, applicant_user_id, business_name, stay_name, destination_slug,
        property_type, business_model, application_fee_eur, application_fee_paid,
        measured_download_mbps, has_kitchen, has_laundry, has_workspace,
        has_ergonomic_chair, has_external_monitor, kitchen_type, laundry_type,
        status, review_note
      ) VALUES ($1,$2,$3,$4,$5,$6,'booking_flow',0,TRUE,$7,$8,$9,$10,$11,$12,$13,$14,'submitted','Free host listing application submitted for review')`,
      [
        id,
        user.id,
        input.businessName.trim(),
        input.stayName.trim(),
        input.destinationSlug,
        input.propertyType,
        declaredWifi,
        hasKitchen,
        hasLaundry,
        hasWorkspace,
        Boolean(input.hasErgonomicChair),
        Boolean(input.hasExternalMonitor),
        input.kitchenType ?? (hasKitchen ? 'full' : 'none'),
        input.laundryType ?? (hasLaundry ? 'in_unit' : 'none'),
      ]
    );

    // Keep Lead Pipeline Stage, Host Account Status, and Listing Review Status distinct:
    // Submitting an application creates/syncs the CRM host_lead and leaves users.role unchanged
    // until Admin approves the application (or converts the lead).
    return syncHostLeadFromApplicationTx(tx, {
      applicationId: id,
      userId: user.id,
      email: dbUser?.email ?? user.email,
      fullName: dbUser?.full_name ?? user.fullName,
      phone: dbUser?.phone ?? user.phone,
      businessName: input.businessName,
      stayName: input.stayName,
      destinationSlug: input.destinationSlug,
      propertyType: input.propertyType,
      sourceDetail: input.sourceDetail,
      utmSource: input.utmSource,
      utmCampaign: input.utmCampaign,
    });
  });

  return {
    applicationId: id,
    status: 'submitted' as const,
    leadId: syncResult.leadId,
    leadStage: syncResult.stage,
  };
}

const DRAFT_PROPERTY_TYPES = [
  'apartment',
  'coliving',
  'boutique_hotel',
  'villa',
  'eco_lodge',
] as const;

/**
 * Create a listing as a `draft` stay immediately (Listing ID assigned now).
 * Wizard and Editor both operate on this same stay — no separate draft store.
 * Scaffold values satisfy NOT NULL columns and the editor's save validation;
 * the host replaces them before submitting for review.
 */
export async function createDraftStay(
  user: SessionUser,
  input: {
    destinationSlug?: string;
    propertyType?: string;
    titleEn?: string;
    titleVi?: string;
  } = {}
) {
  const propertyType = (
    DRAFT_PROPERTY_TYPES.includes(input.propertyType as (typeof DRAFT_PROPERTY_TYPES)[number])
      ? input.propertyType
      : 'apartment'
  ) as (typeof DRAFT_PROPERTY_TYPES)[number];

  return dbTransaction(async (tx) => {
    const destRes = input.destinationSlug
      ? await tx.query<{
          id: string;
          name_en: string;
          name_vi: string;
          map_x: number;
          map_y: number;
        }>(
          `SELECT id, name_en, name_vi, map_x, map_y FROM destinations WHERE slug = $1`,
          [input.destinationSlug]
        )
      : await tx.query<{
          id: string;
          name_en: string;
          name_vi: string;
          map_x: number;
          map_y: number;
        }>(
          `SELECT id, name_en, name_vi, map_x, map_y FROM destinations ORDER BY name_en ASC LIMIT 1`
        );
    const dest = destRes.rows[0];
    if (!dest) {
      throw new AppError('NOT_FOUND', 'No destination found for this listing.');
    }

    const id = crypto.randomUUID();
    const titleEn = input.titleEn?.trim() || 'New listing';
    const titleVi = input.titleVi?.trim() || 'Chỗ ở mới';
    const slugBase =
      titleEn
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') || 'listing';
    const slug = `${slugBase}-${id.slice(0, 6)}`;
    const regCode = `VN-NEW-${id.slice(0, 6).toUpperCase()}`;

    await tx.query(
      `INSERT INTO stays (
        id, slug, host_id, destination_id, title_en, title_vi, subtitle_en, subtitle_vi,
        description_en, description_vi, neighborhood_en, neighborhood_vi, exact_address,
        checkin_instructions_en, checkin_instructions_vi, registration_code,
        property_type, business_model, status, is_instant_book,
        cancellation_policy, wifi_download_mbps, wifi_upload_mbps, wifi_jitter_ms,
        verification_tier, is_wifi_verified, is_work_ready, verified_at,
        wifi_tester_note, workspace_summary_en, workspace_summary_vi, workspace_photo_url,
        has_workspace, has_ergonomic_chair, has_external_monitor, has_call_booth,
        kitchen_type, laundry_type, map_x, map_y, hero_image, gallery_images,
        amenities, nearby_coworking
      ) VALUES (
        $1,$2,$3,$4,$5,$6,
        'Comfortable Vietnam residence for 7 to 30+ night stays',
        'Không gian lưu trú thoải mái từ 7 đến 30+ đêm tại Việt Nam',
        'Newly listed property ready for comfortable weekly and monthly stays across Vietnam.',
        'Chỗ ở mới sẵn sàng cho lưu trú theo tuần và theo tháng thoải mái tại Việt Nam.',
        $7,$8,
        'Address unlocked upon confirmation',
        'Smart lock details emailed upon confirmation',
        'Mã nhận phòng gửi tự động sau khi đặt',
        $9,$10,'booking_flow','draft',TRUE,'flexible',
        100,75,4,
        'SELF_DECLARED', FALSE, FALSE, NOW(),
        'Host-declared property amenities & Internet profile',
        'Comfortable living space','Không gian sinh hoạt thoải mái',
        '/images/workspaces/ergonomic-indochine-desk.jpg',
        FALSE,FALSE,FALSE,FALSE,
        'full','in_unit',$11,$12,
        '/images/stays/hanoi-tayho-jade.jpg',
        '["/images/stays/hanoi-tayho-jade.jpg","/images/workspaces/ergonomic-indochine-desk.jpg"]'::jsonb,
        '[]'::jsonb,'[]'::jsonb
      )`,
      [
        id,
        slug,
        user.id,
        dest.id,
        titleEn,
        titleVi,
        dest.name_en,
        dest.name_vi,
        regCode,
        propertyType,
        dest.map_x,
        dest.map_y,
      ]
    );

    // Default room + package so pricing UI works out of the box
    // (same defaults the admin approval path used to seed).
    const roomId = crypto.randomUUID();
    const pkgId = crypto.randomUUID();
    await tx.query(
      `INSERT INTO stay_rooms (
        id, stay_id, name_en, name_vi, description_en, description_vi,
        max_guests, beds_count, units_total, room_image, room_features
      ) VALUES (
        $1,$2,'Private Studio','Studio Riêng Tư',
        'Comfortable private apartment for weekly and monthly stays.',
        'Căn hộ riêng thoải mái cho lưu trú theo tuần và theo tháng.',
        2,1,2,'/images/stays/hanoi-tayho-jade.jpg','[]'::jsonb
      )`,
      [roomId, id]
    );
    const today = getTodayIsoVietnam();
    await tx.query(
      `INSERT INTO stay_packages (
        id, stay_id, room_id, name_en, name_vi, description_en, description_vi,
        valid_from, valid_to, is_listed, wholesale_7_vnd, wholesale_14_vnd,
        wholesale_21_vnd, wholesale_30_vnd, compare_30_vnd, extra_night_vnd,
        is_deal_featured, deal_month_label
      ) VALUES (
        $1,$2,$3,'Standard Long-Stay Package','Gói Lưu Trú Dài Ngày',
        'All-inclusive 7/14/21/30 night rate.',
        'Trọn gói tiện ích cho 7/14/21/30 đêm.',
        $4,$5,TRUE,5800000,10800000,15200000,19500000,24500000,630000,FALSE,'January'
      )`,
      [pkgId, id, roomId, today, addDaysIso(today, 365)]
    );

    await captureStayRevision(tx, {
      stayId: id,
      actorUserId: user.id,
      action: 'create',
      snapshot: {
        kind: 'create',
        titleEn,
        titleVi,
        propertyType,
        destinationId: dest.id,
        status: 'draft',
      },
      changedFields: [],
      changeSummary: 'Listing draft created',
      status: 'applied',
    });

    return { id, slug, status: 'draft' as const, registrationCode: regCode };
  });
}

/**
 * Host submits a draft listing for review: draft → pending_review.
 * Admin then moderates the SAME stay to live (never creates a new one).
 */
export async function submitHostStayForReview(user: SessionUser, stayId: string) {
  if (!isValidUuid(stayId)) throw new AppError('VALIDATION_ERROR', 'Invalid stay ID.');
  return dbTransaction(async (tx) => {
    const res = await tx.query<{
      host_id: string;
      status: string;
      title_en: string;
      title_vi: string;
    }>(
      `SELECT host_id, status, title_en, title_vi FROM stays WHERE id = $1 FOR UPDATE`,
      [stayId]
    );
    const stay = res.rows[0];
    if (!stay) throw new AppError('NOT_FOUND', 'Stay not found.');
    if (stay.host_id !== user.id && user.role !== 'admin') {
      throw new AppError('FORBIDDEN', 'You do not own this property.');
    }
    assertHostSubmitForReview(String(stay.status));
    if (stay.title_en.trim().length < 2 || stay.title_vi.trim().length < 2) {
      throw new AppError(
        'VALIDATION_ERROR',
        'Add listing titles before submitting for review.'
      );
    }
    await tx.query(
      `UPDATE stays
       SET status = 'pending_review', reviewed_by = NULL, reviewed_at = NULL
       WHERE id = $1`,
      [stayId]
    );
    return { status: 'pending_review' as const };
  });
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
  // Pricing (BookingFlow unified)
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

  // House rules & availability defaults
  houseRules?: Partial<HostHouseRules>;
  checkinFrom?: string;
  checkoutBefore?: string;
  defaultMinNights?: number;
  status?: 'live' | 'paused';

  // Property Details & Self-Declared Amenities
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
  destinationId?: string;
  wifiDownloadMbps?: number;
  isEntirePlace?: boolean;
  bedrooms?: number | null;
  bathrooms?: number | null;
  areaSqm?: number | null;
  hostBioEn?: string;
  hostBioVi?: string;
  cancellationPolicy?: 'flexible' | 'moderate' | 'strict';
  isInstantBook?: boolean;
  workspaceSummaryEn?: string;
  workspaceSummaryVi?: string;
  hasWorkspace?: boolean;
  hasErgonomicChair?: boolean;
  hasExternalMonitor?: boolean;
  hasCallBooth?: boolean;
  kitchenType?: 'full' | 'kitchenette' | 'shared' | 'none';
  laundryType?: 'in_unit' | 'building' | 'service' | 'none';
  petFriendly?: boolean;
  wheelchairFriendly?: boolean;
  amenities?: string[];
  nearbyCoworking?: HostCoworkingSpot[];
}

export async function updateHostStayConfiguration(
  user: SessionUser,
  stayId: string,
  patchInput: UpdateHostStayFullInput,
  opts: { applyAsRevision?: boolean } = {}
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

    // Listing Revision Management (Phase 4): on a LIVE listing, price & policy
    // fields are staged as a pending revision instead of applying directly.
    // Unchanged values never stage (the editor always sends the full payload).
    let stagedSnapshot: Record<string, unknown> | null = null;
    let input = patchInput;
    if (String(current.status) === 'live' && !opts.applyAsRevision) {
      const { applied, proposed } = splitProtectedStayPatch(
        patchInput as unknown as Record<string, unknown>
      );
      const changed = await pickChangedStayProposals(tx, stayId, proposed, current);
      input = applied as UpdateHostStayFullInput;
      if (Object.keys(changed).length > 0) {
        stagedSnapshot = { kind: 'stay_patch', patch: changed };
      }
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

    const existingRules = parseHouseRules(current.house_rules);
    const nextHouseRules: HostHouseRules = input.houseRules
      ? {
          quietHours: input.houseRules.quietHours?.trim() || existingRules.quietHours,
          smokingAllowed:
            input.houseRules.smokingAllowed ?? existingRules.smokingAllowed,
          partiesAllowed:
            input.houseRules.partiesAllowed ?? existingRules.partiesAllowed,
          petsNote: input.houseRules.petsNote ?? existingRules.petsNote,
          extraGuestNote:
            input.houseRules.extraGuestNote ?? existingRules.extraGuestNote,
        }
      : existingRules;

    const currentStatus = String(current.status);
    const nextStatus =
      input.status && (user.role === 'admin' || currentStatus !== 'pending_review')
        ? input.status
        : currentStatus;

    // Optional destination move (updates map coordinates with it)
    let nextDestinationId = String(current.destination_id);
    let nextMapX = toNum(current.map_x, 0);
    let nextMapY = toNum(current.map_y, 0);
    if (input.destinationId) {
      if (!isValidUuid(input.destinationId)) {
        throw new AppError('VALIDATION_ERROR', 'Invalid destination ID.');
      }
      const destRes = await tx.query<{ id: string; map_x: number; map_y: number }>(
        'SELECT id, map_x, map_y FROM destinations WHERE id = $1',
        [input.destinationId]
      );
      const dest = destRes.rows[0];
      if (!dest) throw new AppError('NOT_FOUND', 'Destination not found.');
      nextDestinationId = dest.id;
      nextMapX = toNum(dest.map_x, nextMapX);
      nextMapY = toNum(dest.map_y, nextMapY);
    }
    // Optional host-declared Wi-Fi speed (download; upload estimated)
    const nextWifiDown =
      input.wifiDownloadMbps !== undefined
        ? Math.min(10000, Math.max(0, Math.round(input.wifiDownloadMbps)))
        : toNum(current.wifi_download_mbps, 100);
    const nextWifiUp =
      input.wifiDownloadMbps !== undefined
        ? Math.round(nextWifiDown * 0.75)
        : toNum(current.wifi_upload_mbps, 75);

    await tx.query(
      `UPDATE stays
       SET business_model = 'booking_flow',
           status = $31,
           title_en = $1,
           title_vi = $2,
           subtitle_en = $3,
           subtitle_vi = $4,
           description_en = $5,
           description_vi = $6,
           neighborhood_en = $7,
           neighborhood_vi = $8,
           exact_address = $9,
           checkin_instructions_en = $10,
           checkin_instructions_vi = $11,
           property_type = $12,
           cancellation_policy = $13,
           is_instant_book = $14,
           workspace_summary_en = $15,
           workspace_summary_vi = $16,
           workspace_photo_url = $17,
           has_workspace = $18,
           has_ergonomic_chair = $19,
           has_external_monitor = $20,
           has_call_booth = $21,
           kitchen_type = $22,
           laundry_type = $23,
           pet_friendly = $24,
           wheelchair_friendly = $25,
           hero_image = $26,
           gallery_images = $27::jsonb,
           amenities = $28::jsonb,
           nearby_coworking = $29::jsonb,
           house_rules = $32::jsonb,
           checkin_from = $33,
           checkout_before = $34,
           default_min_nights = $35,
           is_entire_place = $36,
           bedrooms = $37,
           bathrooms = $38,
           area_sqm = $39,
           host_bio_en = $40,
           host_bio_vi = $41,
           destination_id = $42,
           map_x = $43,
           map_y = $44,
           wifi_download_mbps = $45,
           wifi_upload_mbps = $46
       WHERE id = $30`,
      [
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
        input.hasWorkspace ?? (current.has_workspace !== undefined && current.has_workspace !== null ? Boolean(current.has_workspace) : true),
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
        nextStatus,
        JSON.stringify(nextHouseRules),
        input.checkinFrom?.trim() || String(current.checkin_from ?? '14:00'),
        input.checkoutBefore?.trim() || String(current.checkout_before ?? '12:00'),
        input.defaultMinNights !== undefined
          ? clampHostMinNights(input.defaultMinNights)
          : clampHostMinNights(toNum(current.default_min_nights, POLICY_MIN_NIGHTS)),
        input.isEntirePlace ?? (current.is_entire_place !== undefined && current.is_entire_place !== null ? Boolean(current.is_entire_place) : true),
        input.bedrooms !== undefined ? input.bedrooms : (current.bedrooms ?? null),
        input.bathrooms !== undefined ? input.bathrooms : (current.bathrooms ?? null),
        input.areaSqm !== undefined ? input.areaSqm : (current.area_sqm ?? null),
        input.hostBioEn !== undefined ? input.hostBioEn.trim() : String(current.host_bio_en ?? ''),
        input.hostBioVi !== undefined ? input.hostBioVi.trim() : String(current.host_bio_vi ?? ''),
        nextDestinationId,
        nextMapX,
        nextMapY,
        nextWifiDown,
        nextWifiUp,
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

    if (stagedSnapshot) {
      const patch = stagedSnapshot.patch as Record<string, unknown>;
      await stagePendingRevision(tx, {
        stayId,
        actorUserId: user.id,
        snapshot: stagedSnapshot,
        changedFields: Object.keys(patch),
        changeSummary: `Price/policy change pending review: ${Object.keys(patch).join(', ')}`,
      });
    }

    return {
      ok: true,
      pendingRevision: stagedSnapshot !== null,
      stagedFields: stagedSnapshot
        ? Object.keys(stagedSnapshot.patch as Record<string, unknown>)
        : [],
    };
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
  rawInput: Partial<RoomInput>,
  opts: { applyAsRevision?: boolean } = {}
) {
  if (!isValidUuid(roomId)) {
    throw new AppError('VALIDATION_ERROR', 'Invalid room identifier.');
  }
  const stayRow = await assertHostOwnsStay(user, stayId);

  return dbTransaction(async (tx) => {
    const roomRes = await tx.query<Record<string, unknown>>(
      'SELECT * FROM stay_rooms WHERE id = $1 AND stay_id = $2 FOR UPDATE',
      [roomId, stayId]
    );
    const cur = roomRes.rows[0];
    if (!cur) throw new AppError('NOT_FOUND', 'Room not found for this stay.');

    // Listing Revision Management (Phase 4): room price edits on a LIVE
    // listing stage a pending revision; names/capacity keep applying directly.
    let stagedSnapshot: Record<string, unknown> | null = null;
    let input = rawInput;
    if (String(stayRow.status) === 'live' && !opts.applyAsRevision) {
      const { applied, proposed } = splitProtectedRoomPatch(
        rawInput as unknown as Record<string, unknown>
      );
      const changed = await pickChangedRoomProposals(tx, stayId, roomId, proposed);
      input = applied as Partial<RoomInput>;
      if (Object.keys(changed).length > 0) {
        stagedSnapshot = { kind: 'room_patch', roomId, patch: changed };
      }
    }

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

    if (stagedSnapshot) {
      const patch = stagedSnapshot.patch as Record<string, unknown>;
      await stagePendingRevision(tx, {
        stayId,
        actorUserId: user.id,
        snapshot: stagedSnapshot,
        changedFields: Object.keys(patch),
        changeSummary: `Room price change pending review: ${Object.keys(patch).join(', ')}`,
      });
    }

    return {
      ok: true,
      pendingRevision: stagedSnapshot !== null,
      stagedFields: stagedSnapshot
        ? Object.keys(stagedSnapshot.patch as Record<string, unknown>)
        : [],
    };
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
      Math.max(0, Math.round(input.downloadMbps)),
      Math.max(0, Math.round(input.uploadMbps)),
      Math.max(0, Math.round(input.jitterMs)),
      input.note?.trim() || 'Host-reported Internet speed updated',
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

export type HostConsoleData = Awaited<ReturnType<typeof getHostConsoleData>>;
export type HostStaySummary = HostConsoleData['stays'][number];

