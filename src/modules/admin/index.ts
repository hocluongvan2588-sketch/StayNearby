import { requireRole } from '@/lib/auth/rbac';
import type { SessionUser } from '@/lib/auth/session';
import { dbQuery, withTransaction } from '@/lib/db';
import { AppError } from '@/lib/errors';
import { logEvent } from '@/lib/logger';
import { assertUuid } from '@/lib/validation';

export interface AdminListingQueueItem {
  id: string;
  slug: string;
  status: string;
  propertyType: string;
  titleEn: string;
  hostName: string;
  hostEmail: string;
  areaNameVi: string;
  cityVi: string;
  exactAddress: string;
  baseNightlyRateVnd: number;
  photoCount: number;
  reviewNote: string | null;
  hasPendingRevision: boolean;
  latestRevisionStatus: string | null;
  latestRevisionSummaryEn: string | null;
  isDemo: boolean;
  updatedAt: string;
}

export async function getAdminListingQueue(
  actor: SessionUser | null
): Promise<AdminListingQueueItem[]> {
  requireRole(actor, 'admin');

  const res = await dbQuery<{
    id: string;
    slug: string;
    status: string;
    property_type: string;
    title_en: string;
    host_name: string;
    host_email: string;
    area_name_vi: string;
    city_vi: string;
    exact_address: string;
    base_nightly_rate_vnd: number;
    photo_count: string;
    review_note: string | null;
    latest_rev_status: string | null;
    latest_rev_summary: string | null;
    pending_rev_count: string;
    is_demo: boolean;
    updated_at: string;
  }>(
    `SELECT l.id, l.slug, l.status, l.property_type,
            COALESCE(
              (SELECT lr.title_en FROM listing_revisions lr
               WHERE lr.listing_id = l.id
               ORDER BY lr.revision_number DESC LIMIT 1),
              l.published_title_en,
              'Chỗ ở chưa đặt tên'
            ) AS title_en,
            p.display_name AS host_name, p.email AS host_email,
            a.name_vi AS area_name_vi, a.city_vi,
            l.exact_address, l.base_nightly_rate_vnd, l.review_note, l.is_demo,
            l.updated_at::text AS updated_at,
            (SELECT COUNT(*)::text FROM listing_photos lp WHERE lp.listing_id = l.id) AS photo_count,
            (SELECT lr.status FROM listing_revisions lr WHERE lr.listing_id = l.id ORDER BY lr.revision_number DESC LIMIT 1) AS latest_rev_status,
            (SELECT lr.summary_en FROM listing_revisions lr WHERE lr.listing_id = l.id ORDER BY lr.revision_number DESC LIMIT 1) AS latest_rev_summary,
            (SELECT COUNT(*)::text FROM listing_revisions lr WHERE lr.listing_id = l.id AND lr.status = 'pending_review') AS pending_rev_count
     FROM listings l
     JOIN profiles p ON p.id = l.host_id
     JOIN areas a ON a.id = l.area_id
     ORDER BY
       CASE WHEN EXISTS (
         SELECT 1 FROM listing_revisions lr WHERE lr.listing_id = l.id AND lr.status = 'pending_review'
       ) THEN 0
       WHEN l.status = 'pending_review' THEN 1
       WHEN l.status = 'changes_requested' THEN 2
       WHEN l.status = 'draft' THEN 3
       WHEN l.status = 'published' THEN 4
       ELSE 5 END,
       l.updated_at DESC`
  );

  return res.rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    status: r.status,
    propertyType: r.property_type,
    titleEn: r.title_en,
    hostName: r.host_name,
    hostEmail: r.host_email,
    areaNameVi: r.area_name_vi,
    cityVi: r.city_vi,
    exactAddress: r.exact_address,
    baseNightlyRateVnd: Number(r.base_nightly_rate_vnd),
    photoCount: Number(r.photo_count),
    reviewNote: r.review_note,
    hasPendingRevision: Number(r.pending_rev_count) > 0,
    latestRevisionStatus: r.latest_rev_status,
    latestRevisionSummaryEn: r.latest_rev_summary,
    isDemo: Boolean(r.is_demo),
    updatedAt: r.updated_at,
  }));
}

