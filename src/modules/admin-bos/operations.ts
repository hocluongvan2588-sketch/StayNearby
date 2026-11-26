import crypto from 'node:crypto';
import { addDaysIso, enumerateStayNights, isValidUuid } from '@/lib/dates';
import { dbQuery, dbTransaction, toNum } from '@/lib/db';
import { AppError } from '@/lib/errors';
import { safeRevalidateAll } from '@/lib/revalidate-safe';
import {
  logAdminAudit,
  maskEmail,
  type AdminActorContext,
} from '@/modules/admin-rbac';
import { releaseBookingPromotionTx } from '@/modules/bookings';
import { advanceHostLeadMilestoneTx } from '@/modules/host-lead-sync';
import { triggerAutomationTask } from './shared';

export type StayLifecycleStatus =
  | 'draft'
  | 'pending_review'
  | 'live'
  | 'limited'
  | 'paused'
  | 'rejected'
  | 'suspended'
  | 'archived';

export async function listAdminListings(filters?: {
  status?: string;
  destination?: string;
  q?: string;
}) {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters?.status && filters.status !== 'all') {
    params.push(filters.status);
    conditions.push(`s.status = $${params.length}`);
  }
  if (filters?.destination && filters.destination !== 'all') {
    params.push(filters.destination);
    conditions.push(`d.slug = $${params.length}`);
  }
  if (filters?.q?.trim()) {
    params.push(`%${filters.q.trim()}%`);
    conditions.push(
      `(s.title_en ILIKE $${params.length} OR s.slug ILIKE $${params.length} OR u.full_name ILIKE $${params.length})`
    );
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const [staysRes, appsRes] = await Promise.all([
    dbQuery<{
      id: string;
      slug: string;
      title_en: string;
      title_vi: string;
      property_type: string;
      status: StayLifecycleStatus;
      host_id: string;
      host_name: string;
      destination_slug: string;
      destination_name_en: string;
      is_instant_book: boolean;
      is_featured: boolean;
      featured_rank: number;
      wifi_download_mbps: number;
      verification_tier: string;
      is_wifi_verified: boolean;
      is_work_ready: boolean;
      moderation_reason: string;
      bookings_count: string | number;
      created_at: string;
    }>(
      `SELECT s.id, s.slug, s.title_en, s.title_vi, s.property_type, s.status,
              s.host_id, u.full_name AS host_name,
              d.slug AS destination_slug, d.name_en AS destination_name_en,
              s.is_instant_book, s.is_featured, s.featured_rank,
              s.wifi_download_mbps, s.verification_tier, s.is_wifi_verified, s.is_work_ready,
              s.moderation_reason,
              COUNT(b.id) FILTER (WHERE b.booking_status = 'confirmed') AS bookings_count,
              s.created_at
       FROM stays s
       JOIN users u ON u.id = s.host_id
       JOIN destinations d ON d.id = s.destination_id
       LEFT JOIN bookings b ON b.stay_id = s.id
       ${where}
       GROUP BY s.id, u.full_name, d.slug, d.name_en
       ORDER BY s.is_featured DESC, s.featured_rank ASC, s.created_at DESC`,
      params
    ),
    dbQuery<{
      id: string;
      applicant_name: string;
      applicant_email: string;
      business_name: string;
      stay_name: string;
      destination_slug: string;
      property_type: string;
      measured_download_mbps: number;
      status: string;
      review_note: string;
      created_at: string;
    }>(
      `SELECT ha.*, u.full_name AS applicant_name, u.email AS applicant_email
       FROM host_applications ha
       JOIN users u ON u.id = ha.applicant_user_id
       ORDER BY ha.created_at DESC`
    ),
  ]);

  return {
    stays: staysRes.rows.map((s) => ({
      id: String(s.id),
      slug: String(s.slug),
      titleEn: String(s.title_en),
      titleVi: String(s.title_vi),
      propertyType: String(s.property_type),
      status: s.status,
      hostId: String(s.host_id),
      hostName: String(s.host_name),
      destinationSlug: String(s.destination_slug),
      destinationNameEn: String(s.destination_name_en),
      isInstantBook: Boolean(s.is_instant_book),
      isFeatured: Boolean(s.is_featured),
      featuredRank: toNum(s.featured_rank, 100),
      wifiDownloadMbps: toNum(s.wifi_download_mbps),
      verificationTier: String(s.verification_tier ?? 'SELF_DECLARED'),
      isWifiVerified: Boolean(s.is_wifi_verified),
      isWorkReady: Boolean(s.is_work_ready),
      moderationReason: String(s.moderation_reason ?? ''),
      bookingsCount: toNum(s.bookings_count),
      createdAt: new Date(String(s.created_at)).toISOString(),
    })),
    applications: appsRes.rows.map((a) => ({
      id: String(a.id),
      applicantName: String(a.applicant_name),
      applicantEmail: String(a.applicant_email),
      businessName: String(a.business_name),
      stayName: String(a.stay_name),
      destinationSlug: String(a.destination_slug),
      propertyType: String(a.property_type),
      measuredDownloadMbps: toNum(a.measured_download_mbps),
      status: String(a.status),
      reviewNote: String(a.review_note ?? ''),
      createdAt: new Date(String(a.created_at)).toISOString(),
    })),
  };
}

