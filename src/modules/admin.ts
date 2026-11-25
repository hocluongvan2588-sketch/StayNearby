import crypto from 'node:crypto';
import type { SessionUser } from '@/lib/auth/session';
import { addDaysIso, getTodayIsoVietnam, isValidUuid } from '@/lib/dates';
import { dbQuery, dbTransaction, toNum } from '@/lib/db';
import { AppError } from '@/lib/errors';

export async function getAdminConsoleData() {
  const [appsRes, staysRes, crmRes, bookingsRes] = await Promise.all([
    dbQuery(
      `SELECT ha.*, u.full_name AS applicant_name, u.email AS applicant_email
       FROM host_applications ha
       JOIN users u ON u.id = ha.applicant_user_id
       ORDER BY ha.created_at DESC`
    ),
    dbQuery(
      `SELECT s.*, u.full_name AS host_name, d.name_en AS destination_name_en,
              COALESCE(hw.balance_vnd, 0) AS wallet_balance_vnd
       FROM stays s
       JOIN users u ON u.id = s.host_id
       JOIN destinations d ON d.id = s.destination_id
       LEFT JOIN host_wallets hw ON hw.host_id = s.host_id
       ORDER BY s.created_at DESC`
    ),
    dbQuery(
      `SELECT u.id, u.email, u.full_name, u.role, u.nationality, u.membership_tier,
              u.reward_credit_vnd, u.phone, u.crm_stage, u.crm_note,
              COUNT(b.id) AS booking_count,
              COALESCE(SUM(b.guest_total_vnd) FILTER (WHERE b.status IN ('confirmed', 'completed')), 0) AS total_spent_vnd
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
      walletBalanceVnd: toNum(s.wallet_balance_vnd),
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
      business_model: 'booking_flow' | 'stay_direct';
      measured_download_mbps: number;
      direct_booking_url: string | null;
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

    await tx.query(
      `INSERT INTO stays (
        id, slug, host_id, destination_id, title_en, title_vi, subtitle_en, subtitle_vi,
        description_en, description_vi, neighborhood_en, neighborhood_vi, exact_address,
        checkin_instructions_en, checkin_instructions_vi, registration_code,
        property_type, business_model, direct_booking_url, status, is_instant_book,
        cancellation_policy, wifi_download_mbps, wifi_upload_mbps, wifi_jitter_ms,
        wifi_tester_note, workspace_summary_en, workspace_summary_vi, workspace_photo_url,
        has_ergonomic_chair, has_external_monitor, has_call_booth, kitchen_type, laundry_type,
        map_x, map_y, hero_image, gallery_images, amenities, nearby_coworking
      ) VALUES (
        $1,$2,$3,$4,$5,$6,'Verified Vietnam work-ready residence','Lưu trú chuẩn làm việc từ xa tại Việt Nam',
        'Newly onboarded and speed-verified stay ready for 7 to 30+ night bookings.',
        'Chỗ ở mới được kiểm định tốc độ Wi-Fi và đầy đủ tiện ích làm việc dài ngày.',
        $7,$8,'Address unlocked upon confirmation','Smart lock details emailed upon confirmation',
        'Mã nhận phòng gửi tự động sau khi đặt',$9,
        $10,$11,$12,'live',TRUE,'flexible',$13,$14,3,
        'Admin-verified onboarding speed test','Dedicated indoor desk + ergonomic seating',
        'Bàn làm việc riêng và ghế công thái học','/images/workspaces/ergonomic-indochine-desk.jpg',
        TRUE,FALSE,FALSE,'full','in_unit',$15,$16,'/images/stays/hanoi-tayho-jade.jpg',
        '["/images/stays/hanoi-tayho-jade.jpg","/images/workspaces/ergonomic-indochine-desk.jpg"]'::jsonb,
        '["Verified Wi-Fi","Dedicated Desk","Full Kitchen","Laundry"]'::jsonb,
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
        app.business_model,
        app.direct_booking_url,
        toNum(app.measured_download_mbps, 120),
        Math.round(toNum(app.measured_download_mbps, 120) * 0.75),
        dest.map_x,
        dest.map_y,
      ]
    );

    await tx.query(
      `INSERT INTO stay_rooms (
        id, stay_id, name_en, name_vi, description_en, description_vi,
        max_guests, beds_count, units_total, room_image, room_features
      ) VALUES (
        $1,$2,'Work-Ready Private Studio','Studio Làm Việc Riêng Tư',
        'Private residence with desk, kitchen, and laundry kit.',
        'Không gian riêng có bàn làm việc, bếp và máy giặt.',
        2,1,2,'/images/stays/hanoi-tayho-jade.jpg','["Dedicated Desk","Kitchen","Laundry"]'::jsonb
      )`,
      [roomId, stayId]
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

    return { status: 'approved' as const, createdStaySlug: slug };
  });
}

export async function updateAdminStayStatus(
  _admin: SessionUser,
  stayId: string,
  status: 'live' | 'limited' | 'paused'
) {
  if (!isValidUuid(stayId)) throw new AppError('VALIDATION_ERROR', 'Invalid stay ID.');
  await dbQuery('UPDATE stays SET status = $1 WHERE id = $2', [status, stayId]);
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
