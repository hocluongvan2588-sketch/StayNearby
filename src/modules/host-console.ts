import crypto from 'node:crypto';
import type { SessionUser } from '@/lib/auth/session';
import {
  addDaysIso,
  enumerateStayNights,
  getTodayIsoVietnam,
  isValidIsoDate,
  isValidUuid,
} from '@/lib/dates';
import { dbQuery, dbTransaction, toNum } from '@/lib/db';
import { AppError } from '@/lib/errors';
import { submitHostApplication } from '@/modules/host';

function toIsoDate(val: unknown): string {
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  return String(val ?? '').slice(0, 10);
}

function toIsoTimestamp(val: unknown): string {
  if (!val) return new Date().toISOString();
  if (val instanceof Date) return val.toISOString();
  return new Date(String(val)).toISOString();
}

export interface HostShellContext {
  pendingReservationsCount: number;
  unreadMessagesCount: number;
  unreadNotificationsCount: number;
  notifications: Array<{
    id: string;
    bookingCode: string;
    subject: string;
    isRead: boolean;
    createdAt: string;
  }>;
}

export async function getHostShellContext(user: SessionUser): Promise<HostShellContext> {
  const [pendingRes, unreadMsgRes, notifRes] = await Promise.all([
    dbQuery<{ cnt: string | number }>(
      `SELECT COUNT(*) AS cnt
       FROM bookings b
       JOIN stays s ON s.id = b.stay_id
       WHERE s.host_id = $1 AND b.status IN ('PENDING_HOST_APPROVAL', 'PENDING_PAYMENT')`,
      [user.id]
    ),
    dbQuery<{ cnt: string | number }>(
      `SELECT COALESCE(SUM(host_unread_count), 0) AS cnt
       FROM conversations
       WHERE host_id = $1`,
      [user.id]
    ),
    dbQuery<{
      id: string;
      booking_code: string;
      subject: string;
      is_read: boolean;
      created_at: string | Date;
    }>(
      `SELECT bn.id, b.booking_code, bn.subject, bn.is_read, bn.created_at
       FROM booking_notifications bn
       JOIN bookings b ON b.id = bn.booking_id
       JOIN stays s ON s.id = b.stay_id
       WHERE s.host_id = $1 AND bn.recipient_role = 'host'
       ORDER BY bn.created_at DESC
       LIMIT 15`,
      [user.id]
    ),
  ]);

  const notifications = notifRes.rows.map((r) => ({
    id: String(r.id),
    bookingCode: String(r.booking_code),
    subject: String(r.subject),
    isRead: Boolean(r.is_read),
    createdAt: toIsoTimestamp(r.created_at),
  }));

  return {
    pendingReservationsCount: toNum(pendingRes.rows[0]?.cnt, 0),
    unreadMessagesCount: toNum(unreadMsgRes.rows[0]?.cnt, 0),
    unreadNotificationsCount: notifications.filter((n) => !n.isRead).length,
    notifications,
  };
}

export async function markHostNotificationsRead(user: SessionUser) {
  await dbQuery(
    `UPDATE booking_notifications
     SET is_read = TRUE
     WHERE recipient_role = 'host'
       AND booking_id IN (
         SELECT b.id FROM bookings b JOIN stays s ON s.id = b.stay_id WHERE s.host_id = $1
       )`,
    [user.id]
  );
  return { ok: true };
}

