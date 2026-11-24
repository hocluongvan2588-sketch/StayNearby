import crypto from 'crypto';
import {
  assertListingOwnership,
  requireRole,
} from '@/lib/auth/rbac';
import type { SessionUser } from '@/lib/auth/session';
import type { CancellationPolicyVersion } from '@/lib/config';
import { dbQuery, withTransaction } from '@/lib/db';
import { AppError } from '@/lib/errors';
import { addDaysIso, enumerateNights, getTodayIsoInTimezone } from '@/lib/format';
import { assertUuid } from '@/lib/validation';
import {
  persistListingPhotoBinary,
  removePersistedPhotoBinary,
  validatePhotoUpload,
  verifyImageBufferSignature,
} from '@/lib/storage/photos';
import { isPgUniqueViolation } from '@/modules/bookings';

export interface HostListingItem {
  id: string;
  slug: string;
  status: string;
  propertyType: string;
  titleEn: string;
  areaNameVi: string;
  cityVi: string;
  maxGuests: number;
  baseNightlyRateVnd: number;
  cleaningFeeVnd: number;
  exactAddress: string;
  reviewNote: string | null;
  photoCount: number;
  coverPhotoUrl: string | null;
  hasPendingRevision: boolean;
  isDemo: boolean;
  updatedAt: string;
}

export interface HostListingPhotoItem {
  id: string;
  storagePath: string;
  url: string;
  altTextEn: string;
  sortOrder: number;
  isCover: boolean;
  isDraft: boolean;
}

export interface HostListingRevisionItem {
  id: string;
  revisionNumber: number;
  status: 'draft' | 'pending_review' | 'approved' | 'rejected';
  titleEn: string;
  summaryEn: string;
  descriptionEn: string;
  houseRulesEn: string[];
  hasDedicatedDesk: boolean;
  workspaceNotesEn: string;
  checkinConditionsEn: string;
  lateCheckinAvailable: boolean;
  exactAddress: string;
  checkinInstructionsEn: string;
  rejectionReason: string | null;
  submittedAt: string | null;
}

export interface HostListingDetail {
  id: string;
  hostId: string;
  areaId: string;
  areaNameVi: string;
  cityVi: string;
  timezone: string;
  slug: string;
  status: string;
  propertyType: 'apartment' | 'studio' | 'villa' | 'house' | 'homestay';
  maxGuests: number;
  bedrooms: number;
  beds: number;
  bathrooms: number;
  minNights: number;
  maxNights: number;
  baseNightlyRateVnd: number;
  cleaningFeeVnd: number;
  cancellationPolicyVersion: CancellationPolicyVersion;
  paymentTerms: string;
  exactAddress: string;
  checkinInstructionsEn: string;
  hostContactPhone: string;
  reviewNote: string | null;
  publishedTitleEn: string | null;
  latestRevision: HostListingRevisionItem;
  photos: HostListingPhotoItem[];
  amenityCodes: string[];
  isDemo: boolean;
}

export interface AreaOption {
  id: string;
  slug: string;
  nameVi: string;
  cityVi: string;
  timezone: string;
}

export interface AmenityOption {
  code: string;
  category: string;
  labelVi: string;
  labelEn: string;
}

export interface HostCalendarNight {
  date: string;
  sourceType: 'booking' | 'host_block';
  bookingId: string | null;
  bookingCode: string | null;
  guestName: string | null;
  blockReason: string | null;
}

export interface HostCalendarRateOverride {
  date: string;
  nightlyRateVnd: number;
}

export interface HostCalendarData {
  listingId: string;
  listingTitle: string;
  timezone: string;
  baseNightlyRateVnd: number;
  fromDate: string;
  toDate: string;
  blockedNights: HostCalendarNight[];
  rateOverrides: HostCalendarRateOverride[];
}

function slugifyTitle(title: string): string {
  const ascii = title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  const suffix = crypto.randomBytes(2).toString('hex');
  return `${ascii || 'workinghome-stay'}-${suffix}`;
}

export async function listHostFormOptions(): Promise<{
  areas: AreaOption[];
  amenities: AmenityOption[];
}> {
  const [areasRes, amenitiesRes] = await Promise.all([
    dbQuery<{
      id: string;
      slug: string;
      name_vi: string;
      city_vi: string;
      timezone: string;
    }>(
      `SELECT id, slug, name_vi, city_vi, timezone
       FROM areas
       WHERE is_published = TRUE
       ORDER BY city_vi ASC, name_vi ASC`
    ),
    dbQuery<{
      code: string;
      category: string;
      label_vi: string;
      label_en: string;
    }>(
      `SELECT code, category, label_vi, label_en
       FROM amenities
       ORDER BY CASE code
         WHEN 'kitchen' THEN 1
         WHEN 'washer' THEN 2
         WHEN 'dedicated_desk' THEN 3
         WHEN 'wifi' THEN 4
         ELSE 5
       END, label_vi ASC`
    ),
  ]);

  return {
    areas: areasRes.rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      nameVi: r.name_vi,
      cityVi: r.city_vi,
      timezone: r.timezone,
    })),
    amenities: amenitiesRes.rows.map((r) => ({
      code: r.code,
      category: r.category,
      labelVi: r.label_vi,
      labelEn: r.label_en,
    })),
  };
}

