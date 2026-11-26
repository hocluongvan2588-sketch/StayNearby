import crypto from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SessionUser } from '@/lib/auth/session';
import { addDaysIso, getTodayIsoVietnam } from '@/lib/dates';
import { closeDb, dbQuery, ensureDbReady } from '@/lib/db';
import { SEED_IDS } from '@/lib/db/seed-data';
import { getAdminActorContext } from '@/modules/admin-rbac';
import {
  createPromotion,
  createRefundRequest,
  processRefundRequest,
  updateBookingByAdmin,
} from '@/modules/admin-bos';
import {
  cancelBookingByMember,
  confirmBookingFeePayment,
  createStayBooking,
  getMemberDashboard,
} from '@/modules/bookings';
import { searchStays } from '@/modules/catalog';
import { createGatewayCheckoutSession, markTransactionFailedOrExpired } from '@/modules/payments';
import { getPlatformFeeConfig, updatePlatformSetting } from '@/modules/platform-settings';
import {
  getPublicActivePromotions,
  previewBookingQuoteWithPromotion,
} from '@/modules/promotions';

let tempDir: string;

async function fetchSessionUser(userId: string): Promise<SessionUser> {
  const res = await dbQuery(
    `SELECT id, email, full_name, role, nationality, membership_tier, membership_expires_at,
            reward_credit_vnd, vat_tax_id, preferred_locale, preferred_currency, phone
     FROM users WHERE id = $1`,
    [userId]
  );
  const u = res.rows[0]!;
  return {
    id: String(u.id),
    email: String(u.email),
    fullName: String(u.full_name),
    role: u.role as SessionUser['role'],
    nationality: String(u.nationality),
    membershipTier: u.membership_tier as SessionUser['membershipTier'],
    membershipExpiresAt: u.membership_expires_at ? String(u.membership_expires_at) : null,
    rewardCreditVnd: Number(u.reward_credit_vnd),
    vatTaxId: u.vat_tax_id ? String(u.vat_tax_id) : null,
    preferredLocale: u.preferred_locale === 'vi' ? 'vi' : 'en',
    preferredCurrency: 'USD',
    phone: u.phone ? String(u.phone) : null,
  };
}