export async function getHostOverviewData(
  user: SessionUser,
  params?: { stayId?: string; range?: '7d' | '30d' | '90d' | 'all' }
) {
  const today = getTodayIsoVietnam();
  const range = params?.range ?? '30d';
  const stayFilter =
    params?.stayId && isValidUuid(params.stayId) ? params.stayId : null;

  const periodDays = range === '7d' ? 7 : range === '30d' ? 30 : range === '90d' ? 90 : 365;
  const periodStart = addDaysIso(today, -(periodDays - 1));
  const chartDays = range === '7d' ? 7 : range === '90d' ? 90 : 30;
  const chartStart = addDaysIso(today, -(chartDays - 1));

  const [staysRes, roomsRes, bookingsRes, convRes, reviewsRes, appsRes] =
    await Promise.all([
      dbQuery(
        `SELECT s.id, s.slug, s.title_en, s.title_vi, s.status, s.hero_image,
                s.is_wifi_verified, s.is_work_ready, s.verification_tier
         FROM stays s
         WHERE s.host_id = $1
         ORDER BY s.created_at DESC`,
        [user.id]
      ),
      dbQuery(
        `SELECT sr.id, sr.stay_id, sr.name_en, sr.units_total, sr.ical_url, sr.ical_sync_status
         FROM stay_rooms sr
         JOIN stays s ON s.id = sr.stay_id
         WHERE s.host_id = $1`,
        [user.id]
      ),
      dbQuery(
        `SELECT b.*, s.slug AS stay_slug, s.title_en, s.title_vi, s.hero_image,
                sr.name_en AS room_name_en, sr.name_vi AS room_name_vi,
                u.full_name AS guest_name, u.email AS guest_email, u.nationality
         FROM bookings b
         JOIN stays s ON s.id = b.stay_id
         JOIN stay_rooms sr ON sr.id = b.room_id
         JOIN users u ON u.id = b.guest_id
         WHERE s.host_id = $1
         ORDER BY b.check_in ASC`,
        [user.id]
      ),
      dbQuery(
        `SELECT c.id, c.stay_id, c.booking_id, c.last_message_preview, c.last_message_at,
                c.host_unread_count, s.title_en, s.title_vi,
                u.full_name AS guest_name
         FROM conversations c
         JOIN stays s ON s.id = c.stay_id
         JOIN users u ON u.id = c.guest_id
         WHERE c.host_id = $1
         ORDER BY c.last_message_at DESC
         LIMIT 10`,
        [user.id]
      ),
      dbQuery(
        `SELECT r.id, r.stay_id, r.rating, r.host_reply
         FROM stay_reviews r
         JOIN stays s ON s.id = r.stay_id
         WHERE s.host_id = $1`,
        [user.id]
      ),
      dbQuery(
        `SELECT id, stay_name, status, created_at
         FROM host_applications
         WHERE applicant_user_id = $1 AND status = 'submitted'
         ORDER BY created_at DESC`,
        [user.id]
      ),
    ]);

  const stays = staysRes.rows.map((s) => ({
    id: String(s.id),
    slug: String(s.slug),
    titleEn: String(s.title_en),
    titleVi: String(s.title_vi),
    status: String(s.status),
    heroImage: String(s.hero_image),
    isWifiVerified: Boolean(s.is_wifi_verified),
    isWorkReady: Boolean(s.is_work_ready),
  }));

  const filteredRooms = roomsRes.rows.filter(
    (r) => !stayFilter || String(r.stay_id) === stayFilter
  );
  const filteredBookings = bookingsRes.rows
    .filter((b) => !stayFilter || String(b.stay_id) === stayFilter)
    .map((b) => {
      const status = String(b.status);
      const unlocked = [
        'RESERVED_LOCKED',
        'CHECKED_IN_COMPLETED',
        'PENDING_HOST_APPROVAL',
        'confirmed',
        'completed',
      ].includes(status);
      return {
        id: String(b.id),
        bookingCode: String(b.booking_code),
        stayId: String(b.stay_id),
        stayTitleEn: String(b.title_en),
        stayTitleVi: String(b.title_vi),
        roomNameEn: String(b.room_name_en),
        roomNameVi: String(b.room_name_vi),
        guestName: String(b.guest_name),
        guestEmail: unlocked ? String(b.guest_email) : 'Hidden until confirmed',
        nationality: String(b.nationality),
        status,
        checkIn: toIsoDate(b.check_in),
        checkOut: toIsoDate(b.check_out),
        nights: toNum(b.nights),
        guestsCount: toNum(b.guests_count, 1),
        wholesaleTotalVnd: toNum(b.wholesale_total_vnd),
        feeOnlineVnd:
          toNum(b.booking_fee_online_vnd) > 0
            ? toNum(b.booking_fee_online_vnd)
            : toNum(b.service_fee_vnd),
        payAtCheckinVnd:
          toNum(b.pay_at_checkin_vnd) > 0
            ? toNum(b.pay_at_checkin_vnd)
            : toNum(b.wholesale_total_vnd),
        guestTotalVnd: toNum(b.guest_total_vnd),
        guestNote: String(b.guest_note ?? ''),
        createdAt: toIsoTimestamp(b.created_at),
      };
    });

  const activeStatuses = new Set([
    'RESERVED_LOCKED',
    'CHECKED_IN_COMPLETED',
    'confirmed',
    'completed',
  ]);

  const checkInsToday = filteredBookings.filter(
    (b) => b.checkIn === today && activeStatuses.has(b.status)
  );
  const checkOutsToday = filteredBookings.filter(
    (b) => b.checkOut === today && activeStatuses.has(b.status)
  );
  const pendingBookings = filteredBookings.filter(
    (b) => b.status === 'PENDING_HOST_APPROVAL' || b.status === 'PENDING_PAYMENT'
  );
  const upcomingBookings = filteredBookings
    .filter((b) => b.checkIn >= today && activeStatuses.has(b.status))
    .slice(0, 8);

  const inPeriodBookings = filteredBookings.filter((b) => {
    if (!activeStatuses.has(b.status)) return false;
    if (range === 'all') return true;
    return b.checkOut >= periodStart && b.checkIn <= today;
  });

  // Revenue earned by host = 100% of host stay rate (0% host commission)
  const periodRevenueVnd = inPeriodBookings.reduce(
    (sum, b) => sum + b.payAtCheckinVnd,
    0
  );
  const bookedNightsInPeriod = inPeriodBookings.reduce((sum, b) => {
    const overlapStart = b.checkIn > periodStart ? b.checkIn : periodStart;
    const overlapEnd = b.checkOut < addDaysIso(today, 1) ? b.checkOut : addDaysIso(today, 1);
    if (overlapEnd <= overlapStart) return sum;
    return sum + enumerateStayNights(overlapStart, overlapEnd).length;
  }, 0);

  const totalUnits = filteredRooms.reduce(
    (sum, r) => sum + Math.max(1, toNum(r.units_total, 1)),
    0
  );
  const totalAvailableNights = totalUnits * periodDays;
  const occupancyPct =
    totalAvailableNights > 0
      ? Math.min(100, Math.round((bookedNightsInPeriod / totalAvailableNights) * 1000) / 10)
      : 0;

  const filteredReviews = reviewsRes.rows.filter(
    (r) => !stayFilter || String(r.stay_id) === stayFilter
  );
  const avgRating =
    filteredReviews.length > 0
      ? Math.round(
          (filteredReviews.reduce((s, r) => s + toNum(r.rating), 0) /
            filteredReviews.length) *
            10
        ) / 10
      : null;

  const unreadConversations = convRes.rows
    .filter((c) => !stayFilter || String(c.stay_id) === stayFilter)
    .filter((c) => toNum(c.host_unread_count) > 0)
    .map((c) => ({
      id: String(c.id),
      stayTitleEn: String(c.title_en),
      stayTitleVi: String(c.title_vi),
      guestName: String(c.guest_name),
      preview: String(c.last_message_preview ?? ''),
      unreadCount: toNum(c.host_unread_count),
      lastMessageAt: toIsoTimestamp(c.last_message_at),
    }));

  // Build real chart points across the selected window
  const chartBuckets = range === '90d' ? 12 : range === '7d' ? 7 : 10;
  const daysPerBucket = Math.max(1, Math.ceil(chartDays / chartBuckets));
  const chartSeries: Array<{ label: string; revenueVnd: number; bookedNights: number }> = [];
  for (let i = 0; i < chartBuckets; i += 1) {
    const bStart = addDaysIso(chartStart, i * daysPerBucket);
    const bEnd = addDaysIso(bStart, daysPerBucket);
    if (bStart > today) break;
    let rev = 0;
    let nights = 0;
    for (const bk of filteredBookings) {
      if (!activeStatuses.has(bk.status)) continue;
      if (bk.checkIn >= bStart && bk.checkIn < bEnd) {
        rev += bk.payAtCheckinVnd;
      }
      const ovStart = bk.checkIn > bStart ? bk.checkIn : bStart;
      const ovEnd = bk.checkOut < bEnd ? bk.checkOut : bEnd;
      if (ovEnd > ovStart) {
        nights += enumerateStayNights(ovStart, ovEnd).length;
      }
    }
    chartSeries.push({
      label: bStart.slice(5),
      revenueVnd: rev,
      bookedNights: nights,
    });
  }

  // Actionable operational alerts derived purely from real DB state
  const alerts: Array<{
    id: string;
    severity: 'warning' | 'info';
    titleEn: string;
    titleVi: string;
    href: string;
  }> = [];

  for (const rm of filteredRooms) {
    const syncStatus = String(rm.ical_sync_status ?? 'idle');
    if (syncStatus.startsWith('error')) {
      alerts.push({
        id: `ical-${rm.id}`,
        severity: 'warning',
        titleEn: `iCal sync issue on ${rm.name_en} — check calendar feed`,
        titleVi: `Lỗi đồng bộ iCal tại phòng ${rm.name_en} — cần kiểm tra lại link`,
        href: '/host/calendar',
      });
    }
  }
  const unrepliedReviews = filteredReviews.filter((r) => !r.host_reply).length;
  if (unrepliedReviews > 0) {
    alerts.push({
      id: 'reviews-unreplied',
      severity: 'info',
      titleEn: `${unrepliedReviews} guest review(s) awaiting your reply`,
      titleVi: `${unrepliedReviews} đánh giá của khách đang chờ bạn phản hồi`,
      href: '/host/reviews',
    });
  }
  for (const app of appsRes.rows) {
    alerts.push({
      id: `app-${app.id}`,
      severity: 'info',
      titleEn: `New listing "${app.stay_name}" is pending moderation`,
      titleVi: `Hồ sơ cơ sở "${app.stay_name}" đang chờ duyệt đăng`,
      href: '/host/listings',
    });
  }

  return {
    today,
    range,
    stays,
    kpis: {
      periodRevenueVnd,
      occupancyPct,
      bookedNights: bookedNightsInPeriod,
      avgRating,
      reviewsCount: filteredReviews.length,
    },
    operations: {
      checkInsToday,
      checkOutsToday,
      pendingBookings,
      unreadConversations,
      alerts,
    },
    upcomingBookings,
    chartSeries,
  };
}

