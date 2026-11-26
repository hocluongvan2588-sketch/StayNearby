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
import { refundGatewayTransactionIfLive } from '@/lib/stripe-refund';
import { advanceHostLeadMilestoneTx } from '@/modules/host-lead-sync';
import { dispatchBookingLockedNotifications } from '@/modules/notifications';
import { getPlatformFeeConfig } from '@/modules/platform-settings';
import { validatePromotionTx, type ValidatedPromotionRecord } from '@/modules/promotions';

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
  promotionCode?: string;
  attributionSessionKey?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  landingPath?: string;
}

export async function releaseBookingPromotionTx(tx: DbClient, bookingId: string) {
  const bRes = await tx.query<{
    id: string;
    promotion_id: string | null;
    promotion_counted: boolean;
  }>(
    `SELECT id, promotion_id, promotion_counted FROM bookings WHERE id = $1 FOR UPDATE`,
    [bookingId]
  );
  const b = bRes.rows[0];
  if (!b || !b.promotion_id || !b.promotion_counted) return;

  await tx.query(
    `UPDATE promotions SET used_count = GREATEST(0, used_count - 1) WHERE id = $1`,
    [b.promotion_id]
  );
  await tx.query(
    `UPDATE bookings SET promotion_counted = FALSE WHERE id = $1`,
    [b.id]
  );
}