export async function getHostDashboardListings(
  actor: SessionUser | null
): Promise<HostListingItem[]> {
  const host = requireRole(actor, 'host');

  const res = await dbQuery<{
    id: string;
    slug: string;
    status: string;
    property_type: string;
    title_en: string;
    area_name_vi: string;
    city_vi: string;
    max_guests: number;
    base_nightly_rate_vnd: number;
    cleaning_fee_vnd: number;
    exact_address: string;
    review_note: string | null;
    photo_count: string;
    cover_url: string | null;
    pending_rev_count: string;
    is_demo: boolean;
    updated_at: string;
  }>(
    `SELECT l.id, l.slug, l.status, l.property_type,
            COALESCE(
              l.published_title_en,
              (SELECT lr.title_en FROM listing_revisions lr
               WHERE lr.listing_id = l.id
               ORDER BY lr.revision_number DESC LIMIT 1),
              'Chỗ ở chưa đặt tên'
            ) AS title_en,
            a.name_vi AS area_name_vi, a.city_vi,
            l.max_guests, l.base_nightly_rate_vnd, l.cleaning_fee_vnd,
            l.exact_address, l.review_note, l.is_demo, l.updated_at::text AS updated_at,
            (SELECT COUNT(*)::text FROM listing_photos p WHERE p.listing_id = l.id) AS photo_count,
            (
              SELECT COALESCE(p.public_url, p.storage_path)
              FROM listing_photos p
              WHERE p.listing_id = l.id
              ORDER BY p.is_cover DESC, p.sort_order ASC
              LIMIT 1
            ) AS cover_url,
            (
              SELECT COUNT(*)::text FROM listing_revisions lr
              WHERE lr.listing_id = l.id AND lr.status = 'pending_review'
            ) AS pending_rev_count
     FROM listings l
     JOIN areas a ON a.id = l.area_id
     WHERE l.host_id = $1
     ORDER BY l.updated_at DESC, l.created_at DESC`,
    [host.id]
  );

  return res.rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    status: r.status,
    propertyType: r.property_type,
    titleEn: r.title_en,
    areaNameVi: r.area_name_vi,
    cityVi: r.city_vi,
    maxGuests: Number(r.max_guests),
    baseNightlyRateVnd: Number(r.base_nightly_rate_vnd),
    cleaningFeeVnd: Number(r.cleaning_fee_vnd),
    exactAddress: r.exact_address,
    reviewNote: r.review_note,
    photoCount: Number(r.photo_count),
    coverPhotoUrl: r.cover_url,
    hasPendingRevision: Number(r.pending_rev_count) > 0,
    isDemo: Boolean(r.is_demo),
    updatedAt: r.updated_at,
  }));
}

export async function getHostListingById(
  actor: SessionUser | null,
  listingId: string
): Promise<HostListingItem> {
  requireRole(actor, ['host', 'admin']);
  const validListingId = assertUuid(listingId, 'listing ID');

  const res = await dbQuery<{
    id: string;
    host_id: string;
    slug: string;
    status: string;
    property_type: string;
    title_en: string;
    area_name_vi: string;
    city_vi: string;
    max_guests: number;
    base_nightly_rate_vnd: number;
    cleaning_fee_vnd: number;
    exact_address: string;
    review_note: string | null;
    photo_count: string;
    cover_url: string | null;
    pending_rev_count: string;
    is_demo: boolean;
    updated_at: string;
  }>(
    `SELECT l.id, l.host_id, l.slug, l.status, l.property_type,
            COALESCE(
              l.published_title_en,
              (SELECT lr.title_en FROM listing_revisions lr
               WHERE lr.listing_id = l.id
               ORDER BY lr.revision_number DESC LIMIT 1),
              'Chỗ ở chưa đặt tên'
            ) AS title_en,
            a.name_vi AS area_name_vi, a.city_vi,
            l.max_guests, l.base_nightly_rate_vnd, l.cleaning_fee_vnd,
            l.exact_address, l.review_note, l.is_demo, l.updated_at::text AS updated_at,
            (SELECT COUNT(*)::text FROM listing_photos p WHERE p.listing_id = l.id) AS photo_count,
            (
              SELECT COALESCE(p.public_url, p.storage_path)
              FROM listing_photos p
              WHERE p.listing_id = l.id
              ORDER BY p.is_cover DESC, p.sort_order ASC
              LIMIT 1
            ) AS cover_url,
            (
              SELECT COUNT(*)::text FROM listing_revisions lr
              WHERE lr.listing_id = l.id AND lr.status = 'pending_review'
            ) AS pending_rev_count
     FROM listings l
     JOIN areas a ON a.id = l.area_id
     WHERE l.id = $1`,
    [validListingId]
  );

  const row = res.rows[0];
  if (!row) {
    throw new AppError('NOT_FOUND', 'Listing not found.');
  }

  assertListingOwnership(actor, row.host_id);

  return {
    id: row.id,
    slug: row.slug,
    status: row.status,
    propertyType: row.property_type,
    titleEn: row.title_en,
    areaNameVi: row.area_name_vi,
    cityVi: row.city_vi,
    maxGuests: Number(row.max_guests),
    baseNightlyRateVnd: Number(row.base_nightly_rate_vnd),
    cleaningFeeVnd: Number(row.cleaning_fee_vnd),
    exactAddress: row.exact_address,
    reviewNote: row.review_note,
    photoCount: Number(row.photo_count),
    coverPhotoUrl: row.cover_url,
    hasPendingRevision: Number(row.pending_rev_count) > 0,
    isDemo: Boolean(row.is_demo),
    updatedAt: row.updated_at,
  };
}