export async function getHostCalendarData(
  user: SessionUser,
  params?: { startDate?: string; days?: number; stayId?: string; roomId?: string }
) {
  const today = getTodayIsoVietnam();
  const startDate =
    params?.startDate && isValidIsoDate(params.startDate)
      ? params.startDate
      : today.slice(0, 8) + '01';
  const days = Math.max(14, Math.min(62, params?.days ?? 35));
  const endDate = addDaysIso(startDate, days);
  const stayFilter =
    params?.stayId && isValidUuid(params.stayId) ? params.stayId : null;

  const [staysRes, roomsRes, locksRes, bookingsRes] = await Promise.all([
    dbQuery(
      `SELECT id, slug, title_en, title_vi, default_min_nights, is_instant_book, status
       FROM stays WHERE host_id = $1 ORDER BY created_at DESC`,
      [user.id]
    ),
    dbQuery(
      `SELECT sr.*, s.title_en AS stay_title_en, s.title_vi AS stay_title_vi,
              s.default_min_nights,
              p.id AS package_id, p.wholesale_7_vnd, p.wholesale_14_vnd,
              p.wholesale_21_vnd, p.wholesale_30_vnd, p.extra_night_vnd
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
       ORDER BY s.created_at DESC, sr.max_guests ASC`,
      [user.id]
    ),
    dbQuery(
      `SELECT rnl.*
       FROM room_night_locks rnl
       JOIN stay_rooms sr ON sr.id = rnl.room_id
       JOIN stays s ON s.id = sr.stay_id
       WHERE s.host_id = $1 AND rnl.stay_date >= $2::date AND rnl.stay_date < $3::date`,
      [user.id, startDate, endDate]
    ),
    dbQuery(
      `SELECT b.id, b.booking_code, b.stay_id, b.room_id, b.status,
              b.check_in, b.check_out, b.nights, b.guests_count,
              b.pay_at_checkin_vnd, b.wholesale_total_vnd, b.booking_fee_online_vnd,
              b.guest_note, u.full_name AS guest_name, u.email AS guest_email
       FROM bookings b
       JOIN stays s ON s.id = b.stay_id
       JOIN users u ON u.id = b.guest_id
       WHERE s.host_id = $1
         AND b.status IN ('PENDING_PAYMENT', 'PENDING_HOST_APPROVAL', 'RESERVED_LOCKED', 'CHECKED_IN_COMPLETED', 'confirmed', 'completed')
         AND b.check_out > $2::date
         AND b.check_in < $3::date
       ORDER BY b.check_in ASC`,
      [user.id, startDate, endDate]
    ),
  ]);

  const rooms = roomsRes.rows
    .filter((r) => !stayFilter || String(r.stay_id) === stayFilter)
    .map((r) => ({
      id: String(r.id),
      stayId: String(r.stay_id),
      stayTitleEn: String(r.stay_title_en),
      stayTitleVi: String(r.stay_title_vi),
      nameEn: String(r.name_en),
      nameVi: String(r.name_vi),
      unitsTotal: Math.max(1, toNum(r.units_total, 1)),
      defaultMinNights: Math.max(7, toNum(r.default_min_nights, 7)),
      icalUrl: r.ical_url ? String(r.ical_url) : '',
      icalLastSyncedAt: r.ical_last_synced_at
        ? toIsoTimestamp(r.ical_last_synced_at)
        : null,
      icalSyncStatus: String(r.ical_sync_status ?? 'idle'),
      wholesale7Vnd: toNum(r.wholesale_7_vnd, 0),
      wholesale14Vnd: toNum(r.wholesale_14_vnd, 0),
      wholesale21Vnd: toNum(r.wholesale_21_vnd, 0),
      wholesale30Vnd: toNum(r.wholesale_30_vnd, 0),
      extraNightVnd: toNum(r.extra_night_vnd, 0),
    }));

  const locks = locksRes.rows.map((l) => ({
    roomId: String(l.room_id),
    stayDate: toIsoDate(l.stay_date),
    bookedUnits: toNum(l.booked_units, 0),
    blockedUnits: toNum(l.blocked_units, 0),
    customNightlyVnd:
      l.custom_nightly_vnd !== null && l.custom_nightly_vnd !== undefined
        ? toNum(l.custom_nightly_vnd)
        : null,
    minNights:
      l.min_nights !== null && l.min_nights !== undefined
        ? toNum(l.min_nights)
        : null,
    note: String(l.note ?? ''),
  }));

  const bookings = bookingsRes.rows
    .filter((b) => !stayFilter || String(b.stay_id) === stayFilter)
    .map((b) => ({
      id: String(b.id),
      bookingCode: String(b.booking_code),
      stayId: String(b.stay_id),
      roomId: String(b.room_id),
      status: String(b.status),
      checkIn: toIsoDate(b.check_in),
      checkOut: toIsoDate(b.check_out),
      nights: toNum(b.nights),
      guestsCount: toNum(b.guests_count, 1),
      guestName: String(b.guest_name),
      guestEmail: String(b.guest_email),
      payAtCheckinVnd:
        toNum(b.pay_at_checkin_vnd) > 0
          ? toNum(b.pay_at_checkin_vnd)
          : toNum(b.wholesale_total_vnd),
      feeOnlineVnd: toNum(b.booking_fee_online_vnd),
      guestNote: String(b.guest_note ?? ''),
    }));

  return {
    startDate,
    endDate,
    days,
    stays: staysRes.rows.map((s) => ({
      id: String(s.id),
      slug: String(s.slug),
      titleEn: String(s.title_en),
      titleVi: String(s.title_vi),
      defaultMinNights: Math.max(7, toNum(s.default_min_nights, 7)),
      isInstantBook: Boolean(s.is_instant_book),
      status: String(s.status),
    })),
    rooms,
    locks,
    bookings,
  };
}

export async function updateHostCalendarRange(
  user: SessionUser,
  input: {
    roomId: string;
    startDate: string;
    endDate: string; // inclusive
    block?: boolean;
    customNightlyVnd?: number | null;
    minNights?: number | null;
    note?: string;
  }
) {
  if (
    !isValidUuid(input.roomId) ||
    !isValidIsoDate(input.startDate) ||
    !isValidIsoDate(input.endDate)
  ) {
    throw new AppError('VALIDATION_ERROR', 'Valid room ID and YYYY-MM-DD range required.');
  }
  if (input.endDate < input.startDate) {
    throw new AppError('VALIDATION_ERROR', 'End date must be on or after start date.');
  }
  const dates = enumerateStayNights(input.startDate, addDaysIso(input.endDate, 1));
  if (dates.length === 0 || dates.length > 90) {
    throw new AppError('VALIDATION_ERROR', 'Calendar range must be between 1 and 90 days.');
  }

  return dbTransaction(async (tx) => {
    const ownerRes = await tx.query<{ host_id: string; units_total: number }>(
      `SELECT s.host_id, sr.units_total
       FROM stay_rooms sr
       JOIN stays s ON s.id = sr.stay_id
       WHERE sr.id = $1`,
      [input.roomId]
    );
    const rm = ownerRes.rows[0];
    if (!rm) throw new AppError('NOT_FOUND', 'Room not found.');
    if (rm.host_id !== user.id && user.role !== 'admin') {
      throw new AppError('FORBIDDEN', 'Not your property room.');
    }
    const unitsTotal = Math.max(1, toNum(rm.units_total, 1));

    for (const dt of dates) {
      await tx.query(
        `INSERT INTO room_night_locks (id, room_id, stay_date, booked_units, blocked_units)
         VALUES ($1, $2, $3::date, 0, 0)
         ON CONFLICT (room_id, stay_date) DO NOTHING`,
        [crypto.randomUUID(), input.roomId, dt]
      );

      const lockRes = await tx.query<{
        id: string;
        booked_units: number;
        blocked_units: number;
        custom_nightly_vnd: string | number | null;
        min_nights: number | null;
        note: string | null;
      }>(
        `SELECT id, booked_units, blocked_units, custom_nightly_vnd, min_nights, note
         FROM room_night_locks
         WHERE room_id = $1 AND stay_date = $2::date
         FOR UPDATE`,
        [input.roomId, dt]
      );
      const lock = lockRes.rows[0];
      const booked = toNum(lock.booked_units, 0);

      let nextBlocked = toNum(lock.blocked_units, 0);
      if (input.block === true) {
        if (booked >= unitsTotal) {
          throw new AppError(
            'CONFLICT',
            `Cannot block ${dt} because all units are already booked by guests.`
          );
        }
        nextBlocked = Math.max(1, unitsTotal - booked);
      } else if (input.block === false) {
        nextBlocked = 0;
      }

      const nextCustomPrice =
        input.customNightlyVnd === undefined
          ? lock.custom_nightly_vnd
          : input.customNightlyVnd === null || input.customNightlyVnd <= 0
            ? null
            : Math.round(input.customNightlyVnd);

      const nextMinNights =
        input.minNights === undefined
          ? lock.min_nights
          : input.minNights === null
            ? null
            : Math.max(7, Math.min(90, Math.round(input.minNights)));

      const nextNote =
        input.note === undefined ? String(lock.note ?? '') : input.note.trim().slice(0, 120);

      await tx.query(
        `UPDATE room_night_locks
         SET blocked_units = $1,
             custom_nightly_vnd = $2,
             min_nights = $3,
             note = $4
         WHERE id = $5`,
        [nextBlocked, nextCustomPrice, nextMinNights, nextNote, lock.id]
      );
    }

    return { ok: true, updatedDays: dates.length };
  });
}

