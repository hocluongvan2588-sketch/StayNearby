import { describe, expect, it } from 'vitest';
import {
  calculateCancellationOutcome,
  calculateStayQuote,
  calculateWholesaleForNights,
} from '@/lib/pricing';

describe('NomadStays Pricing, Extra Nights & Fee Models', () => {
  const pkg = {
    wholesale7Vnd: 5_400_000,
    wholesale14Vnd: 9_800_000,
    wholesale21Vnd: 13_860_000,
    wholesale30Vnd: 18_300_000,
    compare30Vnd: 23_000_000,
    extraNightVnd: 610_000,
  };

  it('requires minimum 7 nights and supports 7/14/21/30 + extra nights at package rate', () => {
    expect(() => calculateWholesaleForNights(pkg, 6)).toThrow();
    expect(calculateWholesaleForNights(pkg, 7)).toEqual({
      baseTier: 7,
      extraNights: 0,
      wholesaleTotalVnd: 5_400_000,
    });
    expect(calculateWholesaleForNights(pkg, 14).wholesaleTotalVnd).toBe(9_800_000);
    expect(calculateWholesaleForNights(pkg, 21).wholesaleTotalVnd).toBe(13_860_000);
    expect(calculateWholesaleForNights(pkg, 30).wholesaleTotalVnd).toBe(18_300_000);
    expect(calculateWholesaleForNights(pkg, 35)).toEqual({
      baseTier: 30,
      extraNights: 5,
      wholesaleTotalVnd: 18_300_000 + 5 * 610_000,
    });
    expect(calculateWholesaleForNights(pkg, 10)).toEqual({
      baseTier: 7,
      extraNights: 3,
      wholesaleTotalVnd: 5_400_000 + 3 * 610_000,
    });
  });

  it('computes BookingFlow quote with 12% fee, 4% member reward, and VAT-free business mode', () => {
    const standardQuote = calculateStayQuote({
      pkg,
      nights: 30,
      businessModel: 'booking_flow',
      isPremiumMember: true,
      applyVatFree: false,
      vatTaxId: 'EU-VAT-999',
      availableRewardCreditVnd: 500_000,
      useRewardCredit: true,
    });

    expect(standardQuote.wholesaleTotalVnd).toBe(18_300_000);
    expect(standardQuote.serviceFeeVnd).toBe(Math.round(18_300_000 * 0.12));
    expect(standardQuote.vatDiscountVnd).toBe(0);
    expect(standardQuote.rewardCreditUsedVnd).toBe(500_000);
    expect(standardQuote.rewardCreditEarnedVnd).toBe(
      Math.round(standardQuote.guestTotalVnd * 0.04)
    );

    const vatFreeQuote = calculateStayQuote({
      pkg,
      nights: 30,
      businessModel: 'booking_flow',
      isPremiumMember: true,
      applyVatFree: true,
      vatTaxId: 'EU-VAT-999',
      availableRewardCreditVnd: 0,
      useRewardCredit: false,
    });
    expect(vatFreeQuote.vatDiscountVnd).toBe(Math.round(18_300_000 * 0.05));
    expect(vatFreeQuote.serviceFeeVnd).toBe(
      Math.round(18_300_000 * 0.12) - Math.round(18_300_000 * 0.05)
    );
  });

  it('computes StayDirect™ quote with 0% traveler markup', () => {
    const directQuote = calculateStayQuote({
      pkg,
      nights: 14,
      businessModel: 'stay_direct',
      isPremiumMember: true,
      applyVatFree: true,
      vatTaxId: 'EU-VAT-999',
    });

    expect(directQuote.serviceFeeVnd).toBe(0);
    expect(directQuote.vatDiscountVnd).toBe(0);
    expect(directQuote.guestTotalVnd).toBe(9_800_000);
  });
});

describe('NomadStays Three-Window Cancellation Policy', () => {
  const bookedAt = new Date('2026-12-01T10:00:00Z');
  const guestTotal = 20_000_000;

  it('grants 100% refund during 48h cooling-off period for Flexible and Moderate, but not Strict', () => {
    const within24h = new Date('2026-12-02T09:00:00Z');
    const flex = calculateCancellationOutcome({
      policy: 'flexible',
      bookedAt,
      checkInIso: '2026-12-20',
      nights: 14,
      guestTotalVnd: guestTotal,
      now: within24h,
    });
    expect(flex.tier).toBe('cooling_off');
    expect(flex.refundAmountVnd).toBe(guestTotal);
    expect(flex.creditIssuedVnd).toBe(0);

    const strict = calculateCancellationOutcome({
      policy: 'strict',
      bookedAt,
      checkInIso: '2026-12-20',
      nights: 14,
      guestTotalVnd: guestTotal,
      now: within24h,
    });
    expect(strict.tier).toBe('restricted');
    expect(strict.refundAmountVnd).toBe(0);
  });

  it('grants 100% Account Credit during Adequate Notice and 0% during Restricted period', () => {
    const adequateFlex = calculateCancellationOutcome({
      policy: 'flexible',
      bookedAt,
      checkInIso: '2026-12-20',
      nights: 14,
      guestTotalVnd: guestTotal,
      now: new Date('2026-12-15T00:00:00Z'),
    });
    expect(adequateFlex.tier).toBe('adequate_notice');
    expect(adequateFlex.creditIssuedVnd).toBe(guestTotal);

    const restrictedMod = calculateCancellationOutcome({
      policy: 'moderate',
      bookedAt,
      checkInIso: '2026-12-20',
      nights: 21,
      guestTotalVnd: guestTotal,
      now: new Date('2026-12-15T00:00:00Z'),
    });
    expect(restrictedMod.tier).toBe('restricted');
    expect(restrictedMod.creditIssuedVnd).toBe(0);
    expect(restrictedMod.refundAmountVnd).toBe(0);
  });
});