export async function getHostListingDetail(
  actor: SessionUser | null,
  listingId: string
): Promise<HostListingDetail> {
  requireRole(actor, ['host', 'admin']);
  const validListingId = assertUuid(listingId, 'listing ID');

  const listingRes = await dbQuery<{
    id: string;
    host_id: string;
    area_id: string;
    area_name_vi: string;
    city_vi: string;
    timezone: string;
    slug: string;
    status: string;
    property_type: 'apartment' | 'studio' | 'villa' | 'house' | 'homestay';
    max_guests: number;
    bedrooms: number;
    beds: number;
    bathrooms: string;
    min_nights: number;
    max_nights: number;
    base_nightly_rate_vnd: number;
    cleaning_fee_vnd: number;
    cancellation_policy_version: CancellationPolicyVersion;
    payment_terms: string;
    exact_address: string;
    checkin_instructions_en: string;
    host_contact_phone: string | null;
    review_note: string | null;
    published_title_en: string | null;
    is_demo: boolean;
  }>(
    `SELECT l.id, l.host_id, l.area_id,
            a.name_vi AS area_name_vi, a.city_vi, a.timezone,
            l.slug, l.status, l.property_type,
            l.max_guests, l.bedrooms, l.beds, l.bathrooms::text AS bathrooms,
            l.min_nights, l.max_nights,
            l.base_nightly_rate_vnd, l.cleaning_fee_vnd,
            l.cancellation_policy_version, l.payment_terms,
            l.exact_address, l.checkin_instructions_en,
            l.host_contact_phone, l.review_note, l.published_title_en,
            l.is_demo
     FROM listings l
     JOIN areas a ON a.id = l.area_id
     WHERE l.id = $1`,
    [validListingId]
  );

  const listing = listingRes.rows[0];
  if (!listing) {
    throw new AppError('NOT_FOUND', 'Listing not found.');
  }

  assertListingOwnership(actor, listing.host_id);

  const [revRes, photoRes, amenityRes] = await Promise.all([
    dbQuery<{
      id: string;
      revision_number: number;
      status: 'draft' | 'pending_review' | 'approved' | 'rejected';
      title_en: string;
      summary_en: string;
      description_en: string;
      house_rules_en: string[];
      has_dedicated_desk: boolean;
      workspace_notes_en: string | null;
      checkin_conditions_en: string;
      late_checkin_available: boolean;
      exact_address: string;
      checkin_instructions_en: string;
      rejection_reason: string | null;
      submitted_at: string | null;
    }>(
      `SELECT id, revision_number, status, title_en, summary_en, description_en,
              house_rules_en, has_dedicated_desk, workspace_notes_en,
              checkin_conditions_en, late_checkin_available,
              exact_address, checkin_instructions_en,
              rejection_reason, submitted_at::text AS submitted_at
       FROM listing_revisions
       WHERE listing_id = $1
       ORDER BY revision_number DESC
       LIMIT 1`,
      [listing.id]
    ),
    dbQuery<{
      id: string;
      storage_path: string;
      url: string;
      alt_text_en: string;
      sort_order: number;
      is_cover: boolean;
      is_draft: boolean;
    }>(
      `SELECT id, storage_path,
              COALESCE(public_url, storage_path) AS url,
              alt_text_en, sort_order, is_cover, is_draft
       FROM listing_photos
       WHERE listing_id = $1
       ORDER BY is_cover DESC, sort_order ASC, created_at ASC`,
      [listing.id]
    ),
    dbQuery<{ amenity_code: string }>(
      `SELECT amenity_code FROM listing_amenities WHERE listing_id = $1`,
      [listing.id]
    ),
  ]);

  const rev = revRes.rows[0];
  return {
    id: listing.id,
    hostId: listing.host_id,
    areaId: listing.area_id,
    areaNameVi: listing.area_name_vi,
    cityVi: listing.city_vi,
    timezone: listing.timezone,
    slug: listing.slug,
    status: listing.status,
    propertyType: listing.property_type,
    maxGuests: Number(listing.max_guests),
    bedrooms: Number(listing.bedrooms),
    beds: Number(listing.beds),
    bathrooms: Number(listing.bathrooms),
    minNights: Number(listing.min_nights),
    maxNights: Number(listing.max_nights),
    baseNightlyRateVnd: Number(listing.base_nightly_rate_vnd),
    cleaningFeeVnd: Number(listing.cleaning_fee_vnd),
    cancellationPolicyVersion: listing.cancellation_policy_version,
    paymentTerms: listing.payment_terms,
    exactAddress: listing.exact_address,
    checkinInstructionsEn: listing.checkin_instructions_en,
    hostContactPhone: listing.host_contact_phone ?? '',
    reviewNote: listing.review_note,
    publishedTitleEn: listing.published_title_en,
    latestRevision: rev
      ? {
          id: rev.id,
          revisionNumber: Number(rev.revision_number),
          status: rev.status,
          titleEn: rev.title_en,
          summaryEn: rev.summary_en,
          descriptionEn: rev.description_en,
          houseRulesEn: Array.isArray(rev.house_rules_en) ? rev.house_rules_en : [],
          hasDedicatedDesk: Boolean(rev.has_dedicated_desk),
          workspaceNotesEn: rev.workspace_notes_en ?? '',
          checkinConditionsEn: rev.checkin_conditions_en ?? '',
          lateCheckinAvailable: Boolean(rev.late_checkin_available),
          exactAddress: rev.exact_address,
          checkinInstructionsEn: rev.checkin_instructions_en,
          rejectionReason: rev.rejection_reason,
          submittedAt: rev.submitted_at,
        }
      : {
          id: '',
          revisionNumber: 1,
          status: 'draft',
          titleEn: listing.published_title_en ?? '',
          summaryEn: '',
          descriptionEn: '',
          houseRulesEn: [],
          hasDedicatedDesk: false,
          workspaceNotesEn: '',
          checkinConditionsEn: '',
          lateCheckinAvailable: false,
          exactAddress: listing.exact_address,
          checkinInstructionsEn: listing.checkin_instructions_en,
          rejectionReason: null,
          submittedAt: null,
        },
    photos: photoRes.rows.map((p) => ({
      id: p.id,
      storagePath: p.storage_path,
      url: p.url,
      altTextEn: p.alt_text_en,
      sortOrder: Number(p.sort_order),
      isCover: Boolean(p.is_cover),
      isDraft: Boolean(p.is_draft),
    })),
    amenityCodes: amenityRes.rows.map((a) => a.amenity_code),
    isDemo: Boolean(listing.is_demo),
  };
}