export async function generateRoomIcalExport(user: SessionUser, roomId: string) {
  if (!isValidUuid(roomId)) throw new AppError('VALIDATION_ERROR', 'Invalid room ID.');
  const roomRes = await dbQuery<{
    id: string;
    host_id: string;
    stay_title: string;
    room_name: string;
    units_total: number;
  }>(
    `SELECT sr.id, s.host_id, s.title_en AS stay_title, sr.name_en AS room_name, sr.units_total
     FROM stay_rooms sr
     JOIN stays s ON s.id = sr.stay_id
     WHERE sr.id = $1`,
    [roomId]
  );
  const rm = roomRes.rows[0];
  if (!rm) throw new AppError('NOT_FOUND', 'Room not found.');
  if (rm.host_id !== user.id && user.role !== 'admin') {
    throw new AppError('FORBIDDEN', 'Not your property room.');
  }

  const [bookingsRes, blocksRes] = await Promise.all([
    dbQuery<{
      id: string;
      booking_code: string;
      check_in: string | Date;
      check_out: string | Date;
      status: string;
    }>(
      `SELECT id, booking_code, check_in, check_out, status
       FROM bookings
       WHERE room_id = $1
         AND status IN ('PENDING_HOST_APPROVAL', 'RESERVED_LOCKED', 'CHECKED_IN_COMPLETED', 'confirmed', 'completed')`,
      [roomId]
    ),
    dbQuery<{ stay_date: string | Date; blocked_units: number }>(
      `SELECT stay_date, blocked_units
       FROM room_night_locks
       WHERE room_id = $1 AND blocked_units > 0 AND stay_date >= $2::date
       ORDER BY stay_date ASC`,
      [roomId, getTodayIsoVietnam()]
    ),
  ]);

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//VietNomad Stays//Host Calendar//EN',
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${rm.stay_title} - ${rm.room_name}`,
  ];

  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  for (const b of bookingsRes.rows) {
    const dtStart = toIsoDate(b.check_in).replace(/-/g, '');
    const dtEnd = toIsoDate(b.check_out).replace(/-/g, '');
    lines.push(
      'BEGIN:VEVENT',
      `UID:booking-${b.id}@vietnomad.stays`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${dtStart}`,
      `DTEND;VALUE=DATE:${dtEnd}`,
      `SUMMARY:Reserved (${b.booking_code})`,
      'END:VEVENT'
    );
  }

  for (const blk of blocksRes.rows) {
    const dt = toIsoDate(blk.stay_date);
    const dtStart = dt.replace(/-/g, '');
    const dtEnd = addDaysIso(dt, 1).replace(/-/g, '');
    lines.push(
      'BEGIN:VEVENT',
      `UID:block-${roomId}-${dtStart}@vietnomad.stays`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${dtStart}`,
      `DTEND;VALUE=DATE:${dtEnd}`,
      'SUMMARY:Host Blocked',
      'END:VEVENT'
    );
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export async function getHostReservationsData(
  user: SessionUser,
  filters?: {
    status?: string;
    stayId?: string;
    q?: string;
  }
) {
  const today = getTodayIsoVietnam();
  const [staysRes, bookingsRes, eventsRes, convRes] = await Promise.all([
    dbQuery(
      `SELECT id, title_en, title_vi FROM stays WHERE host_id = $1 ORDER BY created_at DESC`,
      [user.id]
    ),
    dbQuery(
      `SELECT b.*, s.title_en, s.title_vi, s.slug AS stay_slug, s.hero_image,
              sr.name_en AS room_name_en, sr.name_vi AS room_name_vi,
              u.full_name AS guest_name, u.email AS guest_email, u.nationality, u.phone AS guest_phone
       FROM bookings b
       JOIN stays s ON s.id = b.stay_id
       JOIN stay_rooms sr ON sr.id = b.room_id
       JOIN users u ON u.id = b.guest_id
       WHERE s.host_id = $1
       ORDER BY b.created_at DESC`,
      [user.id]
    ),
    dbQuery(
      `SELECT be.*
       FROM booking_events be
       JOIN bookings b ON b.id = be.booking_id
       JOIN stays s ON s.id = b.stay_id
       WHERE s.host_id = $1
       ORDER BY be.created_at ASC`,
      [user.id]
    ),
    dbQuery(
      `SELECT id, booking_id, stay_id, guest_id FROM conversations WHERE host_id = $1`,
      [user.id]
    ),
  ]);

  const eventsByBooking = new Map<
    string,
    Array<{
      id: string;
      actorRole: string;
      eventType: string;
      summary: string;
      createdAt: string;
    }>
  >();
  for (const ev of eventsRes.rows) {
    const bid = String(ev.booking_id);
    const list = eventsByBooking.get(bid) ?? [];
    list.push({
      id: String(ev.id),
      actorRole: String(ev.actor_role),
      eventType: String(ev.event_type),
      summary: String(ev.summary),
      createdAt: toIsoTimestamp(ev.created_at),
    });
    eventsByBooking.set(bid, list);
  }

  const convByBooking = new Map<string, string>();
  const convByStayGuest = new Map<string, string>();
  for (const c of convRes.rows) {
    if (c.booking_id) convByBooking.set(String(c.booking_id), String(c.id));
    convByStayGuest.set(`${c.stay_id}:${c.guest_id}`, String(c.id));
  }

  const all = bookingsRes.rows.map((b) => {
    const status = String(b.status);
    const checkIn = toIsoDate(b.check_in);
    const checkOut = toIsoDate(b.check_out);
    const unlocked = [
      'PENDING_HOST_APPROVAL',
      'RESERVED_LOCKED',
      'CHECKED_IN_COMPLETED',
      'confirmed',
      'completed',
    ].includes(status);
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
      stayId: String(b.stay_id),
      staySlug: String(b.stay_slug),
      stayTitleEn: String(b.title_en),
      stayTitleVi: String(b.title_vi),
      stayImage: String(b.hero_image),
      roomNameEn: String(b.room_name_en),
      roomNameVi: String(b.room_name_vi),
      guestId: String(b.guest_id),
      guestName: String(b.guest_name),
      guestEmail: unlocked ? String(b.guest_email) : 'Hidden until fee locked',
      guestPhone: unlocked && b.guest_phone ? String(b.guest_phone) : '',
      nationality: String(b.nationality),
      status,
      checkIn,
      checkOut,
      nights: toNum(b.nights),
      guestsCount: toNum(b.guests_count, 1),
      wholesaleTotalVnd: toNum(b.wholesale_total_vnd),
      feeOnlineVnd,
      payAtCheckinVnd,
      guestTotalVnd: toNum(b.guest_total_vnd),
      refundAmountVnd: toNum(b.refund_amount_vnd),
      cancellationPolicy: String(b.cancellation_policy),
      guestNote: String(b.guest_note ?? ''),
      hostInternalNote: String(b.host_internal_note ?? ''),
      paymentProvider: String(b.payment_provider ?? 'sandbox'),
      paidAt: b.paid_at ? toIsoTimestamp(b.paid_at) : null,
      createdAt: toIsoTimestamp(b.created_at),
      conversationId:
        convByBooking.get(String(b.id)) ??
        convByStayGuest.get(`${b.stay_id}:${b.guest_id}`) ??
        null,
      events: eventsByBooking.get(String(b.id)) ?? [],
    };
  });

  const statusFilter = filters?.status ?? 'all';
  const stayFilter =
    filters?.stayId && isValidUuid(filters.stayId) ? filters.stayId : null;
  const query = (filters?.q ?? '').trim().toLowerCase();

  const matchesCategory = (b: (typeof all)[number], cat: string) => {
    if (cat === 'all') return true;
    if (cat === 'pending') {
      return b.status === 'PENDING_HOST_APPROVAL' || b.status === 'PENDING_PAYMENT';
    }
    if (cat === 'confirmed') {
      return b.status === 'RESERVED_LOCKED' || b.status === 'confirmed';
    }
    if (cat === 'upcoming') {
      return (
        (b.status === 'RESERVED_LOCKED' || b.status === 'confirmed') &&
        b.checkIn > today
      );
    }
    if (cat === 'in_house') {
      return (
        (b.status === 'RESERVED_LOCKED' ||
          b.status === 'confirmed' ||
          b.status === 'CHECKED_IN_COMPLETED') &&
        b.checkIn <= today &&
        b.checkOut > today
      );
    }
    if (cat === 'completed') {
      return (
        b.status === 'CHECKED_IN_COMPLETED' ||
        b.status === 'completed' ||
        ((b.status === 'RESERVED_LOCKED' || b.status === 'confirmed') &&
          b.checkOut <= today)
      );
    }
    if (cat === 'cancelled') {
      return b.status === 'cancelled' || b.status === 'REFUNDED_WIFI_MISMATCH';
    }
    return true;
  };

  const counts = {
    all: all.length,
    pending: all.filter((b) => matchesCategory(b, 'pending')).length,
    confirmed: all.filter((b) => matchesCategory(b, 'confirmed')).length,
    upcoming: all.filter((b) => matchesCategory(b, 'upcoming')).length,
    in_house: all.filter((b) => matchesCategory(b, 'in_house')).length,
    completed: all.filter((b) => matchesCategory(b, 'completed')).length,
    cancelled: all.filter((b) => matchesCategory(b, 'cancelled')).length,
  };

  const reservations = all.filter((b) => {
    if (stayFilter && b.stayId !== stayFilter) return false;
    if (!matchesCategory(b, statusFilter)) return false;
    if (query) {
      const hay = `${b.bookingCode} ${b.guestName} ${b.guestEmail} ${b.stayTitleEn} ${b.stayTitleVi}`.toLowerCase();
      if (!hay.includes(query)) return false;
    }
    return true;
  });

  return {
    today,
    stays: staysRes.rows.map((s) => ({
      id: String(s.id),
      titleEn: String(s.title_en),
      titleVi: String(s.title_vi),
    })),
    counts,
    reservations,
  };
}

export async function getHostEarningsData(
  user: SessionUser,
  filters?: { stayId?: string; from?: string; to?: string }
) {
  const today = getTodayIsoVietnam();
  const stayFilter =
    filters?.stayId && isValidUuid(filters.stayId) ? filters.stayId : null;
  const fromIso = filters?.from && isValidIsoDate(filters.from) ? filters.from : null;
  const toIso = filters?.to && isValidIsoDate(filters.to) ? filters.to : null;

  const [staysRes, bookingsRes, adjustmentsRes] = await Promise.all([
    dbQuery(
      `SELECT id, title_en, title_vi FROM stays WHERE host_id = $1 ORDER BY created_at DESC`,
      [user.id]
    ),
    dbQuery(
      `SELECT b.*, s.title_en, s.title_vi
       FROM bookings b
       JOIN stays s ON s.id = b.stay_id
       WHERE s.host_id = $1
       ORDER BY b.check_in DESC`,
      [user.id]
    ),
    dbQuery(
      `SELECT ba.*, b.booking_code, s.title_en, s.title_vi
       FROM booking_adjustments ba
       JOIN bookings b ON b.id = ba.booking_id
       JOIN stays s ON s.id = ba.stay_id
       WHERE ba.host_id = $1
       ORDER BY ba.created_at DESC`,
      [user.id]
    ),
  ]);

  const stayFilteredBookings = bookingsRes.rows
    .filter((b) => !stayFilter || String(b.stay_id) === stayFilter)
    .filter((b) => {
      const ci = toIsoDate(b.check_in);
      if (fromIso && ci < fromIso) return false;
      if (toIso && ci > toIso) return false;
      return true;
    })
    .map((b) => {
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
        stayId: String(b.stay_id),
        stayTitleEn: String(b.title_en),
        stayTitleVi: String(b.title_vi),
        status: String(b.status),
        checkIn: toIsoDate(b.check_in),
        checkOut: toIsoDate(b.check_out),
        nights: toNum(b.nights),
        guestTotalVnd: toNum(b.guest_total_vnd),
        feeOnlineVnd,
        hostNetVnd: payAtCheckinVnd,
        hostCommissionVnd: 0,
        refundAmountVnd: toNum(b.refund_amount_vnd),
        createdAt: toIsoTimestamp(b.created_at),
      };
    });

  const activeBookings = stayFilteredBookings.filter((b) =>
    ['RESERVED_LOCKED', 'CHECKED_IN_COMPLETED', 'confirmed', 'completed'].includes(
      b.status
    )
  );
  const collectedBookings = activeBookings.filter((b) =>
    ['CHECKED_IN_COMPLETED', 'completed'].includes(b.status)
  );
  const pendingBookings = activeBookings.filter((b) =>
    ['RESERVED_LOCKED', 'confirmed'].includes(b.status)
  );

  const adjustments = adjustmentsRes.rows
    .filter((a) => !stayFilter || String(a.stay_id) === stayFilter)
    .map((a) => ({
      id: String(a.id),
      bookingCode: String(a.booking_code),
      stayTitleEn: String(a.title_en),
      stayTitleVi: String(a.title_vi),
      adjustmentType: String(a.adjustment_type),
      amountVnd: toNum(a.amount_vnd),
      reason: String(a.reason ?? ''),
      status: String(a.status),
      createdAt: toIsoTimestamp(a.created_at),
    }));

  const adjustmentsNetVnd = adjustments
    .filter((a) => a.status === 'applied')
    .reduce(
      (sum, a) =>
        a.adjustmentType === 'refund' || a.adjustmentType === 'discount'
          ? sum - a.amountVnd
          : sum + a.amountVnd,
      0
    );

  const guestTotalAllVnd = activeBookings.reduce((s, b) => s + b.guestTotalVnd, 0);
  const platformFeeTotalVnd = activeBookings.reduce((s, b) => s + b.feeOnlineVnd, 0);
  const hostGrossEarnedVnd = activeBookings.reduce((s, b) => s + b.hostNetVnd, 0);
  const hostCollectedVnd = collectedBookings.reduce((s, b) => s + b.hostNetVnd, 0);
  const hostPendingVnd = pendingBookings.reduce((s, b) => s + b.hostNetVnd, 0);

  const stayBreakdownMap = new Map<
    string,
    {
      stayId: string;
      stayTitleEn: string;
      stayTitleVi: string;
      bookingsCount: number;
      nightsCount: number;
      hostNetVnd: number;
      collectedVnd: number;
      pendingVnd: number;
    }
  >();

  for (const s of staysRes.rows) {
    if (stayFilter && String(s.id) !== stayFilter) continue;
    stayBreakdownMap.set(String(s.id), {
      stayId: String(s.id),
      stayTitleEn: String(s.title_en),
      stayTitleVi: String(s.title_vi),
      bookingsCount: 0,
      nightsCount: 0,
      hostNetVnd: 0,
      collectedVnd: 0,
      pendingVnd: 0,
    });
  }
  for (const b of activeBookings) {
    const row = stayBreakdownMap.get(b.stayId);
    if (!row) continue;
    row.bookingsCount += 1;
    row.nightsCount += b.nights;
    row.hostNetVnd += b.hostNetVnd;
    if (b.status === 'CHECKED_IN_COMPLETED' || b.status === 'completed') {
      row.collectedVnd += b.hostNetVnd;
    } else {
      row.pendingVnd += b.hostNetVnd;
    }
  }

  const upcomingSchedule = pendingBookings
    .filter((b) => b.checkIn >= today)
    .sort((a, b) => a.checkIn.localeCompare(b.checkIn));

  return {
    stays: staysRes.rows.map((s) => ({
      id: String(s.id),
      titleEn: String(s.title_en),
      titleVi: String(s.title_vi),
    })),
    summary: {
      guestTotalAllVnd,
      platformFeeTotalVnd,
      hostGrossEarnedVnd,
      hostCollectedVnd,
      hostPendingVnd,
      adjustmentsNetVnd,
    },
    upcomingSchedule,
    byStay: Array.from(stayBreakdownMap.values()),
    transactions: stayFilteredBookings,
    adjustments,
  };
}

export async function exportHostEarningsCsv(
  user: SessionUser,
  filters?: { stayId?: string; from?: string; to?: string }
): Promise<string> {
  const data = await getHostEarningsData(user, filters);
  const escapeCsv = (val: string | number) => {
    const str = String(val ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const header = [
    'Booking Code',
    'Property',
    'Check-in',
    'Check-out',
    'Nights',
    'Status',
    'Guest Total (VND)',
    'VietNomad Online Service Fee (VND)',
    'Host Commission (VND)',
    'Host Net Payout 100% (VND)',
    'Refunded Fee (VND)',
  ];

  const rows = data.transactions.map((t) =>
    [
      t.bookingCode,
      t.stayTitleEn,
      t.checkIn,
      t.checkOut,
      t.nights,
      t.status,
      t.guestTotalVnd,
      t.feeOnlineVnd,
      0,
      t.hostNetVnd,
      t.refundAmountVnd,
    ]
      .map(escapeCsv)
      .join(',')
  );

  // UTF-8 BOM for direct Microsoft Excel compatibility with Vietnamese characters
  return '\uFEFF' + [header.map(escapeCsv).join(','), ...rows].join('\r\n');
}

export async function getHostReviewsData(
  user: SessionUser,
  filters?: { stayId?: string; minRating?: number; replyFilter?: 'all' | 'unreplied' | 'replied' }
) {
  const [staysRes, reviewsRes] = await Promise.all([
    dbQuery(
      `SELECT id, title_en, title_vi FROM stays WHERE host_id = $1 ORDER BY created_at DESC`,
      [user.id]
    ),
    dbQuery(
      `SELECT r.*, s.title_en, s.title_vi, s.hero_image, u.full_name AS guest_name,
              b.booking_code
       FROM stay_reviews r
       JOIN stays s ON s.id = r.stay_id
       JOIN users u ON u.id = r.guest_id
       LEFT JOIN bookings b ON b.id = r.booking_id
       WHERE s.host_id = $1
       ORDER BY r.created_at DESC`,
      [user.id]
    ),
  ]);

  const stayFilter =
    filters?.stayId && isValidUuid(filters.stayId) ? filters.stayId : null;

  const allReviews = reviewsRes.rows.map((r) => ({
    id: String(r.id),
    stayId: String(r.stay_id),
    stayTitleEn: String(r.title_en),
    stayTitleVi: String(r.title_vi),
    guestName: String(r.guest_name),
    bookingCode: r.booking_code ? String(r.booking_code) : null,
    rating: toNum(r.rating),
    cleanlinessRating: toNum(r.cleanliness_rating),
    communicationRating: toNum(r.communication_rating),
    workspaceRating: toNum(r.workspace_rating),
    locationRating: toNum(r.location_rating),
    comment: String(r.comment),
    hostReply: r.host_reply ? String(r.host_reply) : null,
    hostRepliedAt: r.host_replied_at ? toIsoTimestamp(r.host_replied_at) : null,
    createdAt: toIsoTimestamp(r.created_at),
  }));

  const stayScoped = stayFilter
    ? allReviews.filter((r) => r.stayId === stayFilter)
    : allReviews;

  const avgRating =
    stayScoped.length > 0
      ? Math.round(
          (stayScoped.reduce((s, r) => s + r.rating, 0) / stayScoped.length) * 10
        ) / 10
      : null;

  const filtered = stayScoped.filter((r) => {
    if (filters?.minRating && r.rating < filters.minRating) return false;
    if (filters?.replyFilter === 'unreplied' && r.hostReply) return false;
    if (filters?.replyFilter === 'replied' && !r.hostReply) return false;
    return true;
  });

  return {
    stays: staysRes.rows.map((s) => ({
      id: String(s.id),
      titleEn: String(s.title_en),
      titleVi: String(s.title_vi),
    })),
    summary: {
      totalCount: stayScoped.length,
      unrepliedCount: stayScoped.filter((r) => !r.hostReply).length,
      avgRating,
    },
    reviews: filtered,
  };
}

export async function replyToStayReview(
  user: SessionUser,
  reviewId: string,
  reply: string
) {
  if (!isValidUuid(reviewId)) throw new AppError('VALIDATION_ERROR', 'Invalid review ID.');
  const cleanReply = reply.trim();
  if (cleanReply.length < 2) {
    throw new AppError('VALIDATION_ERROR', 'Please enter a reply.');
  }

  const res = await dbQuery<{ id: string; host_id: string }>(
    `SELECT r.id, s.host_id
     FROM stay_reviews r
     JOIN stays s ON s.id = r.stay_id
     WHERE r.id = $1`,
    [reviewId]
  );
  const row = res.rows[0];
  if (!row) throw new AppError('NOT_FOUND', 'Review not found.');
  if (row.host_id !== user.id && user.role !== 'admin') {
    throw new AppError('FORBIDDEN', 'Only the property host can reply to this review.');
  }

  await dbQuery(
    `UPDATE stay_reviews SET host_reply = $1, host_replied_at = NOW() WHERE id = $2`,
    [cleanReply.slice(0, 2000), reviewId]
  );

  return { ok: true };
}

export async function recordStayView(
  stayIdOrSlug: string,
  sessionKey: string,
  viewerUserId?: string | null
) {
  const stayRes = await dbQuery<{ id: string }>(
    isValidUuid(stayIdOrSlug)
      ? 'SELECT id FROM stays WHERE id = $1'
      : 'SELECT id FROM stays WHERE slug = $1',
    [stayIdOrSlug]
  );
  const stay = stayRes.rows[0];
  if (!stay) return { ok: false };

  const cleanSession = sessionKey.trim().slice(0, 80) || 'anon';
  // Prevent spam counting within the last hour for the same session & stay
  const recentRes = await dbQuery<{ id: string }>(
    `SELECT id FROM stay_view_events
     WHERE stay_id = $1 AND session_key = $2 AND created_at > NOW() - INTERVAL '1 hour'
     LIMIT 1`,
    [stay.id, cleanSession]
  );
  if (recentRes.rows.length > 0) return { ok: true, deduplicated: true };

  await dbQuery(
    `INSERT INTO stay_view_events (id, stay_id, session_key, viewer_user_id)
     VALUES ($1, $2, $3, $4)`,
    [crypto.randomUUID(), stay.id, cleanSession, viewerUserId ?? null]
  );
  return { ok: true, deduplicated: false };
}

export async function getHostInsightsData(
  user: SessionUser,
  params?: { stayId?: string; range?: '7d' | '30d' | '90d' | 'all' }
) {
  const today = getTodayIsoVietnam();
  const range = params?.range ?? '30d';
  const stayFilter =
    params?.stayId && isValidUuid(params.stayId) ? params.stayId : null;
  const periodDays = range === '7d' ? 7 : range === '30d' ? 30 : range === '90d' ? 90 : 365;
  const periodStart = addDaysIso(today, -(periodDays - 1));

  const [staysRes, roomsRes, bookingsRes, viewsRes, messagesRes] = await Promise.all([
    dbQuery(
      `SELECT id, slug, title_en, title_vi, status FROM stays WHERE host_id = $1 ORDER BY created_at DESC`,
      [user.id]
    ),
    dbQuery(
      `SELECT sr.id, sr.stay_id, sr.units_total
       FROM stay_rooms sr
       JOIN stays s ON s.id = sr.stay_id
       WHERE s.host_id = $1`,
      [user.id]
    ),
    dbQuery(
      `SELECT b.id, b.stay_id, b.status, b.check_in, b.check_out, b.nights,
              b.wholesale_total_vnd, b.pay_at_checkin_vnd, b.created_at
       FROM bookings b
       JOIN stays s ON s.id = b.stay_id
       WHERE s.host_id = $1`,
      [user.id]
    ),
    dbQuery(
      `SELECT v.stay_id, v.created_at
       FROM stay_view_events v
       JOIN stays s ON s.id = v.stay_id
       WHERE s.host_id = $1`,
      [user.id]
    ),
    dbQuery(
      `SELECT m.conversation_id, m.sender_role, m.created_at
       FROM messages m
       JOIN conversations c ON c.id = m.conversation_id
       WHERE c.host_id = $1
       ORDER BY m.conversation_id, m.created_at ASC`,
      [user.id]
    ),
  ]);

  const stays = staysRes.rows.map((s) => ({
    id: String(s.id),
    slug: String(s.slug),
    titleEn: String(s.title_en),
    titleVi: String(s.title_vi),
    status: String(s.status),
  }));

  const scopedRooms = roomsRes.rows.filter(
    (r) => !stayFilter || String(r.stay_id) === stayFilter
  );
  const totalUnits = scopedRooms.reduce(
    (sum, r) => sum + Math.max(1, toNum(r.units_total, 1)),
    0
  );
  const availableRoomNights = totalUnits * periodDays;

  const scopedViews = viewsRes.rows.filter((v) => {
    if (stayFilter && String(v.stay_id) !== stayFilter) return false;
    if (range === 'all') return true;
    return toIsoDate(v.created_at) >= periodStart;
  });

  const scopedBookings = bookingsRes.rows
    .filter((b) => !stayFilter || String(b.stay_id) === stayFilter)
    .filter((b) => {
      if (range === 'all') return true;
      return toIsoDate(b.created_at) >= periodStart || toIsoDate(b.check_in) >= periodStart;
    });

  const confirmedStatuses = new Set([
    'RESERVED_LOCKED',
    'CHECKED_IN_COMPLETED',
    'confirmed',
    'completed',
  ]);

  const confirmedBookings = scopedBookings.filter((b) =>
    confirmedStatuses.has(String(b.status))
  );
  const cancelledBookings = scopedBookings.filter((b) =>
    ['cancelled', 'REFUNDED_WIFI_MISMATCH'].includes(String(b.status))
  );

  const viewsCount = scopedViews.length;
  const confirmedCount = confirmedBookings.length;
  const conversionRatePct =
    viewsCount > 0 ? Math.round((confirmedCount / viewsCount) * 1000) / 10 : 0;

  const bookedNights = confirmedBookings.reduce((sum, b) => sum + toNum(b.nights), 0);
  const totalRoomRevenueVnd = confirmedBookings.reduce((sum, b) => {
    const net =
      toNum(b.pay_at_checkin_vnd) > 0
        ? toNum(b.pay_at_checkin_vnd)
        : toNum(b.wholesale_total_vnd);
    return sum + net;
  }, 0);

  const occupancyRatePct =
    availableRoomNights > 0
      ? Math.min(100, Math.round((bookedNights / availableRoomNights) * 1000) / 10)
      : 0;
  const avgLengthOfStay =
    confirmedCount > 0 ? Math.round((bookedNights / confirmedCount) * 10) / 10 : 0;
  const adrVnd = bookedNights > 0 ? Math.round(totalRoomRevenueVnd / bookedNights) : 0;
  const revParVnd =
    availableRoomNights > 0 ? Math.round(totalRoomRevenueVnd / availableRoomNights) : 0;

  const totalNonPending = confirmedCount + cancelledBookings.length;
  const cancellationRatePct =
    totalNonPending > 0
      ? Math.round((cancelledBookings.length / totalNonPending) * 1000) / 10
      : 0;

  // Compute average host response time in minutes from real conversations
  const responseMinutesList: number[] = [];
  const byConv = new Map<string, Array<{ role: string; ts: number }>>();
  for (const m of messagesRes.rows) {
    const cid = String(m.conversation_id);
    const arr = byConv.get(cid) ?? [];
    arr.push({ role: String(m.sender_role), ts: new Date(String(m.created_at)).getTime() });
    byConv.set(cid, arr);
  }
  for (const msgs of byConv.values()) {
    let firstGuestTs: number | null = null;
    for (const msg of msgs) {
      if (msg.role === 'guest' && firstGuestTs === null) {
        firstGuestTs = msg.ts;
      } else if (msg.role === 'host' && firstGuestTs !== null) {
        const diffMin = Math.max(1, Math.round((msg.ts - firstGuestTs) / 60000));
        responseMinutesList.push(diffMin);
        firstGuestTs = null;
      }
    }
  }
  const avgResponseMinutes =
    responseMinutesList.length > 0
      ? Math.round(
          responseMinutesList.reduce((a, b) => a + b, 0) / responseMinutesList.length
        )
      : null;

  // Per-property breakdown table
  const byProperty = stays
    .filter((s) => !stayFilter || s.id === stayFilter)
    .map((s) => {
      const sViews = scopedViews.filter((v) => String(v.stay_id) === s.id).length;
      const sConf = confirmedBookings.filter((b) => String(b.stay_id) === s.id);
      const sNights = sConf.reduce((sum, b) => sum + toNum(b.nights), 0);
      const sRev = sConf.reduce(
        (sum, b) =>
          sum +
          (toNum(b.pay_at_checkin_vnd) > 0
            ? toNum(b.pay_at_checkin_vnd)
            : toNum(b.wholesale_total_vnd)),
        0
      );
      const sUnits = roomsRes.rows
        .filter((r) => String(r.stay_id) === s.id)
        .reduce((sum, r) => sum + Math.max(1, toNum(r.units_total, 1)), 0);
      const sAvail = sUnits * periodDays;
      return {
        stayId: s.id,
        titleEn: s.titleEn,
        titleVi: s.titleVi,
        viewsCount: sViews,
        bookingsCount: sConf.length,
        conversionRatePct: sViews > 0 ? Math.round((sConf.length / sViews) * 1000) / 10 : 0,
        occupancyRatePct:
          sAvail > 0 ? Math.min(100, Math.round((sNights / sAvail) * 1000) / 10) : 0,
        adrVnd: sNights > 0 ? Math.round(sRev / sNights) : 0,
        revParVnd: sAvail > 0 ? Math.round(sRev / sAvail) : 0,
        revenueVnd: sRev,
      };
    });

  return {
    range,
    stays,
    metrics: {
      viewsCount,
      bookingsCount: confirmedCount,
      conversionRatePct,
      occupancyRatePct,
      avgLengthOfStay,
      adrVnd,
      revParVnd,
      cancellationRatePct,
      avgResponseMinutes,
      totalRoomRevenueVnd,
    },
    byProperty,
  };
}

export async function getHostDrafts(user: SessionUser) {
  const res = await dbQuery<{
    id: string;
    current_step: number;
    payload_json: unknown;
    status: string;
    updated_at: string | Date;
  }>(
    `SELECT * FROM stay_drafts
     WHERE user_id = $1 AND status = 'draft'
     ORDER BY updated_at DESC`,
    [user.id]
  );

  return res.rows.map((d) => {
    let payload: Record<string, unknown> = {};
    if (d.payload_json && typeof d.payload_json === 'object') {
      payload = d.payload_json as Record<string, unknown>;
    } else if (typeof d.payload_json === 'string') {
      try {
        payload = JSON.parse(d.payload_json);
      } catch {
        payload = {};
      }
    }
    return {
      id: String(d.id),
      currentStep: toNum(d.current_step, 1),
      payload,
      status: String(d.status),
      updatedAt: toIsoTimestamp(d.updated_at),
    };
  });
}

export async function saveHostDraft(
  user: SessionUser,
  input: {
    draftId?: string;
    currentStep: number;
    payload: Record<string, unknown>;
  }
) {
  const step = Math.max(1, Math.min(6, Math.round(input.currentStep)));
  const payloadStr = JSON.stringify(input.payload ?? {});

  if (input.draftId && isValidUuid(input.draftId)) {
    const res = await dbQuery<{ id: string; user_id: string }>(
      'SELECT id, user_id FROM stay_drafts WHERE id = $1',
      [input.draftId]
    );
    const existing = res.rows[0];
    if (existing) {
      if (existing.user_id !== user.id && user.role !== 'admin') {
        throw new AppError('FORBIDDEN', 'You cannot edit this draft.');
      }
      await dbQuery(
        `UPDATE stay_drafts
         SET current_step = $1, payload_json = $2::jsonb, updated_at = NOW()
         WHERE id = $3`,
        [step, payloadStr, input.draftId]
      );
      return { id: input.draftId, currentStep: step };
    }
  }

  const id = crypto.randomUUID();
  await dbQuery(
    `INSERT INTO stay_drafts (id, user_id, current_step, payload_json, status)
     VALUES ($1, $2, $3, $4::jsonb, 'draft')`,
    [id, user.id, step, payloadStr]
  );
  return { id, currentStep: step };
}

export async function deleteHostDraft(user: SessionUser, draftId: string) {
  if (!isValidUuid(draftId)) throw new AppError('VALIDATION_ERROR', 'Invalid draft ID.');
  await dbQuery('DELETE FROM stay_drafts WHERE id = $1 AND user_id = $2', [
    draftId,
    user.id,
  ]);
  return { ok: true };
}

export async function publishHostDraft(
  user: SessionUser,
  draftId: string,
  payloadOverride?: Record<string, unknown>
) {
  if (!isValidUuid(draftId)) throw new AppError('VALIDATION_ERROR', 'Invalid draft ID.');
  const res = await dbQuery<{ id: string; user_id: string; payload_json: unknown }>(
    `SELECT * FROM stay_drafts WHERE id = $1`,
    [draftId]
  );
  const draft = res.rows[0];
  if (!draft) throw new AppError('NOT_FOUND', 'Draft not found.');
  if (draft.user_id !== user.id && user.role !== 'admin') {
    throw new AppError('FORBIDDEN', 'You do not own this draft.');
  }

  const raw =
    payloadOverride ??
    (typeof draft.payload_json === 'string'
      ? (JSON.parse(draft.payload_json) as Record<string, unknown>)
      : ((draft.payload_json as Record<string, unknown>) ?? {}));

  const businessName = String(raw.businessName ?? user.fullName ?? 'Host Partner').trim();
  const stayName = String(raw.stayName ?? raw.titleEn ?? '').trim();
  const destinationSlug = String(raw.destinationSlug ?? 'da-nang').trim();
  const propertyType = String(raw.propertyType ?? 'apartment');

  if (businessName.length < 2 || stayName.length < 3) {
    throw new AppError(
      'VALIDATION_ERROR',
      'Please enter your business name and property name before publishing.'
    );
  }

  const kitchenType = (['full', 'kitchenette', 'shared', 'none'].includes(
    String(raw.kitchenType)
  )
    ? String(raw.kitchenType)
    : 'full') as 'full' | 'kitchenette' | 'shared' | 'none';
  const laundryType = (['in_unit', 'building', 'service', 'none'].includes(
    String(raw.laundryType)
  )
    ? String(raw.laundryType)
    : 'in_unit') as 'in_unit' | 'building' | 'service' | 'none';

  const result = await submitHostApplication(user, {
    businessName,
    stayName,
    destinationSlug,
    propertyType,
    measuredDownloadMbps: Number(raw.measuredDownloadMbps ?? 0) || 0,
    hasWorkspace: Boolean(raw.hasWorkspace),
    hasErgonomicChair: Boolean(raw.hasErgonomicChair),
    hasExternalMonitor: Boolean(raw.hasExternalMonitor),
    kitchenType,
    laundryType,
    hasKitchen: kitchenType !== 'none',
    hasLaundry: laundryType !== 'none',
  });

  await dbQuery(
    `UPDATE stay_drafts SET status = 'submitted', updated_at = NOW() WHERE id = $1`,
    [draftId]
  );

  return result;
}

export async function getHostSettings(user: SessionUser) {
  const [settingsRes, repliesRes] = await Promise.all([
    dbQuery(`SELECT * FROM host_settings WHERE host_id = $1`, [user.id]),
    dbQuery(
      `SELECT * FROM host_quick_replies WHERE host_id = $1 ORDER BY sort_order ASC, created_at ASC`,
      [user.id]
    ),
  ]);
  const s = settingsRes.rows[0];
  return {
    settings: {
      displayName: s?.display_name ? String(s.display_name) : user.fullName,
      contactPhone: s?.contact_phone ? String(s.contact_phone) : '',
      whatsappNumber: s?.whatsapp_number ? String(s.whatsapp_number) : '',
      zaloHandle: s?.zalo_handle ? String(s.zalo_handle) : '',
      payoutMethod: s?.payout_method ? String(s.payout_method) : 'direct_checkin_and_bank',
      bankName: s?.bank_name ? String(s.bank_name) : '',
      bankAccountNumber: s?.bank_account_number ? String(s.bank_account_number) : '',
      bankAccountName: s?.bank_account_name ? String(s.bank_account_name) : '',
      notifyEmail: s?.notify_email !== undefined ? Boolean(s.notify_email) : true,
      notifyInApp: s?.notify_in_app !== undefined ? Boolean(s.notify_in_app) : true,
      autoIcalSync: s?.auto_ical_sync !== undefined ? Boolean(s.auto_ical_sync) : true,
    },
    quickReplies: repliesRes.rows.map((qr) => ({
      id: String(qr.id),
      title: String(qr.title),
      body: String(qr.body),
      sortOrder: toNum(qr.sort_order),
    })),
  };
}

export async function updateHostSettings(
  user: SessionUser,
  input: {
    displayName?: string;
    contactPhone?: string;
    whatsappNumber?: string;
    zaloHandle?: string;
    payoutMethod?: string;
    bankName?: string;
    bankAccountNumber?: string;
    bankAccountName?: string;
    notifyEmail?: boolean;
    notifyInApp?: boolean;
    autoIcalSync?: boolean;
  }
) {
  const cur = (await getHostSettings(user)).settings;
  await dbQuery(
    `INSERT INTO host_settings (
      host_id, display_name, contact_phone, whatsapp_number, zalo_handle,
      payout_method, bank_name, bank_account_number, bank_account_name,
      notify_email, notify_in_app, auto_ical_sync, updated_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW())
    ON CONFLICT (host_id)
    DO UPDATE SET
      display_name = EXCLUDED.display_name,
      contact_phone = EXCLUDED.contact_phone,
      whatsapp_number = EXCLUDED.whatsapp_number,
      zalo_handle = EXCLUDED.zalo_handle,
      payout_method = EXCLUDED.payout_method,
      bank_name = EXCLUDED.bank_name,
      bank_account_number = EXCLUDED.bank_account_number,
      bank_account_name = EXCLUDED.bank_account_name,
      notify_email = EXCLUDED.notify_email,
      notify_in_app = EXCLUDED.notify_in_app,
      auto_ical_sync = EXCLUDED.auto_ical_sync,
      updated_at = NOW()`,
    [
      user.id,
      input.displayName?.trim() ?? cur.displayName,
      input.contactPhone?.trim() ?? cur.contactPhone,
      input.whatsappNumber?.trim() ?? cur.whatsappNumber,
      input.zaloHandle?.trim() ?? cur.zaloHandle,
      input.payoutMethod?.trim() ?? cur.payoutMethod,
      input.bankName?.trim() ?? cur.bankName,
      input.bankAccountNumber?.trim() ?? cur.bankAccountNumber,
      input.bankAccountName?.trim() ?? cur.bankAccountName,
      input.notifyEmail ?? cur.notifyEmail,
      input.notifyInApp ?? cur.notifyInApp,
      input.autoIcalSync ?? cur.autoIcalSync,
    ]
  );

  return { ok: true };
}

export type HostOverviewData = Awaited<ReturnType<typeof getHostOverviewData>>;
export type HostCalendarData = Awaited<ReturnType<typeof getHostCalendarData>>;
export type HostReservationsData = Awaited<ReturnType<typeof getHostReservationsData>>;
export type HostEarningsData = Awaited<ReturnType<typeof getHostEarningsData>>;
export type HostReviewsData = Awaited<ReturnType<typeof getHostReviewsData>>;
export type HostInsightsData = Awaited<ReturnType<typeof getHostInsightsData>>;
export type HostSettingsPayload = Awaited<ReturnType<typeof getHostSettings>>;
export type HostSettingsData = HostSettingsPayload['settings'];
export type StayDraftInput = Record<string, unknown>;

