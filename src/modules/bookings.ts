import crypto from 'node:crypto';
import type { SessionUser } from '@/lib/auth/session';
import {
  addDaysIso,
  enumerateStayNights,
  getTodayIsoVietnam,
  isValidIsoDate,
  isValidUuid,
} from '@/lib/dates';
import { dbQuery, dbTransaction, toNum, type DbClient } from '@/lib/db';
import { AppError } from '@/lib/errors';
import { calculateCancellationOutcome, calculateStayQuote } from '@/lib/pricing';
import { dispatchBookingLockedNotifications } from '@/modules/notifications';

export interface CreateBookingInput {
  stayId: string;
  roomId: string;
  packageId: string;
  checkIn: string;
  nights: number;
  guestsCount: number;
  applyVatFree?: boolean;
  useRewardCredit?: boolean;
  guestNote?: string;
  checkoutMode?: 'intent' | 'instant';
}

async function lockRoomNightsTx(
  tx: DbClient,
  roomId: string,
  unitsTotal: number,
  nightDates: string[]
) {
  for (const dateIso of nightDates) {
    await tx.query(
      `INSERT INTO room_night_locks (id, room_id, stay_date, booked_units, blocked_units)
       VALUES ($1, $2, $3::date, 0, 0)
       ON CONFLICT (room_id, stay_date) DO NOTHING`,
      [crypto.randomUUID(), roomId, dateIso]
    );

    const lockRes = await tx.query<{
      id: string;
      booked_units: number;
      blocked_units: number;
    }>(
      `SELECT id, booked_units, blocked_units
       FROM room_night_locks
       WHERE room_id = $1 AND stay_date = $2::date
       FOR UPDATE`,
      [roomId, dateIso]
    );
    const lock = lockRes.rows[0];
    if (!lock || toNum(lock.booked_units) + toNum(lock.blocked_units) + 1 > unitsTotal) {
      throw new AppError(
        'CONFLICT',
        `Selected dates include sold-out or blocked inventory (${dateIso}).`
      );
    }

    await tx.query(
      'UPDATE room_night_locks SET booked_units = booked_units + 1 WHERE id = $1',
      [lock.id]
    );
  }
}

async function verifyAvailabilityReadOnlyTx(
  tx: DbClient,
  roomId: string,
  unitsTotal: number,
  checkIn: string,
  checkOut: string
) {
  const lockRes = await tx.query<{
    stay_date: string | Date;
    booked_units: number;
    blocked_units: number;
  }>(
    `SELECT stay_date, booked_units, blocked_units
     FROM room_night_locks
     WHERE room_id = $1 AND stay_date >= $2::date AND stay_date < $3::date`,
    [roomId, checkIn, checkOut]
  );

  for (const row of lockRes.rows) {
    if (toNum(row.booked_units) + toNum(row.blocked_units) + 1 > unitsTotal) {
      const dt =
        row.stay_date instanceof Date
          ? row.stay_date.toISOString().slice(0, 10)
          : String(row.stay_date).slice(0, 10);
      throw new AppError(
        'CONFLICT',
        `Selected dates include sold-out or blocked inventory (${dt}).`
      );
    }
  }
}