export interface HostListingWriteInput {
  areaId: string;
  propertyType: 'apartment' | 'studio' | 'villa' | 'house' | 'homestay';
  maxGuests: number;
  bedrooms: number;
  beds: number;
  bathrooms: number;
  minNights: number;
  maxNights: number;
  baseNightlyRateVnd: number;
  cleaningFeeVnd: number;
  cancellationPolicyVersion?: CancellationPolicyVersion;
  titleEn: string;
  summaryEn: string;
  descriptionEn: string;
  houseRulesEn: string[];
  hasDedicatedDesk: boolean;
  workspaceNotesEn?: string;
  checkinConditionsEn?: string;
  lateCheckinAvailable?: boolean;
  exactAddress: string;
  checkinInstructionsEn: string;
  hostContactPhone?: string;
  amenityCodes?: string[];
}

function validateListingWriteInput(input: HostListingWriteInput) {
  if (!input.titleEn.trim() || !input.summaryEn.trim() || !input.descriptionEn.trim()) {
    throw new AppError(
      'VALIDATION_ERROR',
      'Tiêu đề, mô tả ngắn và mô tả chi tiết (tiếng Anh) không được để trống.'
    );
  }
  if (!input.exactAddress.trim()) {
    throw new AppError('VALIDATION_ERROR', 'Vui lòng nhập địa chỉ chi tiết của chỗ ở.');
  }
  if (!Number.isInteger(input.baseNightlyRateVnd) || input.baseNightlyRateVnd <= 0) {
    throw new AppError('VALIDATION_ERROR', 'Giá mỗi đêm phải là số nguyên dương (VND).');
  }
  if (!Number.isInteger(input.cleaningFeeVnd) || input.cleaningFeeVnd < 0) {
    throw new AppError('VALIDATION_ERROR', 'Phí dọn dẹp phải là số nguyên không âm (VND).');
  }
  if (input.minNights < 1 || input.maxNights < input.minNights) {
    throw new AppError(
      'VALIDATION_ERROR',
      'Số đêm tối đa phải lớn hơn hoặc bằng số đêm tối thiểu.'
    );
  }
  if (input.maxGuests < 1 || input.maxGuests > 20) {
    throw new AppError('VALIDATION_ERROR', 'Sức chứa phải từ 1 đến 20 khách.');
  }
}

export async function createHostListing(
  actor: SessionUser | null,
  input: HostListingWriteInput
): Promise<HostListingDetail> {
  const host = requireRole(actor, 'host');
  validateListingWriteInput(input);

  const areaCheck = await dbQuery<{ id: string }>(
    `SELECT id FROM areas WHERE id = $1`,
    [input.areaId]
  );
  if (!areaCheck.rows[0]) {
    throw new AppError('VALIDATION_ERROR', 'Khu vực được chọn không hợp lệ.');
  }

  const listingId = crypto.randomUUID();
  const slug = slugifyTitle(input.titleEn);
  const rules = input.houseRulesEn.map((r) => r.trim()).filter(Boolean);
  const amenities = Array.from(new Set(input.amenityCodes ?? []));

  await withTransaction(
    async (tx) => {
      await tx.query(
        `INSERT INTO listings (
           id, host_id, area_id, slug, status, property_type,
           max_guests, bedrooms, beds, bathrooms, min_nights, max_nights,
           base_nightly_rate_vnd, cleaning_fee_vnd,
           cancellation_policy_version,
           exact_address, checkin_instructions_en, host_contact_phone,
           is_demo
         ) VALUES (
           $1, $2, $3, $4, 'draft', $5,
           $6, $7, $8, $9, $10, $11,
           $12, $13,
           $14,
           $15, $16, $17,
           FALSE
         )`,
        [
          listingId,
          host.id,
          input.areaId,
          slug,
          input.propertyType,
          input.maxGuests,
          input.bedrooms,
          input.beds,
          input.bathrooms,
          input.minNights,
          input.maxNights,
          input.baseNightlyRateVnd,
          input.cleaningFeeVnd,
          input.cancellationPolicyVersion ?? 'flexible_24h',
          input.exactAddress.trim(),
          input.checkinInstructionsEn.trim(),
          input.hostContactPhone?.trim() || null,
        ]
      );

      await tx.query(
        `INSERT INTO listing_revisions (
           listing_id, revision_number, status,
           title_en, summary_en, description_en, house_rules_en,
           has_dedicated_desk, workspace_notes_en,
           checkin_conditions_en, late_checkin_available,
           exact_address, checkin_instructions_en
         ) VALUES (
           $1, 1, 'draft',
           $2, $3, $4, $5::jsonb,
           $6, $7,
           $8, $9,
           $10, $11
         )`,
        [
          listingId,
          input.titleEn.trim(),
          input.summaryEn.trim(),
          input.descriptionEn.trim(),
          JSON.stringify(rules),
          Boolean(input.hasDedicatedDesk),
          input.workspaceNotesEn?.trim() || null,
          input.checkinConditionsEn?.trim() || '',
          Boolean(input.lateCheckinAvailable),
          input.exactAddress.trim(),
          input.checkinInstructionsEn.trim(),
        ]
      );

      for (const code of amenities) {
        await tx.query(
          `INSERT INTO listing_amenities (listing_id, amenity_code)
           SELECT $1, code FROM amenities WHERE code = $2
           ON CONFLICT DO NOTHING`,
          [listingId, code]
        );
      }
    },
    { actorId: host.id }
  );

  return getHostListingDetail(host, listingId);
}

