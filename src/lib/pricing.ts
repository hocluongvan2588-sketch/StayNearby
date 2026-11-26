import { AppError } from './errors';

export type PackageDuration = 7 | 14 | 21 | 30;

export interface PackagePricingInput {
  wholesale7Vnd: number;
  wholesale14Vnd: number;
  wholesale21Vnd: number;
  wholesale30Vnd: number;
  compare30Vnd?: number | null;
  extraNightVnd: number;
}

export interface QuoteBreakdown {
  nights: number;
  baseTier: PackageDuration;
  extraNights: number;
  businessModel: 'booking_flow' | 'stay_direct';
  wholesaleTotalVnd: number;
  baseBookingFeeVnd: number;
  serviceFeeVnd: number;
  vatDiscountVnd: number;
  rewardCreditUsedVnd: number;
  feeOnlineVnd: number;
  payAtCheckinVnd: number;
  totalStayVnd: number;
  guestTotalVnd: number;
  perNightDisplayVnd: number;
  weeklySavingsPct: number;
  rewardCreditEarnedVnd: number;
}

export function calculateWholesaleForNights(
  pkg: PackagePricingInput,
  nights: number
): { baseTier: PackageDuration; extraNights: number; wholesaleTotalVnd: number } {
  if (!Number.isInteger(nights) || nights < 7 || nights > 180) {
    throw new AppError(
      'VALIDATION_ERROR',
      'Minimum stay is 7 nights (up to 180 nights).'
    );
  }

  let baseTier: PackageDuration = 7;
  let baseTotal = pkg.wholesale7Vnd;

  if (nights >= 30) {
    baseTier = 30;
    baseTotal = pkg.wholesale30Vnd;
  } else if (nights >= 21) {
    baseTier = 21;
    baseTotal = pkg.wholesale21Vnd;
  } else if (nights >= 14) {
    baseTier = 14;
    baseTotal = pkg.wholesale14Vnd;
  }

  const extraNights = nights - baseTier;
  const wholesaleTotalVnd = baseTotal + extraNights * pkg.extraNightVnd;

  return { baseTier, extraNights, wholesaleTotalVnd };
}

export function calculateStayQuote(params: {
  pkg: PackagePricingInput;
  nights: number;
  businessModel: 'booking_flow' | 'stay_direct';
  isPremiumMember?: boolean;
  applyVatFree?: boolean;
  vatTaxId?: string | null;
  availableRewardCreditVnd?: number;
  useRewardCredit?: boolean;
}): QuoteBreakdown {
  const { baseTier, extraNights, wholesaleTotalVnd } = calculateWholesaleForNights(
    params.pkg,
    params.nights
  );

  // PRD 1.1:
  // P_host = wholesaleTotalVnd (paid directly to Host at check-in)
  // Fee_online = Math.round(P_host * 0.12) (12% Booking & Verification Fee paid online)
  // Total_stay = P_host + Fee_online
  const baseBookingFeeVnd =
    params.businessModel === 'booking_flow'
      ? Math.round(wholesaleTotalVnd * 0.12)
      : 0;

  const eligibleVatFree =
    params.businessModel === 'booking_flow' &&
    Boolean(params.isPremiumMember) &&
    Boolean(params.applyVatFree) &&
    Boolean(params.vatTaxId?.trim());

  // Eligible Premium Business Nomads receive 5% VAT discount off the online booking fee
  const vatDiscountVnd = eligibleVatFree ? Math.round(wholesaleTotalVnd * 0.05) : 0;
  const serviceFeeVnd = Math.max(0, baseBookingFeeVnd - vatDiscountVnd);

  // Reward credit applies directly against the online booking fee
  const rewardCreditUsedVnd =
    params.businessModel === 'booking_flow' &&
    params.useRewardCredit &&
    (params.availableRewardCreditVnd ?? 0) > 0
      ? Math.min(serviceFeeVnd, Math.round(params.availableRewardCreditVnd ?? 0))
      : 0;

  const feeOnlineVnd = Math.max(0, serviceFeeVnd - rewardCreditUsedVnd);
  const payAtCheckinVnd = wholesaleTotalVnd;
  const totalStayVnd = payAtCheckinVnd + feeOnlineVnd;
  const guestTotalVnd = totalStayVnd;
  const perNightDisplayVnd = Math.round((payAtCheckinVnd + serviceFeeVnd) / params.nights);

  // Compute monthly vs weekly per-night saving percentage ("Stay longer, pay less")
  const weekNight = params.pkg.wholesale7Vnd / 7;
  const monthNight = params.pkg.wholesale30Vnd / 30;
  const weeklySavingsPct =
    weekNight > 0 ? Math.max(0, Math.round(((weekNight - monthNight) / weekNight) * 100)) : 0;

  // Premium members earn 4% reward credit calculated against the all-inclusive booking value
  const rewardCreditEarnedVnd =
    params.businessModel === 'booking_flow' && params.isPremiumMember
      ? Math.round(totalStayVnd * 0.04)
      : 0;

  return {
    nights: params.nights,
    baseTier,
    extraNights,
    businessModel: params.businessModel,
    wholesaleTotalVnd,
    baseBookingFeeVnd,
    serviceFeeVnd,
    vatDiscountVnd,
    rewardCreditUsedVnd,
    feeOnlineVnd,
    payAtCheckinVnd,
    totalStayVnd,
    guestTotalVnd,
    perNightDisplayVnd,
    weeklySavingsPct,
    rewardCreditEarnedVnd,
  };
}

export function calculateCancellationOutcome(params: {
  policy: 'flexible' | 'moderate' | 'strict';
  guestTotalVnd: number;
  paidOnlineVnd?: number;
  nights: number;
  checkInIso: string;
  bookedAt: Date;
  now?: Date;
}): {
  tier: 'cooling_off' | 'adequate_notice' | 'restricted';
  refundAmountVnd: number;
  creditIssuedVnd: number;
} {
  const refundableBase =
    typeof params.paidOnlineVnd === 'number' && params.paidOnlineVnd >= 0
      ? params.paidOnlineVnd
      : params.guestTotalVnd;
  const now = params.now ?? new Date();
  const hoursSinceBooking = (now.getTime() - params.bookedAt.getTime()) / (1000 * 60 * 60);

  // Cooling-Off Period: within 48h of booking -> 100% cash refund of online fee (unless strict)
  if (hoursSinceBooking <= 48 && params.policy !== 'strict') {
    return {
      tier: 'cooling_off',
      refundAmountVnd: refundableBase,
      creditIssuedVnd: 0,
    };
  }

  const checkInMs = Date.parse(`${params.checkInIso}T14:00:00+07:00`);
  const hoursBeforeCheckIn = (checkInMs - now.getTime()) / (1000 * 60 * 60);

  // Adequate Notice Period:
  // - Flexible: >= 48h before check-in -> 100% Account Credit
  // - Moderate: >= booking length days before check-in -> 100% Account Credit
  const requiredNoticeHours =
    params.policy === 'flexible'
      ? 48
      : params.policy === 'moderate'
        ? params.nights * 24
        : Number.POSITIVE_INFINITY;

  if (hoursBeforeCheckIn >= requiredNoticeHours) {
    return {
      tier: 'adequate_notice',
      refundAmountVnd: 0,
      creditIssuedVnd: refundableBase,
    };
  }

  // Restricted Period
  return {
    tier: 'restricted',
    refundAmountVnd: 0,
    creditIssuedVnd: 0,
  };
}