export async function createStayBooking(user: SessionUser, input: CreateBookingInput) {
  if (!isValidUuid(input.stayId) || !isValidUuid(input.roomId) || !isValidUuid(input.packageId)) {
    throw new AppError('VALIDATION_ERROR', 'Invalid stay, room, or package identifier.');
  }
  if (!isValidIsoDate(input.checkIn)) {
    throw new AppError('VALIDATION_ERROR', 'Check-in date must be YYYY-MM-DD.');
  }
  const todayVn = getTodayIsoVietnam();
  if (input.checkIn < todayVn) {
    throw new AppError('VALIDATION_ERROR', 'Check-in date cannot be in the past.');
  }
  if (!Number.isInteger(input.nights) || input.nights < 7 || input.nights > 180) {
    throw new AppError('VALIDATION_ERROR', 'Minimum stay on VietNomad is 7 nights.');
  }

  const checkOut = addDaysIso(input.checkIn, input.nights);
  const nightDates = enumerateStayNights(input.checkIn, checkOut);
  const checkoutMode = input.checkoutMode ?? 'intent';

  return dbTransaction(async (tx) => {
    const rowRes = await tx.query<{
      stay_id: string;
      host_id: string;
      status: string;
      business_model: 'booking_flow' | 'stay_direct';
      direct_booking_url: string | null;
      cancellation_policy: 'flexible' | 'moderate' | 'strict';
      room_id: string;
      max_guests: number;
      units_total: number;
      pkg_id: string;
      is_listed: boolean;
      valid_from: string | Date;
      valid_to: string | Date;
      wholesale_7_vnd: string | number;
      wholesale_14_vnd: string | number;
      wholesale_21_vnd: string | number;
      wholesale_30_vnd: string | number;
      compare_30_vnd: string | number | null;
      extra_night_vnd: string | number;
    }>(
      `SELECT s.id AS stay_id, s.host_id, s.status, s.business_model, s.direct_booking_url,
              s.cancellation_policy,
              r.id AS room_id, r.max_guests, r.units_total,
              p.id AS pkg_id, p.is_listed, p.valid_from, p.valid_to,
              p.wholesale_7_vnd, p.wholesale_14_vnd, p.wholesale_21_vnd, p.wholesale_30_vnd,
              p.compare_30_vnd, p.extra_night_vnd
       FROM stays s
       JOIN stay_rooms r ON r.id = $2 AND r.stay_id = s.id
       JOIN stay_packages p ON p.id = $3 AND p.room_id = r.id AND p.stay_id = s.id
       WHERE s.id = $1`,
      [input.stayId, input.roomId, input.packageId]
    );

    const meta = rowRes.rows[0];
    if (!meta) {
      throw new AppError('NOT_FOUND', 'Stay, room, or package not found.');
    }
    if (meta.status !== 'live' || !meta.is_listed) {
      throw new AppError('UNAVAILABLE', 'This stay package is currently unlisted.');
    }
    if (input.guestsCount < 1 || input.guestsCount > toNum(meta.max_guests)) {
      throw new AppError(
        'VALIDATION_ERROR',
        `Room accommodates up to ${meta.max_guests} guests.`
      );
    }

    const validFrom =
      meta.valid_from instanceof Date
        ? meta.valid_from.toISOString().slice(0, 10)
        : String(meta.valid_from).slice(0, 10);
    const validTo =
      meta.valid_to instanceof Date
        ? meta.valid_to.toISOString().slice(0, 10)
        : String(meta.valid_to).slice(0, 10);

    if (input.checkIn < validFrom || input.checkIn > validTo) {
      throw new AppError(
        'UNAVAILABLE',
        `Package is only open for check-ins from ${validFrom} to ${validTo}.`
      );
    }

    const userRes = await tx.query<{
      membership_tier: 'free' | 'premium';
      reward_credit_vnd: string | number;
      vat_tax_id: string | null;
    }>(
      'SELECT membership_tier, reward_credit_vnd, vat_tax_id FROM users WHERE id = $1 FOR UPDATE',
      [user.id]
    );
    const freshUser = userRes.rows[0];
    if (!freshUser) {
      throw new AppError('UNAUTHORIZED', 'Account not found.');
    }

    const quote = calculateStayQuote({
      pkg: {
        wholesale7Vnd: toNum(meta.wholesale_7_vnd),
        wholesale14Vnd: toNum(meta.wholesale_14_vnd),
        wholesale21Vnd: toNum(meta.wholesale_21_vnd),
        wholesale30Vnd: toNum(meta.wholesale_30_vnd),
        compare30Vnd: meta.compare_30_vnd ? toNum(meta.compare_30_vnd) : null,
        extraNightVnd: toNum(meta.extra_night_vnd),
      },
      nights: input.nights,
      businessModel: meta.business_model,
      isPremiumMember: freshUser.membership_tier === 'premium',
      applyVatFree: input.applyVatFree,
      vatTaxId: freshUser.vat_tax_id,
      availableRewardCreditVnd: toNum(freshUser.reward_credit_vnd),
      useRewardCredit: input.useRewardCredit,
    });

    const bookingId = crypto.randomUUID();
    const bookingCode = `VN-${crypto.randomInt(100000, 999999)}`;

    if (meta.business_model === 'stay_direct') {
      const referralFeeVnd = Math.max(5000, Math.round(quote.totalStayVnd * 0.01));
      const walletRes = await tx.query<{ balance_vnd: string | number }>(
        'SELECT balance_vnd FROM host_wallets WHERE host_id = $1 FOR UPDATE',
        [meta.host_id]
      );
      const balance = toNum(walletRes.rows[0]?.balance_vnd, 0);
      if (balance < referralFeeVnd) {
        throw new AppError(
          'INSUFFICIENT_WALLET',
          'Host StayDirect™ ad wallet is low. Please check back soon or choose a 12% BookingFlow stay.'
        );
      }

      await tx.query(
        'UPDATE host_wallets SET balance_vnd = balance_vnd - $1, updated_at = NOW() WHERE host_id = $2',
        [referralFeeVnd, meta.host_id]
      );

      const destinationUrl = meta.direct_booking_url || 'https://example.vn/direct-booking';
      await tx.query(
        `INSERT INTO staydirect_referrals (
          id, stay_id, package_id, member_id, nights, retail_total_vnd, referral_fee_vnd, destination_url
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          crypto.randomUUID(),
          meta.stay_id,
          meta.pkg_id,
          user.id,
          input.nights,
          quote.totalStayVnd,
          referralFeeVnd,
          destinationUrl,
        ]
      );

      await tx.query(
        `INSERT INTO bookings (
          id, booking_code, stay_id, room_id, package_id, guest_id, business_model,
          status, check_in, check_out, nights, guests_count, wholesale_total_vnd,
          service_fee_vnd, vat_discount_vnd, reward_credit_used_vnd, guest_total_vnd,
          booking_fee_online_vnd, pay_at_checkin_vnd,
          reward_credit_earned_vnd, cancellation_policy, guest_note
        ) VALUES ($1,$2,$3,$4,$5,$6,'stay_direct','direct_referral',$7,$8,$9,$10,$11,0,0,0,$12,0,$11,0,$13,$14)`,
        [
          bookingId,
          bookingCode,
          meta.stay_id,
          meta.room_id,
          meta.pkg_id,
          user.id,
          input.checkIn,
          checkOut,
          input.nights,
          input.guestsCount,
          quote.payAtCheckinVnd,
          quote.totalStayVnd,
          meta.cancellation_policy,
          (input.guestNote ?? '').trim(),
        ]
      );

      return {
        bookingId,
        bookingCode,
        status: 'direct_referral' as const,
        businessModel: 'stay_direct' as const,
        directReferralUrl: destinationUrl,
        referralFeeChargedVnd: referralFeeVnd,
        paymentIntentId: null,
        quote,
      };
    }

    // BookingFlow: 12% Booking & Verification Fee collected online; 88% (P_host) paid directly at check-in
    const unitsTotal = toNum(meta.units_total, 1);
    const paymentIntentId = `pi_vn_${crypto.randomBytes(8).toString('hex')}`;

    if (checkoutMode === 'instant') {
      await lockRoomNightsTx(tx, meta.room_id, unitsTotal, nightDates);
    } else {
      await verifyAvailabilityReadOnlyTx(tx, meta.room_id, unitsTotal, input.checkIn, checkOut);
    }

    const initialStatus = checkoutMode === 'instant' ? 'RESERVED_LOCKED' : 'PENDING_PAYMENT';

    if (checkoutMode === 'instant') {
      if (quote.rewardCreditUsedVnd > 0) {
        await tx.query(
          'UPDATE users SET reward_credit_vnd = reward_credit_vnd - $1 WHERE id = $2',
          [quote.rewardCreditUsedVnd, user.id]
        );
      }
      if (quote.rewardCreditEarnedVnd > 0) {
        await tx.query(
          'UPDATE users SET reward_credit_vnd = reward_credit_vnd + $1 WHERE id = $2',
          [quote.rewardCreditEarnedVnd, user.id]
        );
      }
    }

    await tx.query(
      `INSERT INTO bookings (
        id, booking_code, stay_id, room_id, package_id, guest_id, business_model,
        status, check_in, check_out, nights, guests_count, wholesale_total_vnd,
        service_fee_vnd, vat_discount_vnd, reward_credit_used_vnd, guest_total_vnd,
        booking_fee_online_vnd, pay_at_checkin_vnd, payment_intent_id, paid_at,
        reward_credit_earned_vnd, cancellation_policy, guest_note
      ) VALUES ($1,$2,$3,$4,$5,$6,'booking_flow',$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)`,
      [
        bookingId,
        bookingCode,
        meta.stay_id,
        meta.room_id,
        meta.pkg_id,
        user.id,
        initialStatus,
        input.checkIn,
        checkOut,
        input.nights,
        input.guestsCount,
        quote.wholesaleTotalVnd,
        quote.serviceFeeVnd,
        quote.vatDiscountVnd,
        quote.rewardCreditUsedVnd,
        quote.totalStayVnd,
        quote.feeOnlineVnd,
        quote.payAtCheckinVnd,
        paymentIntentId,
        checkoutMode === 'instant' ? new Date().toISOString() : null,
        quote.rewardCreditEarnedVnd,
        meta.cancellation_policy,
        (input.guestNote ?? '').trim(),
      ]
    );

    if (checkoutMode === 'instant') {
      await dispatchBookingLockedNotifications(tx, bookingId);
    }

    return {
      bookingId,
      bookingCode,
      status: initialStatus,
      businessModel: 'booking_flow' as const,
      directReferralUrl: null,
      referralFeeChargedVnd: 0,
      paymentIntentId,
      quote,
    };
  });
}

export async function confirmBookingFeePayment(user: SessionUser, bookingId: string) {
  if (!isValidUuid(bookingId)) {
    throw new AppError('VALIDATION_ERROR', 'Invalid booking id.');
  }

  return dbTransaction(async (tx) => {
    const res = await tx.query<{
      id: string;
      booking_code: string;
      guest_id: string;
      room_id: string;
      status: string;
      check_in: string | Date;
      check_out: string | Date;
      booking_fee_online_vnd: string | number;
      pay_at_checkin_vnd: string | number;
      reward_credit_used_vnd: string | number;
      reward_credit_earned_vnd: string | number;
      payment_intent_id: string | null;
      units_total: number;
    }>(
      `SELECT b.*, sr.units_total
       FROM bookings b
       JOIN stay_rooms sr ON sr.id = b.room_id
       WHERE b.id = $1 FOR UPDATE`,
      [bookingId]
    );

    const b = res.rows[0];
    if (!b) throw new AppError('NOT_FOUND', 'Booking not found.');
    if (b.guest_id !== user.id && user.role !== 'admin') {
      throw new AppError('FORBIDDEN', 'You cannot pay for another member’s booking.');
    }
    if (b.status === 'RESERVED_LOCKED') {
      return {
        bookingId: b.id,
        bookingCode: b.booking_code,
        status: 'RESERVED_LOCKED' as const,
        feePaidOnlineVnd: toNum(b.booking_fee_online_vnd),
        payAtCheckinVnd: toNum(b.pay_at_checkin_vnd),
        paymentIntentId: b.payment_intent_id,
      };
    }
    if (b.status !== 'PENDING_PAYMENT') {
      throw new AppError('CONFLICT', `Booking in status ${b.status} cannot be paid.`);
    }

    const checkInIso =
      b.check_in instanceof Date
        ? b.check_in.toISOString().slice(0, 10)
        : String(b.check_in).slice(0, 10);
    const checkOutIso =
      b.check_out instanceof Date
        ? b.check_out.toISOString().slice(0, 10)
        : String(b.check_out).slice(0, 10);

    const nightDates = enumerateStayNights(checkInIso, checkOutIso);
    await lockRoomNightsTx(tx, b.room_id, toNum(b.units_total, 1), nightDates);

    const usedCredit = toNum(b.reward_credit_used_vnd);
    const earnedCredit = toNum(b.reward_credit_earned_vnd);
    const netCredit = earnedCredit - usedCredit;
    if (netCredit !== 0) {
      await tx.query(
        'UPDATE users SET reward_credit_vnd = GREATEST(0, reward_credit_vnd + $1) WHERE id = $2',
        [netCredit, b.guest_id]
      );
    }

    await tx.query(
      `UPDATE bookings
       SET status = 'RESERVED_LOCKED',
           paid_at = NOW()
       WHERE id = $1`,
      [b.id]
    );

    await dispatchBookingLockedNotifications(tx, b.id);

    return {
      bookingId: b.id,
      bookingCode: b.booking_code,
      status: 'RESERVED_LOCKED' as const,
      feePaidOnlineVnd: toNum(b.booking_fee_online_vnd),
      payAtCheckinVnd: toNum(b.pay_at_checkin_vnd),
      paymentIntentId: b.payment_intent_id,
    };
  });
}

export async function confirmCheckInCompleted(actor: SessionUser, bookingId: string) {
  if (!isValidUuid(bookingId)) throw new AppError('VALIDATION_ERROR', 'Invalid booking id.');

  return dbTransaction(async (tx) => {
    const res = await tx.query<{ id: string; host_id: string; status: string }>(
      `SELECT b.id, s.host_id, b.status
       FROM bookings b
       JOIN stays s ON s.id = b.stay_id
       WHERE b.id = $1 FOR UPDATE`,
      [bookingId]
    );
    const b = res.rows[0];
    if (!b) throw new AppError('NOT_FOUND', 'Booking not found.');
    if (actor.role !== 'admin' && b.host_id !== actor.id) {
      throw new AppError('FORBIDDEN', 'Only the property host or admin can mark check-in completed.');
    }
    if (b.status !== 'RESERVED_LOCKED' && b.status !== 'confirmed') {
      throw new AppError('CONFLICT', 'Only locked bookings can be marked checked-in & paid.');
    }

    await tx.query(`UPDATE bookings SET status = 'CHECKED_IN_COMPLETED' WHERE id = $1`, [b.id]);
    return { bookingId: b.id, status: 'CHECKED_IN_COMPLETED' as const };
  });
}

export async function refundWifiMismatch(
  actor: SessionUser,
  bookingId: string,
  reason: string
) {
  if (!isValidUuid(bookingId)) throw new AppError('VALIDATION_ERROR', 'Invalid booking id.');

  return dbTransaction(async (tx) => {
    const res = await tx.query<{
      id: string;
      booking_code: string;
      guest_id: string;
      host_id: string;
      room_id: string;
      status: string;
      check_in: string | Date;
      check_out: string | Date;
      booking_fee_online_vnd: string | number;
      reward_credit_earned_vnd: string | number;
    }>(
      `SELECT b.*, s.host_id
       FROM bookings b
       JOIN stays s ON s.id = b.stay_id
       WHERE b.id = $1 FOR UPDATE`,
      [bookingId]
    );
    const b = res.rows[0];
    if (!b) throw new AppError('NOT_FOUND', 'Booking not found.');
    if (actor.role !== 'admin' && b.guest_id !== actor.id && b.host_id !== actor.id) {
      throw new AppError('FORBIDDEN', 'Not authorized to trigger mismatch refund on this booking.');
    }
    if (b.status !== 'RESERVED_LOCKED' && b.status !== 'confirmed') {
      throw new AppError('CONFLICT', 'Wi-Fi mismatch refund applies to active locked reservations.');
    }

    const feePaid = toNum(b.booking_fee_online_vnd);
    const checkInIso =
      b.check_in instanceof Date
        ? b.check_in.toISOString().slice(0, 10)
        : String(b.check_in).slice(0, 10);
    const checkOutIso =
      b.check_out instanceof Date
        ? b.check_out.toISOString().slice(0, 10)
        : String(b.check_out).slice(0, 10);

    const nights = enumerateStayNights(checkInIso, checkOutIso);
    for (const dt of nights) {
      await tx.query(
        `UPDATE room_night_locks
         SET booked_units = GREATEST(0, booked_units - 1)
         WHERE room_id = $1 AND stay_date = $2::date`,
        [b.room_id, dt]
      );
    }

    const earnedRollback = toNum(b.reward_credit_earned_vnd);
    if (earnedRollback > 0) {
      await tx.query(
        'UPDATE users SET reward_credit_vnd = GREATEST(0, reward_credit_vnd - $1) WHERE id = $2',
        [earnedRollback, b.guest_id]
      );
    }

    const cleanReason =
      reason.trim() || 'Check-in Wi-Fi speed or workspace did not match verified certificate';

    await tx.query(
      `UPDATE bookings
       SET status = 'REFUNDED_WIFI_MISMATCH',
           refund_amount_vnd = $1,
           mismatch_reason = $2,
           cancelled_at = NOW()
       WHERE id = $3`,
      [feePaid, cleanReason, b.id]
    );

    await tx.query(
      `INSERT INTO booking_notifications (
        id, booking_id, recipient_role, channel, recipient_contact, subject, payload_json, status
      ) VALUES ($1,$2,'guest','email','member','100% Booking Fee Refund Initiated — Wi-Fi Guarantee',$3,'sent')`,
      [
        crypto.randomUUID(),
        b.id,
        JSON.stringify({
          bookingCode: b.booking_code,
          refundAmountVnd: feePaid,
          reason: cleanReason,
        }),
      ]
    );

    return {
      bookingId: b.id,
      status: 'REFUNDED_WIFI_MISMATCH' as const,
      refundAmountVnd: feePaid,
      mismatchReason: cleanReason,
    };
  });
}

export async function cancelBookingByMember(user: SessionUser, bookingId: string) {
  if (!isValidUuid(bookingId)) {
    throw new AppError('VALIDATION_ERROR', 'Invalid booking id.');
  }

  return dbTransaction(async (tx) => {
    const res = await tx.query<{
      id: string;
      guest_id: string;
      room_id: string;
      business_model: string;
      status: string;
      check_in: string | Date;
      check_out: string | Date;
      nights: number;
      guest_total_vnd: string | number;
      booking_fee_online_vnd: string | number;
      reward_credit_earned_vnd: string | number;
      cancellation_policy: 'flexible' | 'moderate' | 'strict';
      created_at: string | Date;
    }>('SELECT * FROM bookings WHERE id = $1 FOR UPDATE', [bookingId]);

    const b = res.rows[0];
    if (!b) throw new AppError('NOT_FOUND', 'Booking not found.');
    if (b.guest_id !== user.id && user.role !== 'admin') {
      throw new AppError('FORBIDDEN', 'You cannot cancel another member’s booking.');
    }

    if (b.status === 'PENDING_PAYMENT') {
      await tx.query(
        `UPDATE bookings SET status = 'cancelled', cancelled_at = NOW() WHERE id = $1`,
        [b.id]
      );
      return {
        bookingId: b.id,
        tier: 'cooling_off' as const,
        refundAmountVnd: 0,
        creditIssuedVnd: 0,
      };
    }

    if (b.status !== 'RESERVED_LOCKED' && b.status !== 'confirmed') {
      throw new AppError('CONFLICT', 'Only active reservations can be cancelled here.');
    }

    const checkInIso =
      b.check_in instanceof Date
        ? b.check_in.toISOString().slice(0, 10)
        : String(b.check_in).slice(0, 10);
    const checkOutIso =
      b.check_out instanceof Date
        ? b.check_out.toISOString().slice(0, 10)
        : String(b.check_out).slice(0, 10);

    const paidOnlineVnd =
      toNum(b.booking_fee_online_vnd) > 0
        ? toNum(b.booking_fee_online_vnd)
        : toNum(b.guest_total_vnd);

    const outcome = calculateCancellationOutcome({
      policy: b.cancellation_policy,
      guestTotalVnd: toNum(b.guest_total_vnd),
      paidOnlineVnd,
      nights: toNum(b.nights),
      checkInIso,
      bookedAt: new Date(String(b.created_at)),
    });

    const nights = enumerateStayNights(checkInIso, checkOutIso);
    for (const dt of nights) {
      await tx.query(
        `UPDATE room_night_locks
         SET booked_units = GREATEST(0, booked_units - 1)
         WHERE room_id = $1 AND stay_date = $2::date`,
        [b.room_id, dt]
      );
    }

    const earnedRollback = toNum(b.reward_credit_earned_vnd);
    const netCreditChange = outcome.creditIssuedVnd - earnedRollback;
    if (netCreditChange !== 0) {
      await tx.query(
        'UPDATE users SET reward_credit_vnd = GREATEST(0, reward_credit_vnd + $1) WHERE id = $2',
        [netCreditChange, b.guest_id]
      );
    }

    await tx.query(
      `UPDATE bookings
       SET status = 'cancelled',
           refund_amount_vnd = $1,
           credit_issued_vnd = $2,
           cancelled_at = NOW()
       WHERE id = $3`,
      [outcome.refundAmountVnd, outcome.creditIssuedVnd, b.id]
    );

    return { bookingId: b.id, ...outcome };
  });
}

export async function getMemberDashboard(userId: string) {
  const [bookingsRes, savedRes, rsvpsRes] = await Promise.all([
    dbQuery(
      `SELECT b.*,
              s.slug AS stay_slug, s.title_en, s.title_vi, s.hero_image,
              s.exact_address, s.checkin_instructions_en, s.checkin_instructions_vi,
              s.wifi_download_mbps, s.wifi_upload_mbps, s.wifi_jitter_ms,
              s.verification_tier, s.speedtest_proof_url, s.workspace_video_url,
              s.host_whatsapp, s.direct_booking_url,
              d.name_en AS destination_name_en, d.name_vi AS destination_name_vi,
              r.name_en AS room_name_en, r.name_vi AS room_name_vi
       FROM bookings b
       JOIN stays s ON s.id = b.stay_id
       JOIN destinations d ON d.id = s.destination_id
       JOIN stay_rooms r ON r.id = b.room_id
       WHERE b.guest_id = $1
       ORDER BY b.created_at DESC`,
      [userId]
    ),
    dbQuery(
      `SELECT s.id, s.slug, s.title_en, s.title_vi, s.hero_image, s.wifi_download_mbps,
              s.business_model, d.name_en AS destination_name_en, d.name_vi AS destination_name_vi,
              p.wholesale_7_vnd, p.wholesale_30_vnd
       FROM saved_stays ss
       JOIN stays s ON s.id = ss.stay_id
       JOIN destinations d ON d.id = s.destination_id
       LEFT JOIN LATERAL (
         SELECT wholesale_7_vnd, wholesale_30_vnd FROM stay_packages sp WHERE sp.stay_id = s.id AND sp.is_listed = TRUE LIMIT 1
       ) p ON TRUE
       WHERE ss.user_id = $1
       ORDER BY ss.created_at DESC`,
      [userId]
    ),
    dbQuery(
      `SELECT ne.* FROM event_rsvps er JOIN nomad_events ne ON ne.id = er.event_id WHERE er.user_id = $1`,
      [userId]
    ),
  ]);

  const bookingIds = bookingsRes.rows.map((r) => String(r.id));
  const notifRes =
    bookingIds.length > 0
      ? await dbQuery(
          `SELECT * FROM booking_notifications
           WHERE booking_id = ANY($1::uuid[]) AND recipient_role = 'guest'
           ORDER BY created_at DESC`,
          [bookingIds]
        )
      : { rows: [] };

  const notifByBooking = new Map<
    string,
    Array<{ id: string; channel: string; subject: string; status: string; createdAt: string }>
  >();
  for (const n of notifRes.rows) {
    const bid = String(n.booking_id);
    const list = notifByBooking.get(bid) ?? [];
    list.push({
      id: String(n.id),
      channel: String(n.channel),
      subject: String(n.subject),
      status: String(n.status),
      createdAt: new Date(String(n.created_at)).toISOString(),
    });
    notifByBooking.set(bid, list);
  }

  return {
    bookings: bookingsRes.rows.map((b) => {
      const status = String(b.status);
      const unlockAddress =
        status === 'RESERVED_LOCKED' ||
        status === 'CHECKED_IN_COMPLETED' ||
        status === 'confirmed' ||
        status === 'completed';
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
        staySlug: String(b.stay_slug),
        titleEn: String(b.title_en),
        titleVi: String(b.title_vi),
        heroImage: String(b.hero_image),
        destinationNameEn: String(b.destination_name_en),
        destinationNameVi: String(b.destination_name_vi),
        roomNameEn: String(b.room_name_en),
        roomNameVi: String(b.room_name_vi),
        businessModel: String(b.business_model),
        status,
        checkIn:
          b.check_in instanceof Date
            ? b.check_in.toISOString().slice(0, 10)
            : String(b.check_in).slice(0, 10),
        checkOut:
          b.check_out instanceof Date
            ? b.check_out.toISOString().slice(0, 10)
            : String(b.check_out).slice(0, 10),
        nights: toNum(b.nights),
        guestsCount: toNum(b.guests_count),
        wholesaleTotalVnd: toNum(b.wholesale_total_vnd),
        serviceFeeVnd: toNum(b.service_fee_vnd),
        feeOnlineVnd,
        payAtCheckinVnd,
        vatDiscountVnd: toNum(b.vat_discount_vnd),
        rewardCreditUsedVnd: toNum(b.reward_credit_used_vnd),
        guestTotalVnd: toNum(b.guest_total_vnd),
        rewardCreditEarnedVnd: toNum(b.reward_credit_earned_vnd),
        paymentIntentId: b.payment_intent_id ? String(b.payment_intent_id) : null,
        paidAt: b.paid_at ? new Date(String(b.paid_at)).toISOString() : null,
        mismatchReason: String(b.mismatch_reason ?? ''),
        cancellationPolicy: String(b.cancellation_policy),
        refundAmountVnd: toNum(b.refund_amount_vnd),
        creditIssuedVnd: toNum(b.credit_issued_vnd),
        wifiDownloadMbps: toNum(b.wifi_download_mbps),
        wifiUploadMbps: toNum(b.wifi_upload_mbps),
        wifiJitterMs: toNum(b.wifi_jitter_ms),
        verificationTier: String(b.verification_tier ?? 'VIETNOMAD_CERTIFIED'),
        speedtestProofUrl: b.speedtest_proof_url ? String(b.speedtest_proof_url) : null,
        workspaceVideoUrl: b.workspace_video_url ? String(b.workspace_video_url) : null,
        hostWhatsapp: String(b.host_whatsapp ?? '+84901234567'),
        directBookingUrl: b.direct_booking_url ? String(b.direct_booking_url) : null,
        exactAddress: unlockAddress ? String(b.exact_address) : null,
        checkinInstructionsEn: unlockAddress ? String(b.checkin_instructions_en) : null,
        checkinInstructionsVi: unlockAddress ? String(b.checkin_instructions_vi) : null,
        notifications: notifByBooking.get(String(b.id)) ?? [],
        createdAt: new Date(String(b.created_at)).toISOString(),
      };
    }),
    savedStays: savedRes.rows.map((s) => {
      const bm = String(s.business_model);
      const raw30 = toNum(s.wholesale_30_vnd);
      return {
        id: String(s.id),
        slug: String(s.slug),
        titleEn: String(s.title_en),
        titleVi: String(s.title_vi),
        heroImage: String(s.hero_image),
        wifiDownloadMbps: toNum(s.wifi_download_mbps),
        businessModel: bm,
        destinationNameEn: String(s.destination_name_en),
        destinationNameVi: String(s.destination_name_vi),
        monthDisplayVnd: bm === 'booking_flow' ? Math.round(raw30 * 1.12) : raw30,
      };
    }),
    rsvps: rsvpsRes.rows.map((e) => ({
      id: String(e.id),
      titleEn: String(e.title_en),
      titleVi: String(e.title_vi),
      cityEn: String(e.city_en),
      cityVi: String(e.city_vi),
      eventDate: String(e.event_date),
      venueEn: String(e.venue_en),
      venueVi: String(e.venue_vi),
    })),
  };
}
