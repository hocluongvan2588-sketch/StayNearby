import crypto from 'node:crypto';
import type { SessionUser } from '@/lib/auth/session';
import { isValidUuid } from '@/lib/dates';
import { dbQuery, dbTransaction, toNum } from '@/lib/db';
import { AppError } from '@/lib/errors';
import { assertAdminStatusTransition } from '@/modules/listing-lifecycle';
import { captureStayRevision, dbExecutor } from '@/modules/listing-revisions';

export async function getAdminConsoleData() {
  const [appsRes, staysRes, crmRes, bookingsRes, notifRes] = await Promise.all([
    dbQuery(
      `SELECT ha.*, u.full_name AS applicant_name, u.email AS applicant_email
       FROM host_applications ha
       JOIN users u ON u.id = ha.applicant_user_id
       ORDER BY ha.created_at DESC`
    ),
    dbQuery(
      `SELECT s.*, u.full_name AS host_name, d.name_en AS destination_name_en,
              r.id AS room_id, r.ical_url, r.ical_last_synced_at, r.ical_sync_status
       FROM stays s
       JOIN users u ON u.id = s.host_id
       JOIN destinations d ON d.id = s.destination_id
       LEFT JOIN LATERAL (
         SELECT id, ical_url, ical_last_synced_at, ical_sync_status
         FROM stay_rooms sr WHERE sr.stay_id = s.id LIMIT 1
       ) r ON TRUE
       ORDER BY s.created_at DESC`
    ),
    dbQuery(
      `SELECT u.id, u.email, u.full_name, u.role, u.nationality, u.membership_tier,
              u.reward_credit_vnd, u.phone, u.crm_stage, u.crm_note,
              COUNT(b.id) AS booking_count,
              COALESCE(SUM(b.guest_total_vnd) FILTER (WHERE b.status IN ('RESERVED_LOCKED', 'CHECKED_IN_COMPLETED', 'confirmed', 'completed')), 0) AS total_spent_vnd
       FROM users u
       LEFT JOIN bookings b ON b.guest_id = u.id
       GROUP BY u.id
       ORDER BY u.created_at ASC`
    ),
    dbQuery(
      `SELECT b.*, s.title_en, u.full_name AS guest_name
       FROM bookings b
       JOIN stays s ON s.id = b.stay_id
       JOIN users u ON u.id = b.guest_id
       ORDER BY b.created_at DESC
       LIMIT 30`
    ),
    dbQuery(
      `SELECT bn.*, b.booking_code
       FROM booking_notifications bn
       JOIN bookings b ON b.id = bn.booking_id
       ORDER BY bn.created_at DESC
       LIMIT 30`
    ),
  ]);

  return {
    applications: appsRes.rows.map((a) => ({
      id: String(a.id),
      applicantName: String(a.applicant_name),
      applicantEmail: String(a.applicant_email),
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
    stays: staysRes.rows.map((s) => ({
      id: String(s.id),
      slug: String(s.slug),
      titleEn: String(s.title_en),
      titleVi: String(s.title_vi),
      hostName: String(s.host_name),
      destinationNameEn: String(s.destination_name_en),
      businessModel: String(s.business_model),
      status: String(s.status),
      wifiDownloadMbps: toNum(s.wifi_download_mbps),
      wifiUploadMbps: toNum(s.wifi_upload_mbps),
      wifiJitterMs: toNum(s.wifi_jitter_ms),
      verificationTier: String(s.verification_tier ?? 'SELF_DECLARED'),
      isWifiVerified: Boolean(s.is_wifi_verified),
      isWorkReady: Boolean(s.is_work_ready),
      verifiedAt: new Date(String(s.verified_at ?? s.wifi_tested_at)).toISOString(),
      speedtestProofUrl: s.speedtest_proof_url ? String(s.speedtest_proof_url) : '',
      workspaceVideoUrl: s.workspace_video_url ? String(s.workspace_video_url) : '',
      roomId: s.room_id ? String(s.room_id) : null,
      icalUrl: s.ical_url ? String(s.ical_url) : '',
      icalSyncStatus: String(s.ical_sync_status ?? 'idle'),
    })),
    crmUsers: crmRes.rows.map((u) => ({
      id: String(u.id),
      email: String(u.email),
      fullName: String(u.full_name),
      role: String(u.role),
      nationality: String(u.nationality),
      membershipTier: String(u.membership_tier),
      rewardCreditVnd: toNum(u.reward_credit_vnd),
      phone: u.phone ? String(u.phone) : '',
      crmStage: String(u.crm_stage),
      crmNote: String(u.crm_note ?? ''),
      bookingCount: toNum(u.booking_count),
      totalSpentVnd: toNum(u.total_spent_vnd),
    })),
    recentBookings: bookingsRes.rows.map((b) => ({
      id: String(b.id),
      bookingCode: String(b.booking_code),
      stayTitleEn: String(b.title_en),
      guestName: String(b.guest_name),
      businessModel: String(b.business_model),
      status: String(b.status),
      nights: toNum(b.nights),
      guestTotalVnd: toNum(b.guest_total_vnd),
      serviceFeeVnd: toNum(b.service_fee_vnd),
      feeOnlineVnd:
        toNum(b.booking_fee_online_vnd) > 0
          ? toNum(b.booking_fee_online_vnd)
          : toNum(b.service_fee_vnd),
      payAtCheckinVnd:
        toNum(b.pay_at_checkin_vnd) > 0
          ? toNum(b.pay_at_checkin_vnd)
          : toNum(b.wholesale_total_vnd),
      mismatchReason: String(b.mismatch_reason ?? ''),
    })),
    notifications: notifRes.rows.map((n) => ({
      id: String(n.id),
      bookingCode: String(n.booking_code),
      recipientRole: String(n.recipient_role),
      channel: String(n.channel),
      recipientContact: String(n.recipient_contact),
      subject: String(n.subject),
      status: String(n.status),
      createdAt: new Date(String(n.created_at)).toISOString(),
    })),
  };
}

export async function reviewHostApplication(
  _admin: SessionUser,
  applicationId: string,
  decision: 'approved' | 'rejected',
  reviewNote: string
) {
  if (!isValidUuid(applicationId)) {
    throw new AppError('VALIDATION_ERROR', 'Invalid application ID.');
  }

  return dbTransaction(async (tx) => {
    const appRes = await tx.query<{
      id: string;
      applicant_user_id: string;
      stay_name: string;
      destination_slug: string;
      property_type: string;
      measured_download_mbps: number;
      has_kitchen: boolean;
      has_laundry: boolean;
      has_workspace: boolean;
      has_ergonomic_chair: boolean;
      has_external_monitor: boolean;
      kitchen_type: string | null;
      laundry_type: string | null;
      status: string;
    }>('SELECT * FROM host_applications WHERE id = $1 FOR UPDATE', [applicationId]);

    const app = appRes.rows[0];
    if (!app) throw new AppError('NOT_FOUND', 'Host application not found.');
    if (app.status !== 'submitted') {
      throw new AppError('CONFLICT', 'Application was already reviewed.');
    }

    if (decision === 'rejected') {
      await tx.query(
        `UPDATE host_applications SET status = 'rejected', review_note = $1 WHERE id = $2`,
        [reviewNote.trim() || 'Requirements incomplete', applicationId]
      );
      await tx.query(
        `INSERT INTO crm_activities (id, entity_type, entity_id, activity_type, summary, body, actor_user_id)
         SELECT $1, 'host_lead', hl.id, 'note', $2, $3, $4
         FROM host_leads hl
         WHERE hl.application_id = $5 OR hl.linked_user_id = $6
         LIMIT 1`,
        [
          crypto.randomUUID(),
          `Host application rejected: ${app.stay_name}`,
          reviewNote.trim() || 'Requirements incomplete',
          _admin.id,
          applicationId,
          app.applicant_user_id,
        ]
      );
      return { status: 'rejected' as const, createdStaySlug: null };
    }

    // Phase 5 separation: approving a host application is a LEAD-CRM decision
    // only. No stay is created here — listings are created by hosts (wizard)
    // and moderated independently (draft -> pending_review -> live).
    await tx.query(
      `UPDATE host_applications SET status = 'approved', review_note = $1 WHERE id = $2`,
      [reviewNote.trim() || 'Approved — host creates their listing under the new flow', applicationId]
    );

    await tx.query(
      `INSERT INTO crm_activities (id, entity_type, entity_id, activity_type, summary, body, actor_user_id)
       SELECT $1, 'host_lead', hl.id, 'note', $2, $3, $4
       FROM host_leads hl
       WHERE hl.application_id = $5 OR hl.linked_user_id = $6
       LIMIT 1`,
      [
        crypto.randomUUID(),
        `Host application approved: ${app.stay_name}`,
        reviewNote.trim() || 'Approved — host creates their listing under the new flow',
        _admin.id,
        applicationId,
        app.applicant_user_id,
      ]
    );

    await tx.query(
      `UPDATE users
       SET role = CASE WHEN role = 'nomad' THEN 'host' ELSE role END,
           crm_stage = CASE WHEN crm_stage IN ('new', 'lead', 'onboarding') THEN 'active' ELSE crm_stage END
       WHERE id = $1`,
      [app.applicant_user_id]
    );

    // Lead stage stays as-is: 'published' is advanced by listing moderation
    // when the host's own listing goes live (not at application approval).

    await tx.query(
      `INSERT INTO admin_audit_logs (
        id, actor_user_id, actor_email, module, action, entity_type, entity_id, after_json, reason
      ) VALUES ($1,$2,$3,'listings','approve','host_application',$4,$5::jsonb,$6)`,
      [
        crypto.randomUUID(),
        _admin.id,
        _admin.email,
        applicationId,
        JSON.stringify({ status: 'approved', createdStayId: null }),
        reviewNote.trim(),
      ]
    );

    return { status: 'approved' as const, createdStaySlug: null };
  });
}

export async function updateAdminStayStatus(
  _admin: SessionUser,
  stayId: string,
  status: 'live' | 'limited' | 'paused'
) {
  if (!isValidUuid(stayId)) throw new AppError('VALIDATION_ERROR', 'Invalid stay ID.');
  const curRes = await dbQuery<{ status: string }>(
    'SELECT status FROM stays WHERE id = $1',
    [stayId]
  );
  const current = curRes.rows[0];
  if (!current) throw new AppError('NOT_FOUND', 'Stay not found.');
  assertAdminStatusTransition(String(current.status), status);
  await dbQuery('UPDATE stays SET status = $1, reviewed_by = $2, reviewed_at = NOW() WHERE id = $3', [
    status,
    _admin.id,
    stayId,
  ]);
  await dbQuery(
    `INSERT INTO admin_audit_logs (
      id, actor_user_id, actor_email, module, action, entity_type, entity_id, after_json
    ) VALUES ($1,$2,$3,'listings','edit','stay',$4,$5::jsonb)`,
    [crypto.randomUUID(), _admin.id, _admin.email, stayId, JSON.stringify({ status })]
  );
  if (current.status !== status) {
    await captureStayRevision(dbExecutor(), {
      stayId,
      actorUserId: _admin.id,
      action:
        status === 'live' ? 'publish' : current.status === 'live' ? 'unpublish' : 'moderate',
      snapshot: { kind: 'status', from: current.status, to: status },
      changedFields: ['status'],
      changeSummary: `Status ${current.status} → ${status}`,
    });
  }
  return { ok: true };
}

export async function updateAdminStayVerification(
  _admin: SessionUser,
  stayId: string,
  input: {
    verificationTier?: 'SELF_DECLARED' | 'HOST_VERIFIED' | 'VIETNOMAD_CERTIFIED';
    isWifiVerified?: boolean;
    isWorkReady?: boolean;
    speedtestProofUrl?: string;
    workspaceVideoUrl?: string;
  }
) {
  if (!isValidUuid(stayId)) throw new AppError('VALIDATION_ERROR', 'Invalid stay ID.');

  const currentRes = await dbQuery<{
    verification_tier: string;
    is_wifi_verified: boolean;
    is_work_ready: boolean;
    wifi_download_mbps: number | null;
    wifi_upload_mbps: number | null;
    wifi_ping_ms: number | null;
    wifi_jitter_ms: number | null;
    wifi_has_service: boolean | null;
    wifi_status: string;
  }>(
    `SELECT verification_tier, is_wifi_verified, is_work_ready,
            wifi_download_mbps, wifi_upload_mbps, wifi_ping_ms, wifi_jitter_ms,
            wifi_has_service, wifi_status
     FROM stays WHERE id = $1`,
    [stayId]
  );
  const cur = currentRes.rows[0];
  if (!cur) throw new AppError('NOT_FOUND', 'Stay not found.');

  const nextWifi = input.isWifiVerified ?? Boolean(cur.is_wifi_verified);
  const nextWorkReady = input.isWorkReady ?? Boolean(cur.is_work_ready);
  const nextTier =
    input.verificationTier ??
    (nextWifi && nextWorkReady
      ? 'VIETNOMAD_CERTIFIED'
      : nextWifi || nextWorkReady
        ? 'HOST_VERIFIED'
        : 'SELF_DECLARED');

  // wifi_status follows the admin's explicit verification action only.
  const hasWifiValues =
    cur.wifi_download_mbps !== null ||
    cur.wifi_upload_mbps !== null ||
    cur.wifi_ping_ms !== null ||
    cur.wifi_jitter_ms !== null ||
    cur.wifi_has_service !== null;
  const nextWifiStatus =
    input.isWifiVerified === undefined
      ? cur.wifi_status
      : nextWifi
        ? 'verified'
        : hasWifiValues
          ? 'host_declared'
          : 'not_updated';

  await dbQuery(
    `UPDATE stays
     SET verification_tier = $1,
         is_wifi_verified = $2,
         is_work_ready = $3,
         verified_at = NOW(),
         wifi_status = $7,
         speedtest_proof_url = COALESCE($4, speedtest_proof_url),
         workspace_video_url = COALESCE($5, workspace_video_url)
     WHERE id = $6`,
    [
      nextTier,
      nextWifi,
      nextWorkReady,
      input.speedtestProofUrl?.trim() || null,
      input.workspaceVideoUrl?.trim() || null,
      stayId,
      nextWifiStatus,
    ]
  );
  return { ok: true };
}

export async function updateAdminCrmUser(
  _admin: SessionUser,
  userId: string,
  input: { crmStage: 'lead' | 'active' | 'vip' | 'follow_up' | 'paused'; crmNote: string }
) {
  if (!isValidUuid(userId)) throw new AppError('VALIDATION_ERROR', 'Invalid user ID.');
  const res = await dbQuery(
    `UPDATE users SET crm_stage = $1, crm_note = $2 WHERE id = $3 RETURNING id`,
    [input.crmStage, input.crmNote.trim(), userId]
  );
  if (!res.rows[0]) throw new AppError('NOT_FOUND', 'User profile not found.');
  return { ok: true };
}