export async function updateHostListing(
  actor: SessionUser | null,
  listingId: string,
  input: HostListingWriteInput
): Promise<HostListingDetail> {
  const authed = requireRole(actor, ['host', 'admin']);
  const validListingId = assertUuid(listingId, 'listing ID');
  validateListingWriteInput(input);

  const rules = input.houseRulesEn.map((r) => r.trim()).filter(Boolean);
  const amenities = input.amenityCodes ? Array.from(new Set(input.amenityCodes)) : null;

  await withTransaction(
    async (tx) => {
      const existingRes = await tx.query<{
        id: string;
        host_id: string;
        status: string;
      }>(
        `SELECT id, host_id, status FROM listings WHERE id = $1 FOR UPDATE`,
        [validListingId]
      );
      const listing = existingRes.rows[0];
      if (!listing) {
        throw new AppError('NOT_FOUND', 'Listing not found.');
      }

      assertListingOwnership(authed, listing.host_id);

      await tx.query(
        `UPDATE listings
         SET area_id = $2,
             property_type = $3,
             max_guests = $4,
             bedrooms = $5,
             beds = $6,
             bathrooms = $7,
             min_nights = $8,
             max_nights = $9,
             base_nightly_rate_vnd = $10,
             cleaning_fee_vnd = $11,
             cancellation_policy_version = $12,
             exact_address = $13,
             checkin_instructions_en = $14,
             host_contact_phone = $15,
             updated_at = NOW()
         WHERE id = $1`,
        [
          listing.id,
          input.areaId,
          input.propertyType,
          input.maxGuests,
          input.bedrooms,
          input.beds,
          input.bathrooms,
          input.minNights,
          input.maxNights,
          input.baseNightlyRateVnd,
          input.cleaningFeeVnd,
          input.cancellationPolicyVersion ?? 'flexible_24h',
          input.exactAddress.trim(),
          input.checkinInstructionsEn.trim(),
          input.hostContactPhone?.trim() || null,
        ]
      );

      if (amenities !== null) {
        await tx.query(`DELETE FROM listing_amenities WHERE listing_id = $1`, [
          listing.id,
        ]);
        for (const code of amenities) {
          await tx.query(
            `INSERT INTO listing_amenities (listing_id, amenity_code)
             SELECT $1, code FROM amenities WHERE code = $2
             ON CONFLICT DO NOTHING`,
            [listing.id, code]
          );
        }
      }

      const latestRevRes = await tx.query<{
        id: string;
        revision_number: number;
        status: string;
      }>(
        `SELECT id, revision_number, status
         FROM listing_revisions
         WHERE listing_id = $1
         ORDER BY revision_number DESC
         LIMIT 1`,
        [listing.id]
      );

      const latestRev = latestRevRes.rows[0];
      if (latestRev && (latestRev.status === 'draft' || latestRev.status === 'rejected')) {
        await tx.query(
          `UPDATE listing_revisions
           SET status = 'draft',
               title_en = $2,
               summary_en = $3,
               description_en = $4,
               house_rules_en = $5::jsonb,
               has_dedicated_desk = $6,
               workspace_notes_en = $7,
               checkin_conditions_en = $8,
               late_checkin_available = $9,
               exact_address = $10,
               checkin_instructions_en = $11,
               updated_at = NOW()
           WHERE id = $1`,
          [
            latestRev.id,
            input.titleEn.trim(),
            input.summaryEn.trim(),
            input.descriptionEn.trim(),
            JSON.stringify(rules),
            Boolean(input.hasDedicatedDesk),
            input.workspaceNotesEn?.trim() || null,
            input.checkinConditionsEn?.trim() || '',
            Boolean(input.lateCheckinAvailable),
            input.exactAddress.trim(),
            input.checkinInstructionsEn.trim(),
          ]
        );
      } else {
        // Listing was already published or awaiting review -> store changes as a new draft revision
        const nextNum = latestRev ? Number(latestRev.revision_number) + 1 : 1;
        await tx.query(
          `INSERT INTO listing_revisions (
             listing_id, revision_number, status,
             title_en, summary_en, description_en, house_rules_en,
             has_dedicated_desk, workspace_notes_en,
             checkin_conditions_en, late_checkin_available,
             exact_address, checkin_instructions_en
           ) VALUES (
             $1, $2, 'draft',
             $3, $4, $5, $6::jsonb,
             $7, $8,
             $9, $10,
             $11, $12
           )`,
          [
            listing.id,
            nextNum,
            input.titleEn.trim(),
            input.summaryEn.trim(),
            input.descriptionEn.trim(),
            JSON.stringify(rules),
            Boolean(input.hasDedicatedDesk),
            input.workspaceNotesEn?.trim() || null,
            input.checkinConditionsEn?.trim() || '',
            Boolean(input.lateCheckinAvailable),
            input.exactAddress.trim(),
            input.checkinInstructionsEn.trim(),
          ]
        );
      }
    },
    { actorId: authed.id }
  );

  return getHostListingDetail(authed, listingId);
}

