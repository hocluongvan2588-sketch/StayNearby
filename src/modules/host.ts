import crypto from 'node:crypto';
import type { SessionUser } from '@/lib/auth/session';
import { getTodayIsoVietnam, isValidIsoDate, isValidUuid } from '@/lib/dates';
import { dbQuery, dbTransaction, toNum } from '@/lib/db';
import { AppError } from '@/lib/errors';

export async function getHostConsoleData(user: SessionUser) {
  const [walletRes, staysRes, appsRes, bookingsRes, referralsRes, blocksRes] = await Promise.all([
    dbQuery<{ balance_vnd: string | number; updated_at: string | Date }>(
      'SELECT balance_vnd, updated_at FROM host_wallets WHERE host_id = $1',
      [user.id]
    ),
    dbQuery(
      `SELECT s.*, d.name_en AS destination_name_en, d.name_vi AS destination_name_vi,
              r.id AS room_id, r.name_en AS room_name_en, r.name_vi AS room_name_vi, r.units_total,
              p.id AS package_id, p.name_en AS package_name_en, p.is_listed,
              p.wholesale_7_vnd, p.wholesale_14_vnd, p.wholesale_21_vnd, p.wholesale_30_vnd,
              p.extra_night_vnd, p.is_deal_featured
       FROM stays s
       JOIN destinations d ON d.id = s.destination_id
       LEFT JOIN LATERAL (
         SELECT * FROM stay_rooms sr WHERE sr.stay_id = s.id LIMIT 1
       ) r ON TRUE
       LEFT JOIN LATERAL (
         SELECT * FROM stay_packages sp WHERE sp.stay_id = s.id LIMIT 1
       ) p ON TRUE
       WHERE s.host_id = $1
       ORDER BY s.created_at DESC`,
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
  ]);

  return {
    walletBalanceVnd: toNum(walletRes.rows[0]?.balance_vnd, 0),
    stays: staysRes.rows.map((s) => ({
      id: String(s.id),
      slug: String(s.slug),
      titleEn: String(s.title_en),
      titleVi: String(s.title_vi),
      destinationNameEn: String(s.destination_name_en),
      destinationNameVi: String(s.destination_name_vi),
      propertyType: String(s.property_type),
      businessModel: s.business_model as 'booking_flow' | 'stay_direct',
      status: String(s.status),
      wifiDownloadMbps: toNum(s.wifi_download_mbps),
      wifiUploadMbps: toNum(s.wifi_upload_mbps),
      wifiJitterMs: toNum(s.wifi_jitter_ms),
      wifiTestedAt: new Date(String(s.wifi_tested_at)).toISOString(),
      roomId: s.room_id ? String(s.room_id) : null,
      roomNameEn: s.room_name_en ? String(s.room_name_en) : '',
      unitsTotal: toNum(s.units_total, 1),
      packageId: s.package_id ? String(s.package_id) : null,
      isListed: Boolean(s.is_listed),
      isDealFeatured: Boolean(s.is_deal_featured),
      wholesale7Vnd: toNum(s.wholesale_7_vnd),
      wholesale14Vnd: toNum(s.wholesale_14_vnd),
      wholesale21Vnd: toNum(s.wholesale_21_vnd),
      wholesale30Vnd: toNum(s.wholesale_30_vnd),
      extraNightVnd: toNum(s.extra_night_vnd),
      directBookingUrl: s.direct_booking_url ? String(s.direct_booking_url) : '',
    })),
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
    bookings: bookingsRes.rows.map((b) => ({
      id: String(b.id),
      bookingCode: String(b.booking_code),
      stayTitleEn: String(b.title_en),
      stayTitleVi: String(b.title_vi),
      guestName: String(b.guest_name),
      guestEmail: b.status === 'confirmed' || b.status === 'completed' ? String(b.guest_email) : 'Hidden until confirmed',
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
      guestTotalVnd: toNum(b.guest_total_vnd),
    })),
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
      'NomadStays quality baseline requires kitchen, laundry, and a dedicated workspace.'
    );
  }
  if (input.businessModel === 'stay_direct' && !input.directBookingUrl?.startsWith('http')) {
    throw new AppError(
      'VALIDATION_ERROR',
      'StayDirect™ requires your direct HTTPS booking URL.'
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
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,39,TRUE,$8,$9,$10,$11,$12,'submitted','Application fee €39 settled — queued for verification')`,
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

    // Upgrade nomad user to host role when applying if not already admin/host
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

export async function updateHostStayConfiguration(
  user: SessionUser,
  stayId: string,
  input: {
    businessModel: 'booking_flow' | 'stay_direct';
    directBookingUrl?: string;
    wholesale7Vnd: number;
    wholesale14Vnd: number;
    wholesale21Vnd: number;
    wholesale30Vnd: number;
    extraNightVnd: number;
    isDealFeatured: boolean;
  }
) {
  if (!isValidUuid(stayId)) {
    throw new AppError('VALIDATION_ERROR', 'Invalid stay identifier.');
  }

  return dbTransaction(async (tx) => {
    const stayRes = await tx.query<{ id: string; host_id: string }>(
      'SELECT id, host_id FROM stays WHERE id = $1 FOR UPDATE',
      [stayId]
    );
    const stay = stayRes.rows[0];
    if (!stay) throw new AppError('NOT_FOUND', 'Stay not found.');
    if (stay.host_id !== user.id && user.role !== 'admin') {
      throw new AppError('FORBIDDEN', 'You do not own this property.');
    }

    if (input.businessModel === 'stay_direct' && !input.directBookingUrl?.startsWith('http')) {
      throw new AppError('VALIDATION_ERROR', 'StayDirect™ requires a valid booking URL.');
    }

    await tx.query(
      `UPDATE stays SET business_model = $1, direct_booking_url = $2 WHERE id = $3`,
      [input.businessModel, input.directBookingUrl?.trim() || null, stayId]
    );

    await tx.query(
      `UPDATE stay_packages
       SET wholesale_7_vnd = $1,
           wholesale_14_vnd = $2,
           wholesale_21_vnd = $3,
           wholesale_30_vnd = $4,
           extra_night_vnd = $5,
           is_deal_featured = $6
       WHERE stay_id = $7`,
      [
        Math.round(input.wholesale7Vnd),
        Math.round(input.wholesale14Vnd),
        Math.round(input.wholesale21Vnd),
        Math.round(input.wholesale30Vnd),
        Math.round(input.extraNightVnd),
        input.isDealFeatured,
        stayId,
      ]
    );

    return { ok: true };
  });
}

export async function recordWifiSpeedTest(
  user: SessionUser,
  stayId: string,
  input: { downloadMbps: number; uploadMbps: number; jitterMs: number; note?: string }
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
         wifi_tester_note = $4
     WHERE id = $5`,
    [
      Math.max(10, Math.round(input.downloadMbps)),
      Math.max(5, Math.round(input.uploadMbps)),
      Math.max(0, Math.round(input.jitterMs)),
      input.note?.trim() || 'Live router speed check verified',
      stayId,
    ]
  );

  return { ok: true };
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