export async function approveAdminListing(
  actor: SessionUser | null,
  listingId: string,
  note?: string
): Promise<AdminListingQueueItem> {
  const admin = requireRole(actor, 'admin');
  const validListingId = assertUuid(listingId, 'listing ID');

  await withTransaction(
    async (tx) => {
      const listingRes = await tx.query<{
        id: string;
        status: string;
      }>(`SELECT id, status FROM listings WHERE id = $1 FOR UPDATE`, [validListingId]);
      const listing = listingRes.rows[0];
      if (!listing) {
        throw new AppError('NOT_FOUND', 'Listing not found.');
      }

      const photoRes = await tx.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM listing_photos WHERE listing_id = $1`,
        [listing.id]
      );
      if (Number(photoRes.rows[0].count) < 1) {
        throw new AppError(
          'VALIDATION_ERROR',
          'Không thể công bố chỗ ở chưa có ảnh.'
        );
      }

      // Prefer latest pending_review revision; fallback to latest revision
      const revRes = await tx.query<{
        id: string;
        title_en: string;
        title_vi: string | null;
        summary_en: string;
        summary_vi: string | null;
        description_en: string;
        description_vi: string | null;
        house_rules_en: unknown;
        house_rules_vi: unknown;
        has_dedicated_desk: boolean;
        workspace_notes_en: string | null;
        workspace_notes_vi: string | null;
        checkin_conditions_en: string;
        checkin_conditions_vi: string;
        late_checkin_available: boolean;
        exact_address: string;
        checkin_instructions_en: string;
        checkin_instructions_vi: string;
      }>(
        `SELECT id, title_en, title_vi, summary_en, summary_vi,
                description_en, description_vi, house_rules_en, house_rules_vi,
                has_dedicated_desk, workspace_notes_en, workspace_notes_vi,
                checkin_conditions_en, checkin_conditions_vi, late_checkin_available,
                exact_address, checkin_instructions_en, checkin_instructions_vi
         FROM listing_revisions
         WHERE listing_id = $1
         ORDER BY CASE WHEN status = 'pending_review' THEN 0 ELSE 1 END,
                  revision_number DESC
         LIMIT 1`,
        [listing.id]
      );

      const rev = revRes.rows[0];
      if (!rev) {
        throw new AppError('VALIDATION_ERROR', 'Chỗ ở chưa có nội dung để duyệt.');
      }

      await tx.query(
        `UPDATE listing_revisions
         SET status = 'approved',
             rejection_reason = NULL,
             reviewed_by = $2,
             reviewed_at = NOW(),
             updated_at = NOW()
         WHERE id = $1`,
        [rev.id, admin.id]
      );

      await tx.query(
        `UPDATE listing_photos
         SET is_draft = FALSE
         WHERE listing_id = $1`,
        [listing.id]
      );

      await tx.query(
        `UPDATE listings
         SET status = 'published',
             published_title_en = $2,
             published_title_vi = $3,
             published_summary_en = $4,
             published_summary_vi = $5,
             published_description_en = $6,
             published_description_vi = $7,
             published_house_rules_en = $8::jsonb,
             published_house_rules_vi = $9::jsonb,
             published_has_dedicated_desk = $10,
             published_workspace_notes_en = $11,
             published_workspace_notes_vi = $12,
             published_checkin_conditions_en = $13,
             published_checkin_conditions_vi = $14,
             published_late_checkin_available = $15,
             exact_address = $16,
             checkin_instructions_en = $17,
             checkin_instructions_vi = $18,
             review_note = $19,
             reviewed_by = $20,
             reviewed_at = NOW(),
             updated_at = NOW()
         WHERE id = $1`,
        [
          listing.id,
          rev.title_en,
          rev.title_vi || null,
          rev.summary_en,
          rev.summary_vi || null,
          rev.description_en,
          rev.description_vi || null,
          JSON.stringify(rev.house_rules_en ?? []),
          JSON.stringify(rev.house_rules_vi ?? []),
          Boolean(rev.has_dedicated_desk),
          rev.workspace_notes_en,
          rev.workspace_notes_vi || null,
          rev.checkin_conditions_en ?? '',
          rev.checkin_conditions_vi ?? '',
          Boolean(rev.late_checkin_available),
          rev.exact_address,
          rev.checkin_instructions_en,
          rev.checkin_instructions_vi ?? '',
          note?.trim() || null,
          admin.id,
        ]
      );
    },
    { actorId: admin.id }
  );

  const all = await getAdminListingQueue(admin);
  const updated = all.find((x) => x.id === validListingId);
  if (!updated) throw new AppError('NOT_FOUND', 'Listing not found.');
  logEvent('info', 'admin.listing_approved', {
    listingId: validListingId,
    adminId: admin.id,
  });
  return updated;
}

export async function requestChangesAdminListing(
  actor: SessionUser | null,
  listingId: string,
  reason: string
): Promise<AdminListingQueueItem> {
  const admin = requireRole(actor, 'admin');
  const validListingId = assertUuid(listingId, 'listing ID');
  const cleanReason = reason.trim();
  if (!cleanReason) {
    throw new AppError(
      'VALIDATION_ERROR',
      'Vui lòng nhập lý do trả lại để chủ nhà biết cần chỉnh sửa nội dung nào.'
    );
  }

  await withTransaction(
    async (tx) => {
      const listingRes = await tx.query<{
        id: string;
        status: string;
        published_title_en: string | null;
      }>(
        `SELECT id, status, published_title_en FROM listings WHERE id = $1 FOR UPDATE`,
        [validListingId]
      );
      const listing = listingRes.rows[0];
      if (!listing) {
        throw new AppError('NOT_FOUND', 'Listing not found.');
      }

      const revRes = await tx.query<{ id: string }>(
        `SELECT id FROM listing_revisions
         WHERE listing_id = $1
         ORDER BY CASE WHEN status = 'pending_review' THEN 0 ELSE 1 END,
                  revision_number DESC
         LIMIT 1`,
        [listing.id]
      );

      if (revRes.rows[0]) {
        await tx.query(
          `UPDATE listing_revisions
           SET status = 'rejected',
               rejection_reason = $2,
               reviewed_by = $3,
               reviewed_at = NOW(),
               updated_at = NOW()
           WHERE id = $1`,
          [revRes.rows[0].id, cleanReason, admin.id]
        );
      }

      // If listing is not yet published, mark listing status as changes_requested;
      // if already published, keep published snapshot live while preserving review_note.
      const nextStatus =
        listing.status === 'published' ? 'published' : 'changes_requested';

      await tx.query(
        `UPDATE listings
         SET status = $2,
             review_note = $3,
             reviewed_by = $4,
             reviewed_at = NOW(),
             updated_at = NOW()
         WHERE id = $1`,
        [listing.id, nextStatus, cleanReason, admin.id]
      );
    },
    { actorId: admin.id }
  );

  const all = await getAdminListingQueue(admin);
  const updated = all.find((x) => x.id === validListingId);
  if (!updated) throw new AppError('NOT_FOUND', 'Listing not found.');
  logEvent('info', 'admin.listing_changes_requested', {
    listingId: validListingId,
    adminId: admin.id,
  });
  return updated;
}

export async function suspendAdminListing(
  actor: SessionUser | null,
  listingId: string,
  reason: string
): Promise<AdminListingQueueItem> {
  const admin = requireRole(actor, 'admin');
  const validListingId = assertUuid(listingId, 'listing ID');
  const cleanReason = reason.trim();
  if (!cleanReason) {
    throw new AppError(
      'VALIDATION_ERROR',
      'Vui lòng nhập lý do khi tạm ẩn chỗ ở.'
    );
  }

  await withTransaction(
    async (tx) => {
      const listingRes = await tx.query<{ id: string }>(
        `SELECT id FROM listings WHERE id = $1 FOR UPDATE`,
        [validListingId]
      );
      if (!listingRes.rows[0]) {
        throw new AppError('NOT_FOUND', 'Listing not found.');
      }

      await tx.query(
        `UPDATE listings
         SET status = 'suspended',
             review_note = $2,
             reviewed_by = $3,
             reviewed_at = NOW(),
             updated_at = NOW()
         WHERE id = $1`,
        [validListingId, cleanReason, admin.id]
      );
    },
    { actorId: admin.id }
  );

  const all = await getAdminListingQueue(admin);
  const updated = all.find((x) => x.id === validListingId);
  if (!updated) throw new AppError('NOT_FOUND', 'Listing not found.');
  logEvent('info', 'admin.listing_suspended', {
    listingId: validListingId,
    adminId: admin.id,
  });
  return updated;
}

export async function restoreAdminListing(
  actor: SessionUser | null,
  listingId: string
): Promise<AdminListingQueueItem> {
  const admin = requireRole(actor, 'admin');
  const validListingId = assertUuid(listingId, 'listing ID');

  await withTransaction(
    async (tx) => {
      const listingRes = await tx.query<{
        id: string;
        published_title_en: string | null;
      }>(
        `SELECT id, published_title_en FROM listings WHERE id = $1 FOR UPDATE`,
        [validListingId]
      );
      const listing = listingRes.rows[0];
      if (!listing) {
        throw new AppError('NOT_FOUND', 'Listing not found.');
      }
      if (!listing.published_title_en) {
        throw new AppError(
          'INVALID_TRANSITION',
          'Chỗ ở chưa từng được duyệt công bố; hãy dùng thao tác duyệt.'
        );
      }

      await tx.query(
        `UPDATE listings
         SET status = 'published',
             review_note = NULL,
             reviewed_by = $2,
             reviewed_at = NOW(),
             updated_at = NOW()
         WHERE id = $1`,
        [listing.id, admin.id]
      );
    },
    { actorId: admin.id }
  );

  const all = await getAdminListingQueue(admin);
  const updated = all.find((x) => x.id === validListingId);
  if (!updated) throw new AppError('NOT_FOUND', 'Listing not found.');
  logEvent('info', 'admin.listing_restored', {
    listingId: validListingId,
    adminId: admin.id,
  });
  return updated;
}
