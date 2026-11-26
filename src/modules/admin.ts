import crypto from 'node:crypto';
import type { SessionUser } from '@/lib/auth/session';
import { addDaysIso, getTodayIsoVietnam, isValidUuid } from '@/lib/dates';
import { dbQuery, dbTransaction, toNum } from '@/lib/db';
import { AppError } from '@/lib/errors';
import { advanceHostLeadMilestoneTx } from '@/modules/host-lead-sync';

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

    const destRes = await tx.query<{ id: string; name_en: string; name_vi: string; map_x: number; map_y: number }>(
      'SELECT id, name_en, name_vi, map_x, map_y FROM destinations WHERE slug = $1',
      [app.destination_slug]
    );
    const dest = destRes.rows[0];
    if (!dest) throw new AppError('NOT_FOUND', 'Destination slug invalid.');

    const stayId = crypto.randomUUID();
    const roomId = crypto.randomUUID();
    const pkgId = crypto.randomUUID();
    const slugBase = app.stay_name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    const slug = `${slugBase}-${stayId.slice(0, 6)}`;
    const regCode = `VN-NEW-${stayId.slice(0, 6).toUpperCase()}`;

    const resolvedKitchen =
      app.kitchen_type && ['full', 'kitchenette', 'shared', 'none'].includes(app.kitchen_type)
        ? app.kitchen_type
        : app.has_kitchen
          ? 'full'
          : 'none';
    const resolvedLaundry =
      app.laundry_type && ['in_unit', 'building', 'service', 'none'].includes(app.laundry_type)
        ? app.laundry_type
        : app.has_laundry
          ? 'in_unit'
          : 'none';
    const hasWorkspace = Boolean(app.has_workspace);
    const hasChair = Boolean(app.has_ergonomic_chair);
    const hasMonitor = Boolean(app.has_external_monitor);
    const wifiSpeed = Math.max(0, toNum(app.measured_download_mbps, 0));

    const amenitiesList: string[] = [];
    if (wifiSpeed > 0) amenitiesList.push(`Wi-Fi (~${wifiSpeed} Mbps host-reported)`);
    if (hasWorkspace) amenitiesList.push('Dedicated Desk');
    if (hasChair) amenitiesList.push('Ergonomic Chair');
    if (hasMonitor) amenitiesList.push('External Monitor');
    if (resolvedKitchen !== 'none') amenitiesList.push('Kitchen');
    if (resolvedLaundry !== 'none') amenitiesList.push('Laundry');

    await tx.query(
      `INSERT INTO stays (
        id, slug, host_id, destination_id, title_en, title_vi, subtitle_en, subtitle_vi,
        description_en, description_vi, neighborhood_en, neighborhood_vi, exact_address,
        checkin_instructions_en, checkin_instructions_vi, registration_code,
        property_type, business_model, status, is_instant_book,
        cancellation_policy, wifi_download_mbps, wifi_upload_mbps, wifi_jitter_ms,
        verification_tier, is_wifi_verified, is_work_ready, verified_at,
        wifi_tester_note, workspace_summary_en, workspace_summary_vi, workspace_photo_url,
        has_workspace, has_ergonomic_chair, has_external_monitor, has_call_booth, kitchen_type, laundry_type,
        map_x, map_y, hero_image, gallery_images, amenities, nearby_coworking
      ) VALUES (
        $1,$2,$3,$4,$5,$6,'Comfortable Vietnam residence for 7 to 30+ night stays','Không gian lưu trú thoải mái từ 7 đến 30+ đêm tại Việt Nam',
        'Newly listed property ready for comfortable weekly and monthly stays across Vietnam.',
        'Chỗ ở mới sẵn sàng cho lưu trú theo tuần và theo tháng thoải mái tại Việt Nam.',
        $7,$8,'Address unlocked upon confirmation','Smart lock details emailed upon confirmation',
        'Mã nhận phòng gửi tự động sau khi đặt',$9,
        $10,'booking_flow','live',TRUE,'flexible',$11,$12,4,
        'SELF_DECLARED', FALSE, FALSE, NOW(),
        'Host-declared property amenities & Internet profile',
        $13,$14,'/images/workspaces/ergonomic-indochine-desk.jpg',
        $15,$16,$17,FALSE,$18,$19,$20,$21,'/images/stays/hanoi-tayho-jade.jpg',
        '["/images/stays/hanoi-tayho-jade.jpg","/images/workspaces/ergonomic-indochine-desk.jpg"]'::jsonb,
        $22::jsonb,
        '[]'::jsonb
      )`,
      [
        stayId,
        slug,
        app.applicant_user_id,
        dest.id,
        app.stay_name,
        app.stay_name,
        dest.name_en,
        dest.name_vi,
        regCode,
        app.property_type,
        wifiSpeed,
        Math.round(wifiSpeed * 0.75),
        hasWorkspace ? 'Dedicated desk available' : 'Comfortable living space',
        hasWorkspace ? 'Có bàn làm việc riêng' : 'Không gian sinh hoạt thoải mái',
        hasWorkspace,
        hasChair,
        hasMonitor,
        resolvedKitchen,
        resolvedLaundry,
        dest.map_x,
        dest.map_y,
        JSON.stringify(amenitiesList),
      ]
    );

    await tx.query(
      `INSERT INTO stay_rooms (
        id, stay_id, name_en, name_vi, description_en, description_vi,
        max_guests, beds_count, units_total, room_image, room_features
      ) VALUES (
        $1,$2,'Private Studio','Studio Riêng Tư',
        'Comfortable private apartment for weekly and monthly stays.',
        'Căn hộ riêng thoải mái cho lưu trú theo tuần và theo tháng.',
        2,1,2,'/images/stays/hanoi-tayho-jade.jpg',$3::jsonb
      )`,
      [roomId, stayId, JSON.stringify(amenitiesList)]
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
      [pkgId, stayId, roomId, today, addDaysIso(today, 365)]
    );

    await tx.query(
      `UPDATE host_applications
       SET status = 'approved', review_note = $1, created_stay_id = $2
       WHERE id = $3`,
      [reviewNote.trim() || 'Approved & published live', stayId, applicationId]
    );

    await tx.query(
      `UPDATE users
       SET role = CASE WHEN role = 'nomad' THEN 'host' ELSE role END,
           crm_stage = CASE WHEN crm_stage IN ('new', 'lead', 'onboarding') THEN 'active' ELSE crm_stage END
       WHERE id = $1`,
      [app.applicant_user_id]
    );

    await advanceHostLeadMilestoneTx(tx, {
      userId: app.applicant_user_id,
      targetStage: 'published',
      summary: `Host application approved & stay published live (${slug})`,
      actorUserId: _admin.id,
    });

    await tx.query(
      `INSERT INTO admin_audit_logs (
        id, actor_user_id, actor_email, module, action, entity_type, entity_id, after_json, reason
      ) VALUES ($1,$2,$3,'listings','approve','host_application',$4,$5::jsonb,$6)`,
      [
        crypto.randomUUID(),
        _admin.id,
        _admin.email,
        applicationId,
        JSON.stringify({ status: 'approved', createdStayId: stayId, slug }),
        reviewNote.trim(),
      ]
    );

    return { status: 'approved' as const, createdStaySlug: slug };
  });
}

export async function updateAdminStayStatus(
  _admin: SessionUser,
  stayId: string,
  status: 'live' | 'limited' | 'paused'
) {
  if (!isValidUuid(stayId)) throw new AppError('VALIDATION_ERROR', 'Invalid stay ID.');
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
  }>('SELECT verification_tier, is_wifi_verified, is_work_ready FROM stays WHERE id = $1', [stayId]);
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

  await dbQuery(
    `UPDATE stays
     SET verification_tier = $1,
         is_wifi_verified = $2,
         is_work_ready = $3,
         verified_at = NOW(),
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