export async function recordBackendBookingCompletedAttributionTx(
  tx: DbClient,
  params: {
    bookingId: string;
    stayId: string;
    guestId: string;
    guestRole?: string | null;
  }
) {
  const isInternal = params.guestRole === 'admin';
  const prevRes = await tx.query<{
    session_key: string;
    visitor_id: string;
    utm_source: string;
    utm_medium: string;
    utm_campaign: string;
    utm_content: string;
    utm_term: string;
    landing_path: string;
  }>(
    `SELECT session_key, visitor_id, utm_source, utm_medium, utm_campaign,
            utm_content, utm_term, landing_path
     FROM attribution_events
     WHERE (user_id = $1 OR booking_id = $2)
     ORDER BY created_at DESC LIMIT 1`,
    [params.guestId, params.bookingId]
  );
  const prev = prevRes.rows[0];
  const dedupeKey = `booking_completed:${params.bookingId}`;

  const dup = await tx.query(`SELECT id FROM attribution_events WHERE dedupe_key = $1 LIMIT 1`, [
    dedupeKey,
  ]);
  if (dup.rows.length > 0) return;

  await tx.query(
    `INSERT INTO attribution_events (
      id, session_key, visitor_id, user_id, event_name, stay_id, booking_id,
      utm_source, utm_medium, utm_campaign, utm_content, utm_term, landing_path,
      dedupe_key, is_internal
    ) VALUES ($1,$2,$3,$4,'booking_completed',$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
    [
      crypto.randomUUID(),
      prev?.session_key || `bk_${params.bookingId}`,
      prev?.visitor_id || '',
      params.guestId,
      params.stayId,
      params.bookingId,
      prev?.utm_source || '',
      prev?.utm_medium || '',
      prev?.utm_campaign || '',
      prev?.utm_content || '',
      prev?.utm_term || '',
      prev?.landing_path || '/',
      dedupeKey,
      isInternal,
    ]
  );
}

async function recordBookingFinancialLedgerTx(
  tx: DbClient,
  params: {
    bookingId: string;
    bookingCode: string;
    hostId: string;
    guestId: string;
    gmvTotalVnd: number;
    platformRevenueVnd: number;
    hostPayableVnd: number;
    hostCommissionRate: number;
    fxRateUsd: number;
    checkInIso: string;
    actorUserId: string;
  }
) {
  const periodMonth = params.checkInIso.slice(0, 7);
  await tx.query(
    `INSERT INTO ledger_entries (
      id, entry_type, booking_id, host_id, amount_vnd, currency, fx_rate_to_vnd, description, recorded_by
    ) VALUES
      ($1, 'gmv', $2, $3, $4, 'VND', 1, $5, $9),
      ($6, 'platform_revenue', $2, $3, $7, 'VND', 1, $8, $9),
      ($10, 'host_payable', $2, $3, $11, 'VND', 1, $12, $9)`,
    [
      crypto.randomUUID(),
      params.bookingId,
      params.hostId,
      params.gmvTotalVnd,
      `GMV recognized for booking ${params.bookingCode}`,
      crypto.randomUUID(),
      params.platformRevenueVnd,
      `Online booking & service fee revenue for ${params.bookingCode}`,
      params.actorUserId,
      crypto.randomUUID(),
      params.hostPayableVnd,
      `Host direct rent payable at check-in (${Math.round(params.hostCommissionRate * 100)}% commission) for ${params.bookingCode}`,
    ]
  );

  const existingPayout = await tx.query<{ id: string }>(
    'SELECT id FROM host_payouts WHERE booking_id = $1 LIMIT 1',
    [params.bookingId]
  );
  if (!existingPayout.rows[0]) {
    const commissionVnd = Math.round(params.hostPayableVnd * params.hostCommissionRate);
    await tx.query(
      `INSERT INTO host_payouts (
        id, host_id, booking_id, period_month, collection_mode,
        gross_amount_vnd, commission_vnd, adjustment_vnd, net_payable_vnd,
        status, due_date, notes
      ) VALUES ($1, $2, $3, $4, 'direct_at_checkin', $5, $6, 0, $7, 'direct_at_checkin', $8::date, $9)`,
      [
        crypto.randomUUID(),
        params.hostId,
        params.bookingId,
        periodMonth,
        params.hostPayableVnd,
        commissionVnd,
        params.hostPayableVnd - commissionVnd,
        params.checkInIso,
        '100% rent settled directly to host upon check-in (0% host commission)',
      ]
    );
  }

  const existingInv = await tx.query<{ id: string }>(
    'SELECT id FROM invoices WHERE booking_id = $1 AND invoice_type = $2 LIMIT 1',
    [params.bookingId, 'guest_service_fee']
  );
  if (!existingInv.rows[0] && params.platformRevenueVnd > 0) {
    await tx.query(
      `INSERT INTO invoices (
        id, invoice_number, invoice_type, booking_id, user_id,
        subtotal_vnd, tax_vnd, total_vnd, currency, status, metadata_json
      ) VALUES ($1, $2, 'guest_service_fee', $3, $4, $5, 0, $5, 'VND', 'issued', $6::jsonb)`,
      [
        crypto.randomUUID(),
        `INV-${params.bookingCode}`,
        params.bookingId,
        params.guestId,
        params.platformRevenueVnd,
        JSON.stringify({ fxRateUsd: params.fxRateUsd }),
      ]
    );
  }
}

export async function lockRoomNightsTx(
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

export async function logBookingEventTx(
  tx: DbClient,
  params: {
    bookingId: string;
    actorUserId?: string | null;
    actorRole: 'guest' | 'host' | 'admin' | 'system';
    eventType: string;
    summary: string;
    metadata?: Record<string, unknown>;
  }
) {
  await tx.query(
    `INSERT INTO booking_events (
      id, booking_id, actor_user_id, actor_role, event_type, summary, metadata_json
    ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
    [
      crypto.randomUUID(),
      params.bookingId,
      params.actorUserId ?? null,
      params.actorRole,
      params.eventType,
      params.summary,
      JSON.stringify(params.metadata ?? {}),
    ]
  );
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
      business_model: 'booking_flow';
      is_instant_book: boolean;
      default_min_nights: number | null;
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
      `SELECT s.id AS stay_id, s.host_id, s.status, s.business_model,
              s.is_instant_book, s.default_min_nights,
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

    const lockOverridesRes = await tx.query<{
      stay_date: string | Date;
      custom_nightly_vnd: string | number | null;
      min_nights: number | null;
    }>(
      `SELECT stay_date, custom_nightly_vnd, min_nights
       FROM room_night_locks
       WHERE room_id = $1 AND stay_date >= $2::date AND stay_date < $3::date`,
      [meta.room_id, input.checkIn, checkOut]
    );
    const lockMap = new Map<string, { customNightlyVnd: number | null; minNights: number | null }>();
    let requiredMinNights = Math.max(7, toNum(meta.default_min_nights, 7));
    for (const row of lockOverridesRes.rows) {
      const dt =
        row.stay_date instanceof Date
          ? row.stay_date.toISOString().slice(0, 10)
          : String(row.stay_date).slice(0, 10);
      const minN = row.min_nights ? toNum(row.min_nights, 7) : null;
      if (minN && minN > requiredMinNights) requiredMinNights = minN;
      lockMap.set(dt, {
        customNightlyVnd:
          row.custom_nightly_vnd !== null && row.custom_nightly_vnd !== undefined
            ? toNum(row.custom_nightly_vnd)
            : null,
        minNights: minN,
      });
    }
    if (input.nights < requiredMinNights) {
      throw new AppError(
        'VALIDATION_ERROR',
        `Selected dates require a minimum stay of ${requiredMinNights} nights.`
      );
    }

    const nightOverridesVnd = nightDates.map((dt) => lockMap.get(dt)?.customNightlyVnd ?? null);

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

    const platformConfig = await getPlatformFeeConfig(tx);
    let validatedPromo: ValidatedPromotionRecord | null = null;
    if (input.promotionCode?.trim()) {
      validatedPromo = await validatePromotionTx(tx, {
        code: input.promotionCode,
        nights: input.nights,
        userId: user.id,
        lockForUpdate: true,
      });
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
      businessModel: 'booking_flow',
      isPremiumMember: freshUser.membership_tier === 'premium',
      applyVatFree: input.applyVatFree,
      vatTaxId: freshUser.vat_tax_id,
      availableRewardCreditVnd: toNum(freshUser.reward_credit_vnd),
      useRewardCredit: input.useRewardCredit,
      nightOverridesVnd,
      serviceFeeRate: platformConfig.serviceFeeRate,
      vatDiscountRate: platformConfig.vatDiscountRate,
      premiumRewardRate: platformConfig.premiumRewardRate,
      promotion: validatedPromo,
    });

    if (validatedPromo) {
      await tx.query(
        `UPDATE promotions SET used_count = used_count + 1 WHERE id = $1`,
        [validatedPromo.id]
      );
    }

    const bookingId = crypto.randomUUID();
    const bookingCode = `VN-${crypto.randomInt(100000, 999999)}`;

    // Unified BookingFlow: configurable Booking & Service Fee collected online; host rate paid directly at check-in
    const unitsTotal = toNum(meta.units_total, 1);
    const paymentIntentId = `pi_vn_${crypto.randomBytes(8).toString('hex')}`;

    if (checkoutMode === 'instant') {
      await lockRoomNightsTx(tx, meta.room_id, unitsTotal, nightDates);
    } else {
      await verifyAvailabilityReadOnlyTx(tx, meta.room_id, unitsTotal, input.checkIn, checkOut);
    }

    const instantApproved = Boolean(meta.is_instant_book);
    const initialStatus =
      checkoutMode === 'instant'
        ? instantApproved
          ? 'RESERVED_LOCKED'
          : 'PENDING_HOST_APPROVAL'
        : 'PENDING_PAYMENT';

    const bookingStatus =
      checkoutMode === 'instant'
        ? instantApproved
          ? 'confirmed'
          : 'pending_approval'
        : 'pending_payment';
    const paymentStatus = checkoutMode === 'instant' ? 'paid' : 'pending';
    const payoutStatus = checkoutMode === 'instant' ? 'direct_at_checkin' : 'pending';
    const fxRateUsd = platformConfig.fxRates.USD ?? 25400;

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
        status, booking_status, stay_status, payment_status, payout_status, refund_status,
        applied_service_fee_rate, applied_host_commission_rate, applied_fx_rate_usd, currency_code,
        applied_vat_discount_rate, applied_premium_reward_rate,
        promotion_id, promotion_code, promotion_discount_vnd, promotion_funding_source, promotion_counted,
        check_in, check_out, nights, guests_count, wholesale_total_vnd,
        service_fee_vnd, vat_discount_vnd, reward_credit_used_vnd, guest_total_vnd,
        booking_fee_online_vnd, pay_at_checkin_vnd, payment_intent_id, paid_at,
        reward_credit_earned_vnd, cancellation_policy, guest_note
      ) VALUES (
        $1,$2,$3,$4,$5,$6,'booking_flow',
        $7,$8,'upcoming',$9,$10,'none',
        $11,$12,$13,'VND',$14,$15,
        $16,$17,$18,$19,$20,
        $21,$22,$23,$24,$25,
        $26,$27,$28,$29,
        $30,$31,$32,$33,
        $34,$35,$36
      )`,
      [
        bookingId,
        bookingCode,
        meta.stay_id,
        meta.room_id,
        meta.pkg_id,
        user.id,
        initialStatus,
        bookingStatus,
        paymentStatus,
        payoutStatus,
        platformConfig.serviceFeeRate,
        platformConfig.hostCommissionRate,
        fxRateUsd,
        platformConfig.vatDiscountRate,
        platformConfig.premiumRewardRate,
        validatedPromo?.id ?? null,
        validatedPromo?.code ?? null,
        quote.promotionDiscountVnd,
        validatedPromo?.fundingSource ?? 'vietnomad',
        Boolean(validatedPromo),
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

    if (input.attributionSessionKey || input.utmSource || input.utmCampaign) {
      await tx.query(
        `INSERT INTO attribution_events (
          id, session_key, user_id, event_name, stay_id, booking_id,
          utm_source, utm_medium, utm_campaign, utm_content, utm_term, landing_path,
          dedupe_key, is_internal
        ) VALUES ($1,$2,$3,'checkout_start',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [
          crypto.randomUUID(),
          input.attributionSessionKey || `bk_${bookingId}`,
          user.id,
          meta.stay_id,
          bookingId,
          input.utmSource ?? '',
          input.utmMedium ?? '',
          input.utmCampaign ?? '',
          input.utmContent ?? '',
          input.utmTerm ?? '',
          input.landingPath ?? '/',
          `checkout_start:${bookingId}`,
          user.role === 'admin',
        ]
      );
    }

    await logBookingEventTx(tx, {
      bookingId,
      actorUserId: user.id,
      actorRole: 'guest',
      eventType: checkoutMode === 'instant' ? 'booking_confirmed' : 'booking_created',
      summary:
        checkoutMode === 'instant'
          ? instantApproved
            ? `Instant booking created and locked (${input.nights} nights).`
            : `Booking request submitted awaiting host approval (${input.nights} nights).`
          : `Reservation initialized awaiting ${Math.round(platformConfig.serviceFeeRate * 100)}% online fee (${input.nights} nights).`,
    });

    if (checkoutMode === 'instant') {
      await recordBookingFinancialLedgerTx(tx, {
        bookingId,
        bookingCode,
        hostId: meta.host_id,
        guestId: user.id,
        gmvTotalVnd: quote.totalStayVnd,
        platformRevenueVnd: quote.feeOnlineVnd,
        hostPayableVnd: quote.payAtCheckinVnd,
        hostCommissionRate: platformConfig.hostCommissionRate,
        fxRateUsd,
        checkInIso: input.checkIn,
        actorUserId: user.id,
      });
      await recordBackendBookingCompletedAttributionTx(tx, {
        bookingId,
        stayId: meta.stay_id,
        guestId: user.id,
        guestRole: user.role,
      });
      await dispatchBookingLockedNotifications(tx, bookingId);
    }

    return {
      bookingId,
      bookingCode,
      status: initialStatus,
      businessModel: 'booking_flow' as const,
      paymentIntentId,
      quote,
    };
  });
}

export async function markBookingPaidInTx(
  tx: DbClient,
  bookingId: string,
  paymentMeta?: {
    provider?: string;
    referenceCode?: string;
    externalPaymentId?: string | null;
  }
) {
  const res = await tx.query<{
    id: string;
    booking_code: string;
    stay_id: string;
    guest_id: string;
    guest_role: string;
    host_id: string;
    room_id: string;
    status: string;
    check_in: string | Date;
    check_out: string | Date;
    guest_total_vnd: string | number;
    booking_fee_online_vnd: string | number;
    pay_at_checkin_vnd: string | number;
    reward_credit_used_vnd: string | number;
    reward_credit_earned_vnd: string | number;
    applied_host_commission_rate: string | number | null;
    applied_fx_rate_usd: string | number | null;
    payment_intent_id: string | null;
    units_total: number;
    is_instant_book: boolean;
  }>(
    `SELECT b.*, sr.units_total, s.is_instant_book, s.host_id, u.role AS guest_role
     FROM bookings b
     JOIN stay_rooms sr ON sr.id = b.room_id
     JOIN stays s ON s.id = b.stay_id
     JOIN users u ON u.id = b.guest_id
     WHERE b.id = $1 FOR UPDATE`,
    [bookingId]
  );

  const b = res.rows[0];
  if (!b) throw new AppError('NOT_FOUND', 'Booking not found.');
  if (b.status === 'RESERVED_LOCKED' || b.status === 'PENDING_HOST_APPROVAL') {
    return {
      bookingId: b.id,
      bookingCode: b.booking_code,
      status: b.status as 'RESERVED_LOCKED' | 'PENDING_HOST_APPROVAL',
      feePaidOnlineVnd: toNum(b.booking_fee_online_vnd),
      payAtCheckinVnd: toNum(b.pay_at_checkin_vnd),
      paymentIntentId: b.payment_intent_id,
    };
  }
  if (b.status !== 'PENDING_PAYMENT') {
    throw new AppError('CONFLICT', 'This booking does not require online payment.');
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

  const nextPaymentIntentId = paymentMeta?.externalPaymentId || b.payment_intent_id;
  const nextProvider = paymentMeta?.provider || 'sandbox';
  const nextRef = paymentMeta?.referenceCode || b.booking_code;
  const nextStatus = b.is_instant_book ? 'RESERVED_LOCKED' : 'PENDING_HOST_APPROVAL';
  const nextBookingStatus = b.is_instant_book ? 'confirmed' : 'pending_approval';

  await tx.query(
    `UPDATE bookings
     SET status = $5,
         booking_status = $6,
         payment_status = 'paid',
         payout_status = 'direct_at_checkin',
         paid_at = NOW(),
         payment_intent_id = $2,
         payment_provider = $3,
         payment_reference = $4
     WHERE id = $1`,
    [b.id, nextPaymentIntentId, nextProvider, nextRef, nextStatus, nextBookingStatus]
  );

  await recordBookingFinancialLedgerTx(tx, {
    bookingId: b.id,
    bookingCode: b.booking_code,
    hostId: b.host_id,
    guestId: b.guest_id,
    gmvTotalVnd: toNum(b.guest_total_vnd),
    platformRevenueVnd: toNum(b.booking_fee_online_vnd),
    hostPayableVnd: toNum(b.pay_at_checkin_vnd),
    hostCommissionRate: toNum(b.applied_host_commission_rate, 0),
    fxRateUsd: toNum(b.applied_fx_rate_usd, 25400),
    checkInIso,
    actorUserId: b.guest_id,
  });

  await logBookingEventTx(tx, {
    bookingId: b.id,
    actorUserId: b.guest_id,
    actorRole: 'guest',
    eventType: b.is_instant_book ? 'fee_paid_locked' : 'fee_paid_pending_host',
    summary: b.is_instant_book
      ? `Online booking fee paid (${nextProvider}); dates locked immediately.`
      : `Online booking fee paid (${nextProvider}); awaiting host confirmation.`,
  });

  await recordBackendBookingCompletedAttributionTx(tx, {
    bookingId: b.id,
    stayId: b.stay_id,
    guestId: b.guest_id,
    guestRole: b.guest_role,
  });

  await advanceHostLeadMilestoneTx(tx, {
    userId: b.host_id,
    targetStage: 'first_booking',
    summary: `Host received paid booking ${b.booking_code}`,
    actorUserId: b.guest_id,
  });

  await dispatchBookingLockedNotifications(tx, b.id);

  return {
    bookingId: b.id,
    bookingCode: b.booking_code,
    status: nextStatus as 'RESERVED_LOCKED' | 'PENDING_HOST_APPROVAL',
    feePaidOnlineVnd: toNum(b.booking_fee_online_vnd),
    payAtCheckinVnd: toNum(b.pay_at_checkin_vnd),
    paymentIntentId: nextPaymentIntentId,
  };
}

export async function confirmBookingFeePayment(user: SessionUser, bookingId: string) {
  if (!isValidUuid(bookingId)) {
    throw new AppError('VALIDATION_ERROR', 'Invalid booking id.');
  }

  return dbTransaction(async (tx) => {
    const ownerRes = await tx.query<{ guest_id: string }>(
      'SELECT guest_id FROM bookings WHERE id = $1',
      [bookingId]
    );
    const owner = ownerRes.rows[0];
    if (!owner) throw new AppError('NOT_FOUND', 'Booking not found.');
    if (owner.guest_id !== user.id && user.role !== 'admin') {
      throw new AppError('FORBIDDEN', 'You cannot pay for another member’s booking.');
    }
    return markBookingPaidInTx(tx, bookingId);
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

    await tx.query(
      `UPDATE bookings
       SET status = 'CHECKED_IN_COMPLETED',
           booking_status = 'confirmed',
           stay_status = 'checked_out',
           payout_status = 'paid'
       WHERE id = $1`,
      [b.id]
    );
    await tx.query(
      `UPDATE host_payouts
       SET status = 'paid', paid_at = NOW(), updated_at = NOW()
       WHERE booking_id = $1`,
      [b.id]
    );
    await logBookingEventTx(tx, {
      bookingId: b.id,
      actorUserId: actor.id,
      actorRole: actor.role === 'admin' ? 'admin' : 'host',
      eventType: 'checked_in_completed',
      summary: 'Host confirmed guest check-in and direct rent settlement.',
    });
    return { bookingId: b.id, status: 'CHECKED_IN_COMPLETED' as const };
  });
}

export async function respondToPendingBooking(
  actor: SessionUser,
  bookingId: string,
  decision: 'approve' | 'decline',
  note?: string
) {
  if (!isValidUuid(bookingId)) throw new AppError('VALIDATION_ERROR', 'Invalid booking id.');

  return dbTransaction(async (tx) => {
    const res = await tx.query<{
      id: string;
      booking_code: string;
      stay_id: string;
      host_id: string;
      guest_id: string;
      room_id: string;
      status: string;
      check_in: string | Date;
      check_out: string | Date;
      booking_fee_online_vnd: string | number;
      reward_credit_used_vnd: string | number;
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
    if (actor.role !== 'admin' && b.host_id !== actor.id) {
      throw new AppError('FORBIDDEN', 'Only the property host or admin can respond to this request.');
    }
    if (b.status !== 'PENDING_HOST_APPROVAL') {
      throw new AppError('CONFLICT', 'Only reservations awaiting host approval can be approved or declined.');
    }

    if (decision === 'approve') {
      await tx.query(
        `UPDATE bookings
         SET status = 'RESERVED_LOCKED',
             booking_status = 'confirmed',
             host_internal_note = CASE WHEN $2 <> '' THEN $2 ELSE host_internal_note END
         WHERE id = $1`,
        [b.id, (note ?? '').trim()]
      );
      await logBookingEventTx(tx, {
        bookingId: b.id,
        actorUserId: actor.id,
        actorRole: actor.role === 'admin' ? 'admin' : 'host',
        eventType: 'host_approved',
        summary: note?.trim()
          ? `Host approved booking request (${note.trim()}).`
          : 'Host approved booking request.',
      });
      await dispatchBookingLockedNotifications(tx, b.id);
      return { bookingId: b.id, status: 'RESERVED_LOCKED' as const };
    }

    // Decline: release locked nights, refund 12% online fee & reverse credit adjustments
    const checkInIso =
      b.check_in instanceof Date
        ? b.check_in.toISOString().slice(0, 10)
        : String(b.check_in).slice(0, 10);
    const checkOutIso =
      b.check_out instanceof Date
        ? b.check_out.toISOString().slice(0, 10)
        : String(b.check_out).slice(0, 10);
    const nightDates = enumerateStayNights(checkInIso, checkOutIso);
    for (const dt of nightDates) {
      await tx.query(
        `UPDATE room_night_locks
         SET booked_units = GREATEST(0, booked_units - 1)
         WHERE room_id = $1 AND stay_date = $2::date`,
        [b.room_id, dt]
      );
    }

    const used = toNum(b.reward_credit_used_vnd);
    const earned = toNum(b.reward_credit_earned_vnd);
    const creditDelta = used - earned;
    if (creditDelta !== 0) {
      await tx.query(
        'UPDATE users SET reward_credit_vnd = GREATEST(0, reward_credit_vnd + $1) WHERE id = $2',
        [creditDelta, b.guest_id]
      );
    }

    const feePaid = toNum(b.booking_fee_online_vnd);
    const declineNote = (note ?? '').trim() || 'Declined by host';
    await tx.query(
      `UPDATE bookings
       SET status = 'cancelled',
           booking_status = 'cancelled',
           payment_status = CASE WHEN $1 > 0 THEN 'refunded' ELSE payment_status END,
           payout_status = 'not_applicable',
           refund_status = CASE WHEN $1 > 0 THEN 'completed' ELSE 'none' END,
           refund_amount_vnd = $1,
           host_internal_note = $2,
           cancelled_at = NOW()
       WHERE id = $3`,
      [feePaid, declineNote, b.id]
    );

    if (feePaid > 0) {
      await tx.query(
        `INSERT INTO ledger_entries (
          id, entry_type, booking_id, host_id, amount_vnd, currency, fx_rate_to_vnd, description, recorded_by
        ) VALUES ($1, 'refund', $2, $3, $4, 'VND', 1, $5, $6)`,
        [
          crypto.randomUUID(),
          b.id,
          b.host_id,
          -feePaid,
          `Refunded online fee after host declined ${b.booking_code}`,
          actor.id,
        ]
      );
      await tx.query(
        `UPDATE host_payouts SET status = 'not_applicable', updated_at = NOW() WHERE booking_id = $1`,
        [b.id]
      );
    }

    await refundGatewayTransactionIfLive(tx, {
      bookingId: b.id,
      refundAmountVnd: feePaid,
    });

    await releaseBookingPromotionTx(tx, b.id);

    await logBookingEventTx(tx, {
      bookingId: b.id,
      actorUserId: actor.id,
      actorRole: actor.role === 'admin' ? 'admin' : 'host',
      eventType: 'host_declined',
      summary: `Host declined booking request (${declineNote}); online fee refunded.`,
    });

    return { bookingId: b.id, status: 'cancelled' as const, refundAmountVnd: feePaid };
  });
}

export async function updateHostBookingNote(
  actor: SessionUser,
  bookingId: string,
  hostInternalNote: string
) {
  if (!isValidUuid(bookingId)) throw new AppError('VALIDATION_ERROR', 'Invalid booking id.');
  const res = await dbQuery<{ id: string; host_id: string }>(
    `SELECT b.id, s.host_id
     FROM bookings b
     JOIN stays s ON s.id = b.stay_id
     WHERE b.id = $1`,
    [bookingId]
  );
  const b = res.rows[0];
  if (!b) throw new AppError('NOT_FOUND', 'Booking not found.');
  if (actor.role !== 'admin' && b.host_id !== actor.id) {
    throw new AppError('FORBIDDEN', 'Only the property host or admin can update notes.');
  }
  await dbQuery(`UPDATE bookings SET host_internal_note = $1 WHERE id = $2`, [
    hostInternalNote.trim().slice(0, 1500),
    bookingId,
  ]);
  return { ok: true };
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
    if (actor.role !== 'admin') {
      throw new AppError('FORBIDDEN', 'Only VietNomad admins can approve an administrative fee refund.');
    }
    if (b.status !== 'RESERVED_LOCKED' && b.status !== 'confirmed') {
      throw new AppError('CONFLICT', 'Administrative fee refund applies to active locked reservations.');
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
      reason.trim() || 'Administrative booking fee refund approved';

    await tx.query(
      `UPDATE bookings
       SET status = 'REFUNDED_WIFI_MISMATCH',
           booking_status = 'cancelled',
           payment_status = 'refunded',
           payout_status = 'not_applicable',
           refund_status = 'completed',
           refund_amount_vnd = $1,
           mismatch_reason = $2,
           cancelled_at = NOW()
       WHERE id = $3`,
      [feePaid, cleanReason, b.id]
    );

    if (feePaid > 0) {
      await tx.query(
        `INSERT INTO ledger_entries (
          id, entry_type, booking_id, host_id, amount_vnd, currency, fx_rate_to_vnd, description, recorded_by
        ) VALUES ($1, 'refund', $2, $3, $4, 'VND', 1, $5, $6)`,
        [
          crypto.randomUUID(),
          b.id,
          b.host_id,
          -feePaid,
          `Administrative refund for ${b.booking_code}: ${cleanReason}`,
          actor.id,
        ]
      );
      await tx.query(
        `UPDATE host_payouts SET status = 'not_applicable', updated_at = NOW() WHERE booking_id = $1`,
        [b.id]
      );
    }

    await tx.query(
      `INSERT INTO booking_notifications (
        id, booking_id, recipient_role, channel, recipient_contact, subject, payload_json, status
      ) VALUES ($1,$2,'guest','email','member','Administrative Booking Fee Refund Issued',$3,'sent')`,
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

    await logBookingEventTx(tx, {
      bookingId: b.id,
      actorUserId: actor.id,
      actorRole: 'admin',
      eventType: 'admin_fee_refunded',
      summary: `Admin issued booking fee refund (${cleanReason}).`,
    });

    await releaseBookingPromotionTx(tx, b.id);

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
        `UPDATE bookings
         SET status = 'cancelled',
             booking_status = 'cancelled',
             payment_status = 'unpaid',
             payout_status = 'not_applicable',
             cancelled_at = NOW()
         WHERE id = $1`,
        [b.id]
      );
      await releaseBookingPromotionTx(tx, b.id);
      await logBookingEventTx(tx, {
        bookingId: b.id,
        actorUserId: user.id,
        actorRole: 'guest',
        eventType: 'cancelled_unpaid',
        summary: 'Unpaid reservation request cancelled by guest.',
      });
      return {
        bookingId: b.id,
        tier: 'cooling_off' as const,
        refundAmountVnd: 0,
        creditIssuedVnd: 0,
      };
    }

    if (
      b.status !== 'RESERVED_LOCKED' &&
      b.status !== 'confirmed' &&
      b.status !== 'PENDING_HOST_APPROVAL'
    ) {
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

    const outcome =
      b.status === 'PENDING_HOST_APPROVAL'
        ? {
            tier: 'cooling_off' as const,
            refundAmountVnd: paidOnlineVnd,
            creditIssuedVnd: 0,
          }
        : calculateCancellationOutcome({
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
           booking_status = 'cancelled',
           payment_status = CASE WHEN $1 > 0 THEN 'refunded' ELSE payment_status END,
           payout_status = 'not_applicable',
           refund_status = CASE WHEN $1 > 0 THEN 'completed' ELSE 'none' END,
           refund_amount_vnd = $1,
           credit_issued_vnd = $2,
           cancelled_at = NOW()
       WHERE id = $3`,
      [outcome.refundAmountVnd, outcome.creditIssuedVnd, b.id]
    );

    if (outcome.refundAmountVnd > 0) {
      await tx.query(
        `INSERT INTO ledger_entries (
          id, entry_type, booking_id, amount_vnd, currency, fx_rate_to_vnd, description, recorded_by
        ) VALUES ($1, 'refund', $2, $3, 'VND', 1, $4, $5)`,
        [
          crypto.randomUUID(),
          b.id,
          -outcome.refundAmountVnd,
          `Member cancellation cooling-off refund for booking ${b.id}`,
          user.id,
        ]
      );
    }
    await tx.query(
      `UPDATE host_payouts SET status = 'not_applicable', updated_at = NOW() WHERE booking_id = $1`,
      [b.id]
    );

    await logBookingEventTx(tx, {
      bookingId: b.id,
      actorUserId: user.id,
      actorRole: 'guest',
      eventType: 'cancelled_by_guest',
      summary: `Reservation cancelled (${outcome.tier}); refund ${outcome.refundAmountVnd}₫, credit ${outcome.creditIssuedVnd}₫.`,
    });

    await refundGatewayTransactionIfLive(tx, {
      bookingId: b.id,
      refundAmountVnd: outcome.refundAmountVnd,
    });

    await releaseBookingPromotionTx(tx, b.id);

    return { bookingId: b.id, ...outcome };
  });
}

export async function getMemberDashboard(userId: string) {
  const [bookingsRes, savedRes, rsvpsRes, ticketsRes, platformConfig] = await Promise.all([
    dbQuery(
      `SELECT b.*,
              s.slug AS stay_slug, s.title_en, s.title_vi, s.hero_image,
              s.exact_address, s.checkin_instructions_en, s.checkin_instructions_vi,
              s.wifi_download_mbps, s.wifi_upload_mbps, s.wifi_jitter_ms,
              s.verification_tier, s.is_wifi_verified, s.is_work_ready,
              s.speedtest_proof_url, s.workspace_video_url,
              s.host_whatsapp,
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
    dbQuery(
      `SELECT t.*, b.booking_code, s.title_en AS stay_title_en, s.title_vi AS stay_title_vi
       FROM support_tickets t
       LEFT JOIN bookings b ON b.id = t.booking_id
       LEFT JOIN stays s ON s.id = t.stay_id
       WHERE t.guest_id = $1
       ORDER BY t.created_at DESC`,
      [userId]
    ),
    getPlatformFeeConfig(),
  ]);

  const bookingIds = bookingsRes.rows.map((r) => String(r.id));
  const ticketIds = ticketsRes.rows.map((t) => String(t.id));

  const [notifRes, refundRes, ticketMsgRes] = await Promise.all([
    bookingIds.length > 0
      ? dbQuery(
          `SELECT * FROM booking_notifications
           WHERE booking_id = ANY($1::uuid[]) AND recipient_role = 'guest'
           ORDER BY created_at DESC`,
          [bookingIds]
        )
      : Promise.resolve({ rows: [] as Record<string, unknown>[] }),
    bookingIds.length > 0
      ? dbQuery(
          `SELECT * FROM refund_requests
           WHERE booking_id = ANY($1::uuid[])
           ORDER BY created_at DESC`,
          [bookingIds]
        )
      : Promise.resolve({ rows: [] as Record<string, unknown>[] }),
    ticketIds.length > 0
      ? dbQuery(
          `SELECT m.*, u.full_name AS sender_name, u.role AS sender_role
           FROM support_ticket_messages m
           LEFT JOIN users u ON u.id = m.sender_id
           WHERE m.ticket_id = ANY($1::uuid[]) AND m.is_internal_note = FALSE
           ORDER BY m.created_at ASC`,
          [ticketIds]
        )
      : Promise.resolve({ rows: [] as Record<string, unknown>[] }),
  ]);

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

  const refundsByBooking = new Map<
    string,
    Array<{
      id: string;
      refundType: string;
      amountVnd: number;
      status: string;
      reason: string;
      decisionNote: string;
      createdAt: string;
      processedAt: string | null;
    }>
  >();
  for (const rf of refundRes.rows) {
    const bid = String(rf.booking_id);
    const list = refundsByBooking.get(bid) ?? [];
    list.push({
      id: String(rf.id),
      refundType: String(rf.refund_type),
      amountVnd: toNum(rf.amount_vnd),
      status: String(rf.status),
      reason: String(rf.reason ?? ''),
      decisionNote: String(rf.decision_note ?? ''),
      createdAt: new Date(String(rf.created_at)).toISOString(),
      processedAt: rf.processed_at ? new Date(String(rf.processed_at)).toISOString() : null,
    });
    refundsByBooking.set(bid, list);
  }

  const messagesByTicket = new Map<
    string,
    Array<{
      id: string;
      senderName: string;
      senderRole: string;
      body: string;
      attachments: string[];
      createdAt: string;
    }>
  >();
  for (const m of ticketMsgRes.rows) {
    const tid = String(m.ticket_id);
    const list = messagesByTicket.get(tid) ?? [];
    let att: string[] = [];
    if (Array.isArray(m.attachments)) att = m.attachments.map(String);
    else if (typeof m.attachments === 'string') {
      try {
        const p = JSON.parse(m.attachments);
        if (Array.isArray(p)) att = p.map(String);
      } catch {
        att = [];
      }
    }
    list.push({
      id: String(m.id),
      senderName: m.sender_name ? String(m.sender_name) : 'VietNomad Support',
      senderRole: m.sender_role ? String(m.sender_role) : 'admin',
      body: String(m.body),
      attachments: att,
      createdAt: new Date(String(m.created_at)).toISOString(),
    });
    messagesByTicket.set(tid, list);
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
        stayId: String(b.stay_id),
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
        bookingStatus: String(b.booking_status ?? 'pending_payment'),
        stayStatus: String(b.stay_status ?? 'upcoming'),
        paymentStatus: String(b.payment_status ?? 'pending'),
        payoutStatus: String(b.payout_status ?? 'pending'),
        refundStatus: String(b.refund_status ?? 'none'),
        appliedServiceFeeRate:
          b.applied_service_fee_rate !== null && b.applied_service_fee_rate !== undefined
            ? toNum(b.applied_service_fee_rate, platformConfig.serviceFeeRate)
            : platformConfig.serviceFeeRate,
        promotionCode: b.promotion_code ? String(b.promotion_code) : null,
        promotionDiscountVnd: toNum(b.promotion_discount_vnd, 0),
        promotionFundingSource: b.promotion_funding_source ? String(b.promotion_funding_source) : null,
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
        verificationTier: String(b.verification_tier ?? 'SELF_DECLARED'),
        isWifiVerified: Boolean(b.is_wifi_verified),
        isWorkReady: Boolean(b.is_work_ready),
        speedtestProofUrl: b.speedtest_proof_url ? String(b.speedtest_proof_url) : null,
        workspaceVideoUrl: b.workspace_video_url ? String(b.workspace_video_url) : null,
        hostWhatsapp: String(b.host_whatsapp ?? '+84901234567'),
        exactAddress: unlockAddress ? String(b.exact_address) : null,
        checkinInstructionsEn: unlockAddress ? String(b.checkin_instructions_en) : null,
        checkinInstructionsVi: unlockAddress ? String(b.checkin_instructions_vi) : null,
        notifications: notifByBooking.get(String(b.id)) ?? [],
        refundRequests: refundsByBooking.get(String(b.id)) ?? [],
        createdAt: new Date(String(b.created_at)).toISOString(),
      };
    }),
    supportTickets: ticketsRes.rows.map((t) => {
      let attachments: string[] = [];
      if (Array.isArray(t.attachments)) attachments = t.attachments.map(String);
      else if (typeof t.attachments === 'string') {
        try {
          const p = JSON.parse(t.attachments);
          if (Array.isArray(p)) attachments = p.map(String);
        } catch {
          attachments = [];
        }
      }
      return {
        id: String(t.id),
        ticketCode: String(t.ticket_code),
        category: String(t.category),
        issueSubCategory: String(t.issue_sub_category ?? ''),
        priority: String(t.priority),
        status: String(t.status),
        bookingId: t.booking_id ? String(t.booking_id) : null,
        bookingCode: t.booking_code ? String(t.booking_code) : null,
        stayId: t.stay_id ? String(t.stay_id) : null,
        stayTitleEn: t.stay_title_en ? String(t.stay_title_en) : null,
        stayTitleVi: t.stay_title_vi ? String(t.stay_title_vi) : null,
        subject: String(t.subject),
        description: String(t.description ?? ''),
        resolutionSummary: String(t.resolution_summary ?? ''),
        attachments,
        messages: messagesByTicket.get(String(t.id)) ?? [],
        createdAt: new Date(String(t.created_at)).toISOString(),
        updatedAt: new Date(String(t.updated_at)).toISOString(),
      };
    }),
    savedStays: savedRes.rows.map((s) => {
      const raw30 = toNum(s.wholesale_30_vnd);
      return {
        id: String(s.id),
        slug: String(s.slug),
        titleEn: String(s.title_en),
        titleVi: String(s.title_vi),
        heroImage: String(s.hero_image),
        wifiDownloadMbps: toNum(s.wifi_download_mbps),
        businessModel: 'booking_flow',
        destinationNameEn: String(s.destination_name_en),
        destinationNameVi: String(s.destination_name_vi),
        monthDisplayVnd: Math.round(raw30 * (1 + platformConfig.serviceFeeRate)),
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
