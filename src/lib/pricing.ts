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
  serviceFeeVnd: number;
  vatDiscountVnd: number;
  rewardCreditUsedVnd: number;
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

  // BookingFlow: 0% host commission; traveler pays transparent 12% service & tax markup.
  // StayDirect: 0% traveler markup (retail pricing); host pays 1% wallet referral fee.
  const rawServiceFee =
    params.businessModel === 'booking_flow'
      ? Math.round(wholesaleTotalVnd * 0.12)
      : 0;

  const eligibleVatFree =
    params.businessModel === 'booking_flow' &&
    Boolean(params.isPremiumMember) &&
    Boolean(params.applyVatFree) &&
    Boolean(params.vatTaxId?.trim());

  // VAT portion (5% of wholesale) waived for eligible business nomads with Premium Pass
  const vatDiscountVnd = eligibleVatFree ? Math.round(wholesaleTotalVnd * 0.05) : 0;
  const serviceFeeVnd = Math.max(0, rawServiceFee - vatDiscountVnd);

  const subtotalBeforeCredit = wholesaleTotalVnd + serviceFeeVnd;
  const rewardCreditUsedVnd =
    params.businessModel === 'booking_flow' &&
    params.useRewardCredit &&
    (params.availableRewardCreditVnd ?? 0) > 0
      ? Math.min(subtotalBeforeCredit, Math.round(params.availableRewardCreditVnd ?? 0))
      : 0;

  const guestTotalVnd = Math.max(0, subtotalBeforeCredit - rewardCreditUsedVnd);
  const perNightDisplayVnd = Math.round(subtotalBeforeCredit / params.nights);

  // Compute monthly vs weekly per-night saving percentage ("Stay longer, pay less")
  const weekNight = params.pkg.wholesale7Vnd / 7;
  const monthNight = params.pkg.wholesale30Vnd / 30;
  const weeklySavingsPct =
    weekNight > 0 ? Math.max(0, Math.round(((weekNight - monthNight) / weekNight) * 100)) : 0;

  // Premium members earn 4% reward credit on BookingFlow stays
  const rewardCreditEarnedVnd =
    params.businessModel === 'booking_flow' && params.isPremiumMember
      ? Math.round(guestTotalVnd * 0.04)
      : 0;

  return {
    nights: params.nights,
    baseTier,
    extraNights,
    businessModel: params.businessModel,
    wholesaleTotalVnd,
    serviceFeeVnd,
    vatDiscountVnd,
    rewardCreditUsedVnd,
    guestTotalVnd,
    perNightDisplayVnd,
    weeklySavingsPct,
    rewardCreditEarnedVnd,
  };
}

export function calculateCancellationOutcome(params: {
  policy: 'flexible' | 'moderate' | 'strict';
  guestTotalVnd: number;
  nights: number;
  checkInIso: string;
  bookedAt: Date;
  now?: Date;
}): {
  tier: 'cooling_off' | 'adequate_notice' | 'restricted';
  refundAmountVnd: number;
  creditIssuedVnd: number;
} {
  const now = params.now ?? new Date();
  const hoursSinceBooking = (now.getTime() - params.bookedAt.getTime()) / (1000 * 60 * 60);

  // NomadStays Cooling-Off Period: within 48h of booking -> 100% cash refund (unless strict last-minute)
  if (hoursSinceBooking <= 48 && params.policy !== 'strict') {
    return {
      tier: 'cooling_off',
      refundAmountVnd: params.guestTotalVnd,
      creditIssuedVnd: 0,
    };
  }

  const checkInDate = new Date(`${params.checkInIso}T14:00:00+07:00`);
  const hoursUntilCheckIn = (checkInDate.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (params.policy === 'flexible' && hoursUntilCheckIn >= 48) {
    return {
      tier: 'adequate_notice',
      refundAmountVnd: 0,
      creditIssuedVnd: params.guestTotalVnd,
    };
  }

  if (params.policy === 'moderate' && hoursUntilCheckIn >= params.nights * 24) {
    return {
      tier: 'adequate_notice',
      refundAmountVnd: 0,
      creditIssuedVnd: params.guestTotalVnd,
    };
  }

  return {
    tier: 'restricted',
    refundAmountVnd: 0,
    creditIssuedVnd: 0,
  };
}