export async function moderateListing(
  actor: AdminActorContext,
  stayId: string,
  input: {
    status?: StayLifecycleStatus;
    isFeatured?: boolean;
    featuredRank?: number;
    moderationReason?: string;
    isWifiVerified?: boolean;
    isWorkReady?: boolean;
    verificationTier?: 'SELF_DECLARED' | 'HOST_VERIFIED' | 'VIETNOMAD_CERTIFIED';
  }
) {
  if (!isValidUuid(stayId)) throw new AppError('VALIDATION_ERROR', 'Invalid stay ID.');

  return dbTransaction(async (tx) => {
    const curRes = await tx.query<{
      host_id: string;
      status: string;
      is_featured: boolean;
      featured_rank: number;
      is_wifi_verified: boolean;
      is_work_ready: boolean;
      verification_tier: string;
    }>(
      `SELECT host_id, status, is_featured, featured_rank, is_wifi_verified, is_work_ready, verification_tier
       FROM stays WHERE id = $1 FOR UPDATE`,
      [stayId]
    );
    const cur = curRes.rows[0];
    if (!cur) throw new AppError('NOT_FOUND', 'Listing not found.');

    const nextStatus = input.status ?? (cur.status as StayLifecycleStatus);
    const nextWifi = input.isWifiVerified ?? Boolean(cur.is_wifi_verified);
    const nextWork = input.isWorkReady ?? Boolean(cur.is_work_ready);
    const nextTier =
      input.verificationTier ??
      (nextWifi && nextWork
        ? 'VIETNOMAD_CERTIFIED'
        : nextWifi || nextWork
          ? 'HOST_VERIFIED'
          : (cur.verification_tier ?? 'SELF_DECLARED'));

    await tx.query(
      `UPDATE stays
       SET status = $1,
           is_featured = COALESCE($2, is_featured),
           featured_rank = COALESCE($3, featured_rank),
           moderation_reason = COALESCE($4, moderation_reason),
           is_wifi_verified = $5,
           is_work_ready = $6,
           verification_tier = $7,
           reviewed_by = $8,
           reviewed_at = NOW()
       WHERE id = $9`,
      [
        nextStatus,
        input.isFeatured ?? null,
        input.featuredRank ?? null,
        input.moderationReason?.trim() ?? null,
        nextWifi,
        nextWork,
        nextTier,
        actor.user.id,
        stayId,
      ]
    );

    if (nextStatus !== cur.status) {
      await tx.query(
        `INSERT INTO listing_moderation_logs (id, stay_id, actor_user_id, from_status, to_status, reason, changes_diff)
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
        [
          crypto.randomUUID(),
          stayId,
          actor.user.id,
          cur.status,
          nextStatus,
          input.moderationReason?.trim() ?? '',
          JSON.stringify(input),
        ]
      );
      if (nextStatus === 'live') {
        await tx.query(
          `UPDATE users SET role = CASE WHEN role = 'nomad' THEN 'host' ELSE role END WHERE id = $1`,
          [cur.host_id]
        );
        await advanceHostLeadMilestoneTx(tx, {
          userId: cur.host_id,
          targetStage: 'published',
          summary: `Listing ${stayId.slice(0, 8)} published live`,
          actorUserId: actor.user.id,
        });
      } else if (nextStatus === 'pending_review') {
        await advanceHostLeadMilestoneTx(tx, {
          userId: cur.host_id,
          targetStage: 'under_review',
          summary: `Listing ${stayId.slice(0, 8)} moved to under_review`,
          actorUserId: actor.user.id,
        });
      }
    }

    await logAdminAudit(
      {
        actor,
        module: 'listings',
        action: input.status && input.status !== cur.status ? 'approve' : 'edit',
        entityType: 'stay',
        entityId: stayId,
        before: cur,
        after: { ...input, nextStatus },
        reason: input.moderationReason ?? '',
      },
      tx
    );

    return { ok: true, status: nextStatus };
  }).then((res) => {
    safeRevalidateAll(['/', '/stays', '/deals']);
    return res;
  });
}

export async function listAdminBookings(
  actor: AdminActorContext,
  filters?: {
    bookingStatus?: string;
    paymentStatus?: string;
    payoutStatus?: string;
    q?: string;
  }
) {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters?.bookingStatus && filters.bookingStatus !== 'all') {
    params.push(filters.bookingStatus);
    conditions.push(`b.booking_status = $${params.length}`);
  }
  if (filters?.paymentStatus && filters.paymentStatus !== 'all') {
    params.push(filters.paymentStatus);
    conditions.push(`b.payment_status = $${params.length}`);
  }
  if (filters?.payoutStatus && filters.payoutStatus !== 'all') {
    params.push(filters.payoutStatus);
    conditions.push(`b.payout_status = $${params.length}`);
  }
  if (filters?.q?.trim()) {
    params.push(`%${filters.q.trim()}%`);
    conditions.push(
      `(b.booking_code ILIKE $${params.length} OR s.title_en ILIKE $${params.length} OR g.full_name ILIKE $${params.length})`
    );
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const res = await dbQuery<{
    id: string;
    booking_code: string;
    stay_id: string;
    stay_title: string;
    stay_slug: string;
    host_name: string;
    guest_id: string;
    guest_name: string;
    guest_email: string;
    check_in: string;
    check_out: string;
    nights: number;
    status: string;
    booking_status: string;
    stay_status: string;
    payment_status: string;
    payout_status: string;
    refund_status: string;
    dispute_flag: boolean;
    guest_total_vnd: string | number;
    service_fee_vnd: string | number;
    pay_at_checkin_vnd: string | number;
    refund_amount_vnd: string | number;
    applied_service_fee_rate: string | number;
    applied_host_commission_rate: string | number;
    promotion_code: string | null;
    created_at: string;
  }>(
    `SELECT b.*, s.title_en AS stay_title, s.slug AS stay_slug,
            h.full_name AS host_name, g.full_name AS guest_name, g.email AS guest_email
     FROM bookings b
     JOIN stays s ON s.id = b.stay_id
     JOIN users h ON h.id = s.host_id
     JOIN users g ON g.id = b.guest_id
     ${where}
     ORDER BY b.created_at DESC
     LIMIT 200`,
    params
  );

  return res.rows.map((b) => ({
    id: String(b.id),
    bookingCode: String(b.booking_code),
    stayId: String(b.stay_id),
    stayTitle: String(b.stay_title),
    staySlug: String(b.stay_slug),
    hostName: String(b.host_name),
    guestId: String(b.guest_id),
    guestName: String(b.guest_name),
    guestEmail: actor.hasPiiAccess ? String(b.guest_email) : maskEmail(String(b.guest_email)),
    checkIn: String(b.check_in).slice(0, 10),
    checkOut: String(b.check_out).slice(0, 10),
    nights: toNum(b.nights),
    legacyStatus: String(b.status),
    bookingStatus: String(b.booking_status),
    stayStatus: String(b.stay_status),
    paymentStatus: String(b.payment_status),
    payoutStatus: String(b.payout_status),
    refundStatus: String(b.refund_status),
    disputeFlag: Boolean(b.dispute_flag),
    guestTotalVnd: toNum(b.guest_total_vnd),
    serviceFeeVnd: toNum(b.service_fee_vnd),
    payAtCheckinVnd: toNum(b.pay_at_checkin_vnd),
    refundAmountVnd: toNum(b.refund_amount_vnd),
    appliedServiceFeeRate: Number(b.applied_service_fee_rate ?? 0.12),
    appliedHostCommissionRate: Number(b.applied_host_commission_rate ?? 0),
    promotionCode: b.promotion_code ? String(b.promotion_code) : null,
    createdAt: new Date(String(b.created_at)).toISOString(),
  }));
}

export async function getBookingDetail360(actor: AdminActorContext, bookingId: string) {
  if (!isValidUuid(bookingId)) throw new AppError('VALIDATION_ERROR', 'Invalid booking ID.');

  const [bRes, ptRes, ledgerRes, auditRes, payoutRes, refundRes] = await Promise.all([
    dbQuery<{
      id: string;
      booking_code: string;
      stay_title: string;
      host_name: string;
      guest_name: string;
      guest_email: string;
      check_in: string;
      check_out: string;
      nights: number;
      status: string;
      booking_status: string;
      stay_status: string;
      payment_status: string;
      payout_status: string;
      refund_status: string;
      dispute_flag: boolean;
      guest_total_vnd: string | number;
      service_fee_vnd: string | number;
      pay_at_checkin_vnd: string | number;
      refund_amount_vnd: string | number;
      special_requests: string | null;
      host_internal_note: string | null;
      mismatch_reason: string | null;
      created_at: string;
    }>(
      `SELECT b.*, s.title_en AS stay_title, h.full_name AS host_name,
              g.full_name AS guest_name, g.email AS guest_email
       FROM bookings b
       JOIN stays s ON s.id = b.stay_id
       JOIN users h ON h.id = s.host_id
       JOIN users g ON g.id = b.guest_id
       WHERE b.id = $1`,
      [bookingId]
    ),
    dbQuery(
      `SELECT id, provider, method, amount_vnd, status, external_ref, paid_at, created_at
       FROM payment_transactions WHERE booking_id = $1 ORDER BY created_at DESC`,
      [bookingId]
    ),
    dbQuery(
      `SELECT id, entry_type, amount_vnd, description, occurred_at
       FROM ledger_entries WHERE booking_id = $1 ORDER BY occurred_at DESC`,
      [bookingId]
    ),
    dbQuery(
      `SELECT id, actor_email, action, before_json, after_json, reason, created_at
       FROM admin_audit_logs
       WHERE entity_type = 'booking' AND entity_id = $1
       ORDER BY created_at DESC LIMIT 20`,
      [bookingId]
    ),
    dbQuery(`SELECT id, status, net_payable_vnd, period_month FROM host_payouts WHERE booking_id = $1`, [
      bookingId,
    ]),
    dbQuery(`SELECT id, refund_type, amount_vnd, status, reason, created_at FROM refund_requests WHERE booking_id = $1`, [
      bookingId,
    ]),
  ]);

  const b = bRes.rows[0];
  if (!b) throw new AppError('NOT_FOUND', 'Booking not found.');

  return {
    booking: {
      id: String(b.id),
      bookingCode: String(b.booking_code),
      stayTitle: String(b.stay_title),
      hostName: String(b.host_name),
      guestName: String(b.guest_name),
      guestEmail: actor.hasPiiAccess ? String(b.guest_email) : maskEmail(String(b.guest_email)),
      checkIn: String(b.check_in).slice(0, 10),
      checkOut: String(b.check_out).slice(0, 10),
      nights: toNum(b.nights),
      legacyStatus: String(b.status),
      bookingStatus: String(b.booking_status),
      stayStatus: String(b.stay_status),
      paymentStatus: String(b.payment_status),
      payoutStatus: String(b.payout_status),
      refundStatus: String(b.refund_status),
      disputeFlag: Boolean(b.dispute_flag),
      guestTotalVnd: toNum(b.guest_total_vnd),
      serviceFeeVnd: toNum(b.service_fee_vnd),
      payAtCheckinVnd: toNum(b.pay_at_checkin_vnd),
      refundAmountVnd: toNum(b.refund_amount_vnd),
      specialRequests: String(b.special_requests ?? ''),
      hostInternalNote: String(b.host_internal_note ?? ''),
      mismatchReason: String(b.mismatch_reason ?? ''),
      createdAt: new Date(String(b.created_at)).toISOString(),
    },
    transactions: ptRes.rows,
    ledgerEntries: ledgerRes.rows,
    auditHistory: auditRes.rows,
    payouts: payoutRes.rows,
    refundRequests: refundRes.rows,
  };
}

export async function updateBookingByAdmin(
  actor: AdminActorContext,
  bookingId: string,
  input: {
    bookingStatus?: 'pending_payment' | 'pending_approval' | 'confirmed' | 'cancelled' | 'expired';
    stayStatus?: 'upcoming' | 'checked_in' | 'in_house' | 'checked_out' | 'no_show';
    paymentStatus?: 'unpaid' | 'pending' | 'paid' | 'partially_refunded' | 'refunded' | 'failed';
    payoutStatus?:
      | 'not_applicable'
      | 'pending'
      | 'scheduled'
      | 'paid'
      | 'on_hold'
      | 'direct_at_checkin';
    refundStatus?: 'none' | 'requested' | 'approved' | 'processing' | 'completed' | 'rejected';
    disputeFlag?: boolean;
    adjustmentAmountVnd?: number;
    reason: string;
  }
) {
  if (!isValidUuid(bookingId)) throw new AppError('VALIDATION_ERROR', 'Invalid booking ID.');
  if (!input.reason?.trim()) {
    throw new AppError('VALIDATION_ERROR', 'A reason is required for administrative booking adjustments.');
  }

  return dbTransaction(async (tx) => {
    const curRes = await tx.query<{
      id: string;
      status: string;
      booking_status: string;
      stay_status: string;
      payment_status: string;
      payout_status: string;
      refund_status: string;
      dispute_flag: boolean;
      stay_id: string;
      room_id: string;
    }>('SELECT * FROM bookings WHERE id = $1 FOR UPDATE', [bookingId]);
    const cur = curRes.rows[0];
    if (!cur) throw new AppError('NOT_FOUND', 'Booking not found.');

    const nextBookingStatus = input.bookingStatus ?? cur.booking_status;
    const nextStayStatus = input.stayStatus ?? cur.stay_status;
    const nextPaymentStatus = input.paymentStatus ?? cur.payment_status;
    const nextPayoutStatus = input.payoutStatus ?? cur.payout_status;
    const nextRefundStatus = input.refundStatus ?? cur.refund_status;
    const nextDisputeFlag = input.disputeFlag ?? Boolean(cur.dispute_flag);

    // Sync legacy status column to preserve Guest & Host Console Single Source of Truth
    let nextLegacy = cur.status;
    if (nextBookingStatus === 'cancelled') {
      nextLegacy = 'cancelled';
      if (cur.booking_status !== 'cancelled') {
        const bDatesRes = await tx.query<{ check_in: string | Date; check_out: string | Date }>(
          'SELECT check_in, check_out FROM bookings WHERE id = $1',
          [bookingId]
        );
        const bd = bDatesRes.rows[0];
        if (bd) {
          const ci =
            bd.check_in instanceof Date
              ? bd.check_in.toISOString().slice(0, 10)
              : String(bd.check_in).slice(0, 10);
          const co =
            bd.check_out instanceof Date
              ? bd.check_out.toISOString().slice(0, 10)
              : String(bd.check_out).slice(0, 10);
          if (co > ci && ci >= addDaysIso(ci, -365)) {
            for (const dt of enumerateStayNights(ci, co)) {
              await tx.query(
                `UPDATE room_night_locks
                 SET booked_units = GREATEST(0, booked_units - 1)
                 WHERE room_id = $1 AND stay_date = $2::date`,
                [cur.room_id, dt]
              );
            }
          }
        }
        await releaseBookingPromotionTx(tx, bookingId);
      }
    } else if (nextStayStatus === 'checked_out') {
      nextLegacy = 'CHECKED_IN_COMPLETED';
    } else if (nextBookingStatus === 'confirmed') {
      nextLegacy = 'RESERVED_LOCKED';
    } else if (nextBookingStatus === 'pending_approval') {
      nextLegacy = 'PENDING_HOST_APPROVAL';
    } else if (nextBookingStatus === 'pending_payment') {
      nextLegacy = 'PENDING_PAYMENT';
    }

    await tx.query(
      `UPDATE bookings
       SET status = $1,
           booking_status = $2,
           stay_status = $3,
           payment_status = $4,
           payout_status = $5,
           refund_status = $6,
           dispute_flag = $7
       WHERE id = $8`,
      [
        nextLegacy,
        nextBookingStatus,
        nextStayStatus,
        nextPaymentStatus,
        nextPayoutStatus,
        nextRefundStatus,
        nextDisputeFlag,
        bookingId,
      ]
    );

    if (input.payoutStatus) {
      await tx.query(
        `UPDATE host_payouts SET status = $1, updated_at = NOW() WHERE booking_id = $2`,
        [input.payoutStatus, bookingId]
      );
    }

    if (input.adjustmentAmountVnd && input.adjustmentAmountVnd !== 0) {
      await tx.query(
        `INSERT INTO ledger_entries (
          id, entry_type, booking_id, amount_vnd, description, recorded_by
        ) VALUES ($1, 'adjustment', $2, $3, $4, $5)`,
        [
          crypto.randomUUID(),
          bookingId,
          Math.round(input.adjustmentAmountVnd),
          `Admin adjustment: ${input.reason.trim()}`,
          actor.user.id,
        ]
      );
    }

    await logAdminAudit(
      {
        actor,
        module: 'bookings',
        action: 'edit',
        entityType: 'booking',
        entityId: bookingId,
        before: {
          bookingStatus: cur.booking_status,
          stayStatus: cur.stay_status,
          paymentStatus: cur.payment_status,
          payoutStatus: cur.payout_status,
          refundStatus: cur.refund_status,
          disputeFlag: cur.dispute_flag,
        },
        after: {
          bookingStatus: nextBookingStatus,
          stayStatus: nextStayStatus,
          paymentStatus: nextPaymentStatus,
          payoutStatus: nextPayoutStatus,
          refundStatus: nextRefundStatus,
          disputeFlag: nextDisputeFlag,
          adjustmentAmountVnd: input.adjustmentAmountVnd ?? 0,
        },
        reason: input.reason,
      },
      tx
    );

    return { ok: true };
  });
}

export async function listAdminReviews(filters?: { q?: string; ratingMax?: number }) {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters?.q?.trim()) {
    params.push(`%${filters.q.trim()}%`);
    conditions.push(
      `(r.comment ILIKE $${params.length} OR s.title_en ILIKE $${params.length} OR u.full_name ILIKE $${params.length})`
    );
  }
  if (filters?.ratingMax) {
    params.push(filters.ratingMax);
    conditions.push(`r.rating <= $${params.length}`);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const res = await dbQuery<{
    id: string;
    stay_id: string;
    stay_title: string;
    stay_slug: string;
    reviewer_name: string;
    rating: number;
    cleanliness_rating: number;
    workspace_rating: number;
    comment: string;
    host_reply: string | null;
    created_at: string;
  }>(
    `SELECT r.*, s.title_en AS stay_title, s.slug AS stay_slug, u.full_name AS reviewer_name
     FROM stay_reviews r
     JOIN stays s ON s.id = r.stay_id
     JOIN users u ON u.id = r.guest_id
     ${where}
     ORDER BY r.created_at DESC LIMIT 100`,
    params
  );

  return res.rows.map((r) => ({
    id: String(r.id),
    stayId: String(r.stay_id),
    stayTitle: String(r.stay_title),
    staySlug: String(r.stay_slug),
    reviewerName: String(r.reviewer_name),
    overallRating: toNum(r.rating),
    wifiRating: toNum(r.cleanliness_rating),
    workspaceRating: toNum(r.workspace_rating),
    comment: String(r.comment || ''),
    hostReply: r.host_reply ? String(r.host_reply) : '',
    createdAt: new Date(String(r.created_at)).toISOString(),
  }));
}

export async function deleteAdminReview(
  actor: AdminActorContext,
  reviewId: string,
  reason: string
) {
  if (!isValidUuid(reviewId)) throw new AppError('VALIDATION_ERROR', 'Invalid review ID.');
  const curRes = await dbQuery('SELECT * FROM stay_reviews WHERE id = $1', [reviewId]);
  const cur = curRes.rows[0];
  if (!cur) throw new AppError('NOT_FOUND', 'Review not found.');

  await dbQuery('DELETE FROM stay_reviews WHERE id = $1', [reviewId]);
  await logAdminAudit({
    actor,
    module: 'reviews',
    action: 'delete',
    entityType: 'review',
    entityId: reviewId,
    before: cur,
    reason,
  });
  return { ok: true };
}

export async function listSupportTickets(
  actor: AdminActorContext,
  filters?: { status?: string; priority?: string; q?: string }
) {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters?.status && filters.status !== 'all') {
    params.push(filters.status);
    conditions.push(`t.status = $${params.length}`);
  }
  if (filters?.priority && filters.priority !== 'all') {
    params.push(filters.priority);
    conditions.push(`t.priority = $${params.length}`);
  }
  if (filters?.q?.trim()) {
    params.push(`%${filters.q.trim()}%`);
    conditions.push(
      `(t.ticket_code ILIKE $${params.length} OR t.subject ILIKE $${params.length} OR t.description ILIKE $${params.length})`
    );
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const res = await dbQuery<{
    id: string;
    ticket_code: string;
    category: string;
    issue_sub_category: string | null;
    priority: string;
    status: string;
    booking_code: string | null;
    stay_title: string | null;
    guest_name: string | null;
    guest_email: string | null;
    assignee_name: string | null;
    sla_due_at: string | null;
    subject: string;
    description: string;
    resolution_summary: string;
    attachments: unknown;
    created_at: string;
    updated_at: string;
  }>(
    `SELECT t.*, b.booking_code, s.title_en AS stay_title,
            g.full_name AS guest_name, g.email AS guest_email,
            st.full_name AS assignee_name
     FROM support_tickets t
     LEFT JOIN bookings b ON b.id = t.booking_id
     LEFT JOIN stays s ON s.id = t.stay_id
     LEFT JOIN users g ON g.id = t.guest_id
     LEFT JOIN users st ON st.id = t.assigned_staff_id
     ${where}
     ORDER BY
       CASE t.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
       t.created_at DESC`,
    params
  );

  const ticketIds = res.rows.map((r) => String(r.id));
  const msgRes =
    ticketIds.length > 0
      ? await dbQuery<{
          id: string;
          ticket_id: string;
          sender_name: string | null;
          sender_role: string | null;
          is_internal_note: boolean;
          body: string;
          attachments: unknown;
          created_at: string;
        }>(
          `SELECT m.id, m.ticket_id, m.is_internal_note, m.body, m.attachments, m.created_at,
                  u.full_name AS sender_name, u.role AS sender_role
           FROM support_ticket_messages m
           LEFT JOIN users u ON u.id = m.sender_id
           WHERE m.ticket_id = ANY($1::uuid[])
           ORDER BY m.created_at ASC`,
          [ticketIds]
        )
      : { rows: [] };

  const messagesByTicket = new Map<
    string,
    Array<{
      id: string;
      senderName: string;
      senderRole: string;
      isInternalNote: boolean;
      body: string;
      attachments: string[];
      createdAt: string;
    }>
  >();

  for (const m of msgRes.rows) {
    const tid = String(m.ticket_id);
    const list = messagesByTicket.get(tid) ?? [];
    const att = Array.isArray(m.attachments) ? m.attachments.map(String) : [];
    list.push({
      id: String(m.id),
      senderName: m.sender_name ? String(m.sender_name) : 'Staff',
      senderRole: m.sender_role ? String(m.sender_role) : 'admin',
      isInternalNote: Boolean(m.is_internal_note),
      body: String(m.body),
      attachments: att,
      createdAt: new Date(String(m.created_at)).toISOString(),
    });
    messagesByTicket.set(tid, list);
  }

  return res.rows.map((t) => {
    const att = Array.isArray(t.attachments) ? t.attachments.map(String) : [];
    return {
      id: String(t.id),
      ticketCode: String(t.ticket_code),
      category: String(t.category),
      issueSubCategory: String(t.issue_sub_category ?? ''),
      priority: String(t.priority),
      status: String(t.status),
      bookingCode: t.booking_code ? String(t.booking_code) : null,
      stayTitle: t.stay_title ? String(t.stay_title) : null,
      guestName: t.guest_name ? String(t.guest_name) : null,
      guestEmail: t.guest_email
        ? actor.hasPiiAccess
          ? String(t.guest_email)
          : maskEmail(String(t.guest_email))
        : null,
      assigneeName: t.assignee_name ? String(t.assignee_name) : null,
      slaDueAt: t.sla_due_at ? new Date(String(t.sla_due_at)).toISOString() : null,
      subject: String(t.subject),
      description: String(t.description ?? ''),
      resolutionSummary: String(t.resolution_summary ?? ''),
      attachments: att,
      messages: messagesByTicket.get(String(t.id)) ?? [],
      createdAt: new Date(String(t.created_at)).toISOString(),
      updatedAt: new Date(String(t.updated_at)).toISOString(),
    };
  });
}

export async function createSupportTicket(
  actor: AdminActorContext,
  input: {
    category: string;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    subject: string;
    description: string;
    bookingId?: string | null;
    stayId?: string | null;
  }
) {
  const id = crypto.randomUUID();
  const code = `TK-${new Date().getFullYear()}-${String(Math.floor(100 + Math.random() * 900))}`;
  const slaHours = input.priority === 'urgent' ? 2 : input.priority === 'high' ? 6 : 24;

  await dbQuery(
    `INSERT INTO support_tickets (
      id, ticket_code, category, priority, status, booking_id, stay_id,
      assigned_staff_id, sla_due_at, subject, description
    ) VALUES (
      $1,$2,$3,$4,'open',$5,$6,$7, NOW() + ($8 || ' hours')::interval, $9,$10
    )`,
    [
      id,
      code,
      input.category,
      input.priority,
      input.bookingId && isValidUuid(input.bookingId) ? input.bookingId : null,
      input.stayId && isValidUuid(input.stayId) ? input.stayId : null,
      actor.user.id,
      String(slaHours),
      input.subject.trim(),
      input.description.trim(),
    ]
  );

  if (input.priority === 'urgent' || input.priority === 'high') {
    await triggerAutomationTask({
      ruleKey: 'auto_task_support_ticket',
      title: `SLA Support Ticket ${code}: ${input.subject.trim()}`,
      description: input.description.trim(),
      entityType: 'ticket',
      entityId: id,
      assignedStaffId: actor.user.id,
      createdBy: actor.user.id,
      fallbackPriority: input.priority,
      fallbackDueHours: slaHours,
    });
  }

  await logAdminAudit({
    actor,
    module: 'support',
    action: 'create',
    entityType: 'support_ticket',
    entityId: id,
    after: { code, subject: input.subject, priority: input.priority },
  });

  return { id, ticketCode: code };
}

export async function updateSupportTicket(
  actor: AdminActorContext,
  ticketId: string,
  input: {
    status?: 'open' | 'in_progress' | 'waiting_user' | 'resolved' | 'closed';
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    resolutionSummary?: string;
    messageBody?: string;
    isInternalNote?: boolean;
  }
) {
  if (!isValidUuid(ticketId)) throw new AppError('VALIDATION_ERROR', 'Invalid ticket ID.');

  const curRes = await dbQuery('SELECT * FROM support_tickets WHERE id = $1', [ticketId]);
  const cur = curRes.rows[0];
  if (!cur) throw new AppError('NOT_FOUND', 'Ticket not found.');

  await dbQuery(
    `UPDATE support_tickets
     SET status = COALESCE($1, status),
         priority = COALESCE($2, priority),
         resolution_summary = COALESCE($3, resolution_summary),
         updated_at = NOW()
     WHERE id = $4`,
    [
      input.status ?? null,
      input.priority ?? null,
      input.resolutionSummary !== undefined ? input.resolutionSummary.trim() : null,
      ticketId,
    ]
  );

  if (input.messageBody?.trim()) {
    await dbQuery(
      `INSERT INTO support_ticket_messages (id, ticket_id, sender_id, is_internal_note, body)
       VALUES ($1,$2,$3,$4,$5)`,
      [
        crypto.randomUUID(),
        ticketId,
        actor.user.id,
        Boolean(input.isInternalNote),
        input.messageBody.trim(),
      ]
    );
  }

  await logAdminAudit({
    actor,
    module: 'support',
    action: 'edit',
    entityType: 'support_ticket',
    entityId: ticketId,
    before: { status: cur.status, priority: cur.priority },
    after: input,
  });

  return { ok: true };
}

export async function listSafetyReports(filters?: { status?: string; severity?: string }) {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters?.status && filters.status !== 'all') {
    params.push(filters.status);
    conditions.push(`sr.status = $${params.length}`);
  }
  if (filters?.severity && filters.severity !== 'all') {
    params.push(filters.severity);
    conditions.push(`sr.severity = $${params.length}`);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const res = await dbQuery<{
    id: string;
    report_type: string;
    severity: string;
    status: string;
    stay_title: string | null;
    reported_user_name: string | null;
    booking_code: string | null;
    summary: string;
    action_taken: string;
    created_at: string;
    resolved_at: string | null;
  }>(
    `SELECT sr.*, s.title_en AS stay_title, ru.full_name AS reported_user_name, b.booking_code
     FROM safety_reports sr
     LEFT JOIN stays s ON s.id = sr.stay_id
     LEFT JOIN users ru ON ru.id = sr.reported_user_id
     LEFT JOIN bookings b ON b.id = sr.booking_id
     ${where}
     ORDER BY
       CASE sr.severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
       sr.created_at DESC`,
    params
  );

  return res.rows.map((r) => ({
    id: String(r.id),
    reportType: String(r.report_type),
    severity: String(r.severity),
    status: String(r.status),
    stayTitle: r.stay_title ? String(r.stay_title) : null,
    reportedUserName: r.reported_user_name ? String(r.reported_user_name) : null,
    bookingCode: r.booking_code ? String(r.booking_code) : null,
    summary: String(r.summary),
    actionTaken: String(r.action_taken ?? ''),
    createdAt: new Date(String(r.created_at)).toISOString(),
    resolvedAt: r.resolved_at ? new Date(String(r.resolved_at)).toISOString() : null,
  }));
}

export async function createSafetyReport(
  actor: AdminActorContext,
  input: {
    reportType: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    summary: string;
    stayId?: string | null;
    bookingId?: string | null;
  }
) {
  const id = crypto.randomUUID();
  await dbQuery(
    `INSERT INTO safety_reports (
      id, report_type, severity, status, stay_id, booking_id, reporter_user_id, assigned_staff_id, summary
    ) VALUES ($1,$2,$3,'open',$4,$5,$6,$6,$7)`,
    [
      id,
      input.reportType,
      input.severity,
      input.stayId && isValidUuid(input.stayId) ? input.stayId : null,
      input.bookingId && isValidUuid(input.bookingId) ? input.bookingId : null,
      actor.user.id,
      input.summary.trim(),
    ]
  );

  await logAdminAudit({
    actor,
    module: 'trust_safety',
    action: 'create',
    entityType: 'safety_report',
    entityId: id,
    after: input,
  });

  return { id };
}

export async function resolveSafetyReport(
  actor: AdminActorContext,
  reportId: string,
  input: {
    status: 'investigating' | 'action_taken' | 'dismissed';
    actionTaken: string;
    suspendStay?: boolean;
  }
) {
  if (!isValidUuid(reportId)) throw new AppError('VALIDATION_ERROR', 'Invalid report ID.');

  return dbTransaction(async (tx) => {
    const curRes = await tx.query<{ id: string; stay_id: string | null; status: string }>(
      'SELECT id, stay_id, status FROM safety_reports WHERE id = $1 FOR UPDATE',
      [reportId]
    );
    const cur = curRes.rows[0];
    if (!cur) throw new AppError('NOT_FOUND', 'Safety report not found.');

    await tx.query(
      `UPDATE safety_reports
       SET status = $1,
           action_taken = $2,
           resolved_at = CASE WHEN $1 IN ('action_taken', 'dismissed') THEN NOW() ELSE NULL END
       WHERE id = $3`,
      [input.status, input.actionTaken.trim(), reportId]
    );

    if (input.suspendStay && cur.stay_id) {
      await tx.query(
        `UPDATE stays SET status = 'suspended', moderation_reason = $1 WHERE id = $2`,
        [input.actionTaken.trim() || 'Suspended by Trust & Safety', cur.stay_id]
      );
    }

    await logAdminAudit(
      {
        actor,
        module: 'trust_safety',
        action: 'approve',
        entityType: 'safety_report',
        entityId: reportId,
        before: { status: cur.status },
        after: input,
        reason: input.actionTaken,
      },
      tx
    );

    return { ok: true };
  });
}