export async function submitHostListingForReview(
  actor: SessionUser | null,
  listingId: string
): Promise<HostListingDetail> {
  const authed = requireRole(actor, ['host', 'admin']);
  const validListingId = assertUuid(listingId, 'listing ID');

  await withTransaction(
    async (tx) => {
      const listingRes = await tx.query<{
        id: string;
        host_id: string;
        status: string;
        exact_address: string;
        base_nightly_rate_vnd: number;
      }>(
        `SELECT id, host_id, status, exact_address, base_nightly_rate_vnd
         FROM listings WHERE id = $1 FOR UPDATE`,
        [validListingId]
      );
      const listing = listingRes.rows[0];
      if (!listing) {
        throw new AppError('NOT_FOUND', 'Listing not found.');
      }

      assertListingOwnership(authed, listing.host_id);

      const photoCountRes = await tx.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM listing_photos WHERE listing_id = $1`,
        [listing.id]
      );
      if (Number(photoCountRes.rows[0].count) < 1) {
        throw new AppError(
          'VALIDATION_ERROR',
          'Vui lòng tải lên ít nhất 1 ảnh chỗ ở trước khi gửi duyệt.'
        );
      }

      if (!listing.exact_address.trim() || Number(listing.base_nightly_rate_vnd) <= 0) {
        throw new AppError(
          'VALIDATION_ERROR',
          'Chỗ ở cần có đầy đủ địa chỉ chi tiết và giá mỗi đêm hợp lệ.'
        );
      }

      const revRes = await tx.query<{
        id: string;
        status: string;
        title_en: string;
        description_en: string;
      }>(
        `SELECT id, status, title_en, description_en
         FROM listing_revisions
         WHERE listing_id = $1
         ORDER BY revision_number DESC
         LIMIT 1`,
        [listing.id]
      );
      const rev = revRes.rows[0];
      if (!rev || !rev.title_en.trim() || !rev.description_en.trim()) {
        throw new AppError(
          'VALIDATION_ERROR',
          'Chỗ ở cần có tiêu đề và mô tả trước khi gửi kiểm duyệt.'
        );
      }

      await tx.query(
        `UPDATE listing_revisions
         SET status = 'pending_review',
             submitted_at = NOW(),
             rejection_reason = NULL,
             updated_at = NOW()
         WHERE id = $1`,
        [rev.id]
      );

      if (listing.status === 'draft' || listing.status === 'changes_requested') {
        await tx.query(
          `UPDATE listings
           SET status = 'pending_review',
               review_note = NULL,
               updated_at = NOW()
           WHERE id = $1`,
          [listing.id]
        );
      }
    },
    { actorId: authed.id }
  );

  return getHostListingDetail(authed, listingId);
}

export async function addHostListingPhoto(
  actor: SessionUser | null,
  params: {
    listingId: string;
    mimeType: string;
    buffer: Buffer;
    altTextEn: string;
    setAsCover?: boolean;
  }
): Promise<HostListingPhotoItem> {
  const authed = requireRole(actor, ['host', 'admin']);
  const validListingId = assertUuid(params.listingId, 'listing ID');

  const listingRes = await dbQuery<{
    id: string;
    host_id: string;
    status: string;
  }>(`SELECT id, host_id, status FROM listings WHERE id = $1`, [validListingId]);
  const listing = listingRes.rows[0];
  if (!listing) {
    throw new AppError('NOT_FOUND', 'Listing not found.');
  }

  const countRes = await dbQuery<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM listing_photos WHERE listing_id = $1`,
    [listing.id]
  );
  const existingCount = Number(countRes.rows[0].count);

  const isDraft = listing.status !== 'published';

  const { storagePath } = validatePhotoUpload({
    actor: authed,
    listingId: listing.id,
    listingHostId: listing.host_id,
    existingPhotoCount: existingCount,
    mimeType: params.mimeType,
    sizeBytes: params.buffer.length,
    isDraft,
  });

  if (!verifyImageBufferSignature(params.buffer, params.mimeType)) {
    throw new AppError(
      'VALIDATION_ERROR',
      'File binary does not match the declared JPEG, PNG, or WebP image format.'
    );
  }

  const { publicUrl } = await persistListingPhotoBinary({
    storagePath,
    buffer: params.buffer,
    mimeType: params.mimeType,
  });

  const photoId = crypto.randomUUID();
  const makeCover = Boolean(params.setAsCover) || existingCount === 0;

  await withTransaction(
    async (tx) => {
      if (makeCover) {
        await tx.query(
          `UPDATE listing_photos SET is_cover = FALSE WHERE listing_id = $1`,
          [listing.id]
        );
      }

      await tx.query(
        `INSERT INTO listing_photos (
           id, listing_id, storage_path, public_url, alt_text_en,
           sort_order, is_cover, is_draft, mime_type, size_bytes
         ) VALUES (
           $1, $2, $3, $4, $5,
           $6, $7, $8, $9, $10
         )`,
        [
          photoId,
          listing.id,
          storagePath,
          publicUrl,
          params.altTextEn.trim() || 'Stay interior view',
          existingCount + 1,
          makeCover,
          isDraft,
          params.mimeType,
          params.buffer.length,
        ]
      );
    },
    { actorId: authed.id }
  );

  return {
    id: photoId,
    storagePath,
    url: publicUrl,
    altTextEn: params.altTextEn.trim() || 'Stay interior view',
    sortOrder: existingCount + 1,
    isCover: makeCover,
    isDraft,
  };
}

export async function setHostCoverPhoto(
  actor: SessionUser | null,
  listingId: string,
  photoId: string
): Promise<void> {
  const authed = requireRole(actor, ['host', 'admin']);
  const validListingId = assertUuid(listingId, 'listing ID');
  const validPhotoId = assertUuid(photoId, 'photo ID');

  await withTransaction(
    async (tx) => {
      const res = await tx.query<{ host_id: string }>(
        `SELECT l.host_id
         FROM listing_photos p
         JOIN listings l ON l.id = p.listing_id
         WHERE p.id = $1 AND p.listing_id = $2`,
        [validPhotoId, validListingId]
      );
      if (!res.rows[0]) {
        throw new AppError('NOT_FOUND', 'Photo not found.');
      }
      assertListingOwnership(authed, res.rows[0].host_id);

      await tx.query(
        `UPDATE listing_photos SET is_cover = FALSE WHERE listing_id = $1`,
        [validListingId]
      );
      await tx.query(
        `UPDATE listing_photos SET is_cover = TRUE WHERE id = $1`,
        [validPhotoId]
      );
    },
    { actorId: authed.id }
  );
}

export async function deleteHostListingPhoto(
  actor: SessionUser | null,
  listingId: string,
  photoId: string
): Promise<void> {
  const authed = requireRole(actor, ['host', 'admin']);
  const validListingId = assertUuid(listingId, 'listing ID');
  const validPhotoId = assertUuid(photoId, 'photo ID');

  const deletedStoragePath = await withTransaction(
    async (tx) => {
      const res = await tx.query<{
        id: string;
        host_id: string;
        storage_path: string;
        is_cover: boolean;
      }>(
        `SELECT p.id, l.host_id, p.storage_path, p.is_cover
         FROM listing_photos p
         JOIN listings l ON l.id = p.listing_id
         WHERE p.id = $1 AND p.listing_id = $2`,
        [validPhotoId, validListingId]
      );
      const photo = res.rows[0];
      if (!photo) {
        throw new AppError('NOT_FOUND', 'Photo not found.');
      }

      assertListingOwnership(authed, photo.host_id);

      await tx.query(`DELETE FROM listing_photos WHERE id = $1`, [photo.id]);

      if (photo.is_cover) {
        await tx.query(
          `UPDATE listing_photos
           SET is_cover = TRUE
           WHERE id = (
             SELECT id FROM listing_photos
             WHERE listing_id = $1
             ORDER BY sort_order ASC, created_at ASC
             LIMIT 1
           )`,
          [listingId]
        );
      }

      return photo.storage_path;
    },
    { actorId: authed.id }
  );

  await removePersistedPhotoBinary(deletedStoragePath);
}

export async function getHostCalendarData(
  actor: SessionUser | null,
  listingId: string,
  fromDate?: string,
  toDate?: string
): Promise<HostCalendarData> {
  const authed = requireRole(actor, ['host', 'admin']);
  const validListingId = assertUuid(listingId, 'listing ID');

  const listingRes = await dbQuery<{
    id: string;
    host_id: string;
    title_en: string;
    base_nightly_rate_vnd: number;
    timezone: string;
  }>(
    `SELECT l.id, l.host_id,
            COALESCE(l.published_title_en, 'Chỗ ở chưa đặt tên') AS title_en,
            l.base_nightly_rate_vnd, a.timezone
     FROM listings l
     JOIN areas a ON a.id = l.area_id
     WHERE l.id = $1`,
    [validListingId]
  );

  const listing = listingRes.rows[0];
  if (!listing) {
    throw new AppError('NOT_FOUND', 'Listing not found.');
  }

  assertListingOwnership(authed, listing.host_id);

  const start = fromDate || getTodayIsoInTimezone(listing.timezone);
  const end = toDate || addDaysIso(start, 60);

  const [blocksRes, ratesRes] = await Promise.all([
    dbQuery<{
      night_date: string;
      source_type: 'booking' | 'host_block';
      booking_id: string | null;
      booking_code: string | null;
      guest_name: string | null;
      block_reason: string | null;
    }>(
      `SELECT o.night_date::text AS night_date,
              o.source_type, o.booking_id,
              b.booking_code, gp.display_name AS guest_name,
              o.block_reason
       FROM occupancy_nights o
       LEFT JOIN bookings b ON b.id = o.booking_id
       LEFT JOIN profiles gp ON gp.id = b.guest_id
       WHERE o.listing_id = $1
         AND o.night_date >= $2::date
         AND o.night_date < $3::date
       ORDER BY o.night_date ASC`,
      [listing.id, start, end]
    ),
    dbQuery<{ night_date: string; nightly_rate_vnd: number }>(
      `SELECT night_date::text AS night_date, nightly_rate_vnd
       FROM nightly_rates
       WHERE listing_id = $1
         AND night_date >= $2::date
         AND night_date < $3::date
       ORDER BY night_date ASC`,
      [listing.id, start, end]
    ),
  ]);

  return {
    listingId: listing.id,
    listingTitle: listing.title_en,
    timezone: listing.timezone,
    baseNightlyRateVnd: Number(listing.base_nightly_rate_vnd),
    fromDate: start,
    toDate: end,
    blockedNights: blocksRes.rows.map((r) => ({
      date: r.night_date,
      sourceType: r.source_type,
      bookingId: r.booking_id,
      bookingCode: r.booking_code,
      guestName: r.guest_name,
      blockReason: r.block_reason,
    })),
    rateOverrides: ratesRes.rows.map((r) => ({
      date: r.night_date,
      nightlyRateVnd: Number(r.nightly_rate_vnd),
    })),
  };
}

export async function blockHostDates(
  actor: SessionUser | null,
  listingId: string,
  input: { startDate: string; endDate: string; reason?: string }
): Promise<{ blockedDates: string[] }> {
  const authed = requireRole(actor, ['host', 'admin']);
  const validListingId = assertUuid(listingId, 'listing ID');
  const nights = enumerateNights(input.startDate, input.endDate);
  const cleanReason = input.reason?.trim() || 'Chủ nhà khóa lịch';

  await withTransaction(
    async (tx) => {
      const res = await tx.query<{ host_id: string }>(
        `SELECT host_id FROM listings WHERE id = $1 FOR UPDATE`,
        [validListingId]
      );
      if (!res.rows[0]) {
        throw new AppError('NOT_FOUND', 'Listing not found.');
      }
      assertListingOwnership(authed, res.rows[0].host_id);

      for (const nightDate of nights) {
        try {
          await tx.query(
            `INSERT INTO occupancy_nights (
               listing_id, night_date, source_type, booking_id, block_reason, created_by
             ) VALUES ($1, $2::date, 'host_block', NULL, $3, $4)`,
            [validListingId, nightDate, cleanReason, authed.id]
          );
        } catch (err) {
          if (isPgUniqueViolation(err)) {
            throw new AppError(
              'DATES_UNAVAILABLE',
              `Đêm ${nightDate} đã được đặt hoặc đã khóa trước đó. Không thể khóa chồng lịch.`
            );
          }
          throw err;
        }
      }
    },
    { actorId: authed.id }
  );

  return { blockedDates: nights };
}

export async function unblockHostDates(
  actor: SessionUser | null,
  listingId: string,
  input: { startDate: string; endDate: string }
): Promise<{ unblockedCount: number }> {
  const authed = requireRole(actor, ['host', 'admin']);
  const validListingId = assertUuid(listingId, 'listing ID');
  enumerateNights(input.startDate, input.endDate);

  const unblockedCount = await withTransaction(
    async (tx) => {
      const res = await tx.query<{ host_id: string }>(
        `SELECT host_id FROM listings WHERE id = $1`,
        [validListingId]
      );
      if (!res.rows[0]) {
        throw new AppError('NOT_FOUND', 'Listing not found.');
      }
      assertListingOwnership(authed, res.rows[0].host_id);

      const delRes = await tx.query<{ night_date: string }>(
        `DELETE FROM occupancy_nights
         WHERE listing_id = $1
           AND night_date >= $2::date
           AND night_date < $3::date
           AND source_type = 'host_block'
         RETURNING night_date::text AS night_date`,
        [validListingId, input.startDate, input.endDate]
      );
      return delRes.rows.length;
    },
    { actorId: authed.id }
  );

  return { unblockedCount };
}

export async function setHostNightlyRates(
  actor: SessionUser | null,
  listingId: string,
  input: { startDate: string; endDate: string; nightlyRateVnd: number }
): Promise<{ updatedDates: string[] }> {
  const authed = requireRole(actor, ['host', 'admin']);
  const validListingId = assertUuid(listingId, 'listing ID');
  if (!Number.isInteger(input.nightlyRateVnd) || input.nightlyRateVnd <= 0) {
    throw new AppError('VALIDATION_ERROR', 'Giá đêm phải là số nguyên dương (VND).');
  }
  const nights = enumerateNights(input.startDate, input.endDate);

  await withTransaction(
    async (tx) => {
      const res = await tx.query<{ host_id: string }>(
        `SELECT host_id FROM listings WHERE id = $1`,
        [validListingId]
      );
      if (!res.rows[0]) {
        throw new AppError('NOT_FOUND', 'Listing not found.');
      }
      assertListingOwnership(authed, res.rows[0].host_id);

      for (const nightDate of nights) {
        await tx.query(
          `INSERT INTO nightly_rates (listing_id, night_date, nightly_rate_vnd, updated_by)
           VALUES ($1, $2::date, $3, $4)
           ON CONFLICT (listing_id, night_date)
           DO UPDATE SET nightly_rate_vnd = EXCLUDED.nightly_rate_vnd,
                         updated_by = EXCLUDED.updated_by,
                         updated_at = NOW()`,
          [validListingId, nightDate, input.nightlyRateVnd, authed.id]
        );
      }
    },
    { actorId: authed.id }
  );

  return { updatedDates: nights };
}

export async function clearHostNightlyRates(
  actor: SessionUser | null,
  listingId: string,
  input: { startDate: string; endDate: string }
): Promise<{ clearedCount: number }> {
  const authed = requireRole(actor, ['host', 'admin']);
  const validListingId = assertUuid(listingId, 'listing ID');
  enumerateNights(input.startDate, input.endDate);

  const clearedCount = await withTransaction(
    async (tx) => {
      const res = await tx.query<{ host_id: string }>(
        `SELECT host_id FROM listings WHERE id = $1`,
        [validListingId]
      );
      if (!res.rows[0]) {
        throw new AppError('NOT_FOUND', 'Listing not found.');
      }
      assertListingOwnership(authed, res.rows[0].host_id);

      const delRes = await tx.query<{ night_date: string }>(
        `DELETE FROM nightly_rates
         WHERE listing_id = $1
           AND night_date >= $2::date
           AND night_date < $3::date
         RETURNING night_date::text AS night_date`,
        [validListingId, input.startDate, input.endDate]
      );
      return delRes.rows.length;
    },
    { actorId: authed.id }
  );

  return { clearedCount };
}