describe('Phase 1 Sync: Platform Settings, FX, Promotions & 5-Axis Member Dashboard', () => {
  beforeAll(async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'vietnomad-phase1-'));
    process.env.PGLITE_DATA_DIR = tempDir;
    process.env.VIETNOMAD_DATA_DIR = tempDir;
    process.env.DATABASE_URL = '';
    await closeDb();
    await ensureDbReady();
  });

  afterAll(async () => {
    await closeDb();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('uses platform_settings as single source of truth without mutating existing booking snapshots', async () => {
    const guest = await fetchSessionUser(SEED_IDS.users.nomadFree);
    const admin = await fetchSessionUser(SEED_IDS.users.admin);
    const actor = await getAdminActorContext(admin);

    const stayRow = await dbQuery<{
      stay_id: string;
      room_id: string;
      package_id: string;
    }>(
      `SELECT s.id AS stay_id, r.id AS room_id, p.id AS package_id
       FROM stays s
       JOIN stay_rooms r ON r.stay_id = s.id
       JOIN stay_packages p ON p.stay_id = s.id AND p.is_listed = TRUE
       WHERE s.status = 'live'
       LIMIT 1`
    );
    const target = stayRow.rows[0]!;
    const checkIn1 = addDaysIso(getTodayIsoVietnam(), 25);

    // 1. Booking under default 12% service fee
    const booking1 = await createStayBooking(guest, {
      stayId: target.stay_id,
      roomId: target.room_id,
      packageId: target.package_id,
      checkIn: checkIn1,
      nights: 7,
      guestsCount: 1,
      applyVatFree: false,
      useRewardCredit: false,
      guestNote: 'Initial 12% fee booking',
      checkoutMode: 'instant',
    });

    const b1Row = await dbQuery<{
      applied_service_fee_rate: string | number;
      booking_fee_online_vnd: string | number;
    }>(`SELECT applied_service_fee_rate, booking_fee_online_vnd FROM bookings WHERE id = $1`, [
      booking1.bookingId,
    ]);
    expect(Number(b1Row.rows[0]!.applied_service_fee_rate)).toBeCloseTo(0.12, 4);
    const originalB1Fee = Number(b1Row.rows[0]!.booking_fee_online_vnd);

    // 2. Admin raises service_fee_rate to 0.15 and updates USD FX rate
    await updatePlatformSetting(actor, 'service_fee_rate', 0.15);
    await updatePlatformSetting(actor, 'fx_rates', { VND: 1, USD: 26000, EUR: 28000 });

    const cfg = await getPlatformFeeConfig();
    expect(cfg.serviceFeeRate).toBe(0.15);
    expect(cfg.fxRates.USD).toBe(26000);

    // Catalog quote reflects 15% immediately
    const stays = await searchStays();
    const matchedStay = stays.find((s) => s.id === target.stay_id)!;
    expect(matchedStay.weekFeeOnlineVnd).toBe(
      Math.round(matchedStay.weekPayAtCheckinVnd * 0.15)
    );

    // Existing booking1 snapshot MUST stay immutable
    const b1After = await dbQuery<{
      applied_service_fee_rate: string | number;
      booking_fee_online_vnd: string | number;
    }>(`SELECT applied_service_fee_rate, booking_fee_online_vnd FROM bookings WHERE id = $1`, [
      booking1.bookingId,
    ]);
    expect(Number(b1After.rows[0]!.applied_service_fee_rate)).toBeCloseTo(0.12, 4);
    expect(Number(b1After.rows[0]!.booking_fee_online_vnd)).toBe(originalB1Fee);

    // New booking uses 15%
    const checkIn2 = addDaysIso(getTodayIsoVietnam(), 70);
    const booking2 = await createStayBooking(guest, {
      stayId: target.stay_id,
      roomId: target.room_id,
      packageId: target.package_id,
      checkIn: checkIn2,
      nights: 7,
      guestsCount: 1,
      applyVatFree: false,
      useRewardCredit: false,
      guestNote: 'New 15% fee booking',
      checkoutMode: 'instant',
    });
    const b2Row = await dbQuery<{ applied_service_fee_rate: string | number }>(
      `SELECT applied_service_fee_rate FROM bookings WHERE id = $1`,
      [booking2.bookingId]
    );
    expect(Number(b2Row.rows[0]!.applied_service_fee_rate)).toBeCloseTo(0.15, 4);

    // Restore 12% for remaining tests
    await updatePlatformSetting(actor, 'service_fee_rate', 0.12);
  });

  it('enforces promo visibility, validation, usage tracking, sponsorship split & usage restoration', async () => {
    const guest = await fetchSessionUser(SEED_IDS.users.nomadFree);
    const admin = await fetchSessionUser(SEED_IDS.users.admin);
    const actor = await getAdminActorContext(admin);

    const today = getTodayIsoVietnam();
    const nextMonth = addDaysIso(today, 45);

    // Create one public VietNomad-funded promo & one private internal promo
    await createPromotion(actor, {
      code: 'PUB14',
      name: 'Public 14N VietNomad Deal',
      discountType: 'fixed_vnd',
      discountValue: 350_000,
      minNights: 14,
      maxUses: 2,
      validFrom: today,
      validTo: nextMonth,
      isPublic: true,
      fundingSource: 'vietnomad',
      descriptionEn: 'Save 350k VND off your online booking fee',
    });

    await createPromotion(actor, {
      code: 'PRIVSECRET',
      name: 'Internal VIP Deal',
      discountType: 'fixed_vnd',
      discountValue: 500_000,
      minNights: 7,
      maxUses: 1,
      validFrom: today,
      validTo: nextMonth,
      isPublic: false,
      fundingSource: 'host',
    });

    const publicDeals = await getPublicActivePromotions();
    expect(publicDeals.some((p) => p.code === 'PUB14')).toBe(true);
    expect(publicDeals.some((p) => p.code === 'PRIVSECRET')).toBe(false);

    const stayRow = await dbQuery<{
      stay_id: string;
      room_id: string;
      package_id: string;
    }>(
      `SELECT s.id AS stay_id, r.id AS room_id, p.id AS package_id
       FROM stays s
       JOIN stay_rooms r ON r.stay_id = s.id
       JOIN stay_packages p ON p.stay_id = s.id AND p.is_listed = TRUE
       WHERE s.status = 'live'
       LIMIT 1`
    );
    const target = stayRow.rows[0]!;

    // Min nights check rejects 7 nights for PUB14
    await expect(
      previewBookingQuoteWithPromotion({
        stayId: target.stay_id,
        roomId: target.room_id,
        packageId: target.package_id,
        checkIn: addDaysIso(today, 95),
        nights: 7,
        promotionCode: 'PUB14',
        user: guest,
      })
    ).rejects.toThrow();

    // Create booking in intent mode -> locks and increments used_count to 1
    const bookingIntent = await createStayBooking(guest, {
      stayId: target.stay_id,
      roomId: target.room_id,
      packageId: target.package_id,
      checkIn: addDaysIso(today, 95),
      nights: 14,
      guestsCount: 1,
      applyVatFree: false,
      useRewardCredit: false,
      promotionCode: 'PUB14',
      guestNote: 'Promo intent test',
      checkoutMode: 'intent',
    });

    expect(bookingIntent.quote.promotionCode).toBe('PUB14');
    expect(bookingIntent.quote.promotionDiscountVnd).toBe(350_000);
    expect(bookingIntent.quote.promoFeeDiscountVnd).toBe(350_000);
    expect(bookingIntent.quote.promoHostDiscountVnd).toBe(0);

    const afterBook = await dbQuery<{ used_count: number }>(
      `SELECT used_count FROM promotions WHERE code = 'PUB14'`
    );
    expect(Number(afterBook.rows[0]!.used_count)).toBe(1);

    // Gateway checkout + payment failure restores used_count back to 0
    const tx = await createGatewayCheckoutSession(guest, {
      purpose: 'booking_fee',
      provider: 'stripe',
      bookingId: bookingIntent.bookingId,
    });
    await markTransactionFailedOrExpired({ transactionId: tx.id, nextStatus: 'failed' });

    const afterFail = await dbQuery<{ used_count: number }>(
      `SELECT used_count FROM promotions WHERE code = 'PUB14'`
    );
    expect(Number(afterFail.rows[0]!.used_count)).toBe(0);

    // Create another booking + confirm payment + cancel via Admin -> used_count returns to 0
    const bookingConfirmed = await createStayBooking(guest, {
      stayId: target.stay_id,
      roomId: target.room_id,
      packageId: target.package_id,
      checkIn: addDaysIso(today, 120),
      nights: 14,
      guestsCount: 1,
      applyVatFree: false,
      useRewardCredit: false,
      promotionCode: 'PUB14',
      guestNote: 'Promo admin cancel test',
      checkoutMode: 'intent',
    });
    await confirmBookingFeePayment(guest, bookingConfirmed.bookingId);

    const duringConfirmed = await dbQuery<{ used_count: number }>(
      `SELECT used_count FROM promotions WHERE code = 'PUB14'`
    );
    expect(Number(duringConfirmed.rows[0]!.used_count)).toBe(1);

    await updateBookingByAdmin(actor, bookingConfirmed.bookingId, {
      bookingStatus: 'cancelled',
      reason: 'Admin cancelled test',
    });

    const afterAdminCancel = await dbQuery<{ used_count: number }>(
      `SELECT used_count FROM promotions WHERE code = 'PUB14'`
    );
    expect(Number(afterAdminCancel.rows[0]!.used_count)).toBe(0);

    // Guest cancel path also restores promotion usage
    const bookingGuestCancel = await createStayBooking(guest, {
      stayId: target.stay_id,
      roomId: target.room_id,
      packageId: target.package_id,
      checkIn: addDaysIso(today, 150),
      nights: 14,
      guestsCount: 1,
      applyVatFree: false,
      useRewardCredit: false,
      promotionCode: 'PUB14',
      guestNote: 'Promo guest cancel test',
      checkoutMode: 'instant',
    });
    await cancelBookingByMember(guest, bookingGuestCancel.bookingId);
    const afterGuestCancel = await dbQuery<{ used_count: number }>(
      `SELECT used_count FROM promotions WHERE code = 'PUB14'`
    );
    expect(Number(afterGuestCancel.rows[0]!.used_count)).toBe(0);
  });

  it('exposes 5-axis lifecycle statuses & verified refund history on Member Dashboard', async () => {
    const guest = await fetchSessionUser(SEED_IDS.users.nomadFree);
    const admin = await fetchSessionUser(SEED_IDS.users.admin);
    const actor = await getAdminActorContext(admin);

    const stayRow = await dbQuery<{
      stay_id: string;
      room_id: string;
      package_id: string;
    }>(
      `SELECT s.id AS stay_id, r.id AS room_id, p.id AS package_id
       FROM stays s
       JOIN stay_rooms r ON r.stay_id = s.id
       JOIN stay_packages p ON p.stay_id = s.id AND p.is_listed = TRUE
       WHERE s.status = 'live'
       LIMIT 1`
    );
    const target = stayRow.rows[0]!;
    const booking = await createStayBooking(guest, {
      stayId: target.stay_id,
      roomId: target.room_id,
      packageId: target.package_id,
      checkIn: addDaysIso(getTodayIsoVietnam(), 180),
      nights: 7,
      guestsCount: 1,
      applyVatFree: false,
      useRewardCredit: false,
      guestNote: 'Refund history dashboard check',
      checkoutMode: 'instant',
    });

    const refundReq = await createRefundRequest(actor, {
      bookingCodeOrId: booking.bookingId,
      refundType: 'admin_goodwill',
      amountVnd: 250_000,
      reason: 'Goodwill delay credit',
    });
    await processRefundRequest(actor, refundReq.id, {
      decision: 'completed',
      decisionNote: 'Approved for 3-5 day card settlement',
    });

    const dash = await getMemberDashboard(guest.id);
    const bDash = dash.bookings.find((b) => b.id === booking.bookingId);
    expect(bDash).toBeDefined();
    expect(bDash!.bookingStatus).toBeTruthy();
    expect(bDash!.stayStatus).toBeTruthy();
    expect(bDash!.paymentStatus).toBeTruthy();
    expect(bDash!.refundStatus).toBe('completed');
    expect(bDash!.refundRequests.length).toBe(1);
    expect(bDash!.refundRequests[0]!.amountVnd).toBe(250_000);
    expect(bDash!.refundRequests[0]!.status).toBe('completed');
    expect(bDash!.refundRequests[0]!.processedAt).toBeTruthy();
    expect(bDash!.refundRequests[0]!.decisionNote).toContain('3-5 day');

    // Ensure guest cannot see someone else's bookings (strict isolation)
    const otherUserId = crypto.randomUUID();
    const otherDash = await getMemberDashboard(otherUserId);
    expect(otherDash.bookings.length).toBe(0);
    expect(otherDash.supportTickets.length).toBe(0);
  });
});
