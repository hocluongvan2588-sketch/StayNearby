import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SessionUser } from '@/lib/auth/session';
import { closeDb, dbQuery, ensureDbReady } from '@/lib/db';
import { parseIcalBlockedDates } from '@/lib/ical';
import { getCommunityAndMarketplaceData, getStayDetailBySlug, searchStays } from '@/modules/catalog';
import {
  cancelBookingByMember,
  confirmBookingFeePayment,
  confirmCheckInCompleted,
  createStayBooking,
  refundWifiMismatch,
} from '@/modules/bookings';
import { submitHostApplication, topUpHostAdWallet } from '@/modules/host';
import { reviewHostApplication } from '@/modules/admin';
import { buildConciergeWhatsappUrl } from '@/modules/notifications';

let tempDir: string;

async function fetchSessionUserByEmail(email: string): Promise<SessionUser> {
  const res = await dbQuery(
    `SELECT id, email, full_name, role, nationality, membership_tier, membership_expires_at,
            reward_credit_vnd, vat_tax_id, preferred_locale, preferred_currency, phone
     FROM users WHERE email = $1`,
    [email]
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

beforeAll(async () => {
  tempDir = mkdtempSync(join(tmpdir(), 'vietnomad-test-'));
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

describe('VietNomad Stays PRD End-to-End PostgreSQL Workflows', () => {
  it('loads seeded Vietnam destinations, stays with verification media, and live stats', async () => {
    const stats = await getCommunityAndMarketplaceData();
    expect(stats.stats.liveStays).toBeGreaterThanOrEqual(7);
    expect(stats.stats.destinations).toBe(6);

    const daNangStays = await searchStays({ destination: 'da-nang', nights: 30, minWifiMbps: 150 });
    expect(daNangStays.length).toBeGreaterThanOrEqual(2);
    expect(daNangStays.every((s) => s.wifiDownloadMbps >= 150)).toBe(true);
    expect(daNangStays[0].monthFeeOnlineVnd).toBeGreaterThan(0);
    expect(daNangStays[0].monthPayAtCheckinVnd).toBeGreaterThan(daNangStays[0].monthFeeOnlineVnd);
    expect(daNangStays[0].verificationTier).toBe('VIETNOMAD_CERTIFIED');
  });

  it('runs PENDING_PAYMENT -> 12% Payment -> RESERVED_LOCKED -> 3 Notifications -> Check-in Completed', async () => {
    const member = await fetchSessionUserByEmail('premium@vietnomad.demo');
    const hostUser = await fetchSessionUserByEmail('host@vietnomad.demo');
    const stay = await getStayDetailBySlug('tay-ho-jade-residence-hanoi');
    expect(stay).not.toBeNull();
    expect(stay!.speedtestProofUrl).toContain('speedtest-proof');
    const room = stay!.rooms[0];
    const pkg = room.packages[0];

    const intent = await createStayBooking(member, {
      stayId: stay!.id,
      roomId: room.id,
      packageId: pkg.id,
      checkIn: '2027-02-01',
      nights: 14,
      guestsCount: 1,
      applyVatFree: true,
      checkoutMode: 'intent',
    });

    expect(intent.businessModel).toBe('booking_flow');
    expect(intent.status).toBe('PENDING_PAYMENT');
    expect(intent.paymentIntentId).toMatch(/^pi_vn_/);
    expect(intent.quote.feeOnlineVnd).toBeGreaterThan(0);
    expect(intent.quote.payAtCheckinVnd).toBe(intent.quote.wholesaleTotalVnd);

    // Step 2: Confirm 12% fee payment -> locks inventory & dispatches 3 notification channels
    const paid = await confirmBookingFeePayment(member, intent.bookingId);
    expect(paid.status).toBe('RESERVED_LOCKED');
    expect(paid.feePaidOnlineVnd).toBe(intent.quote.feeOnlineVnd);

    const notifRes = await dbQuery<{ recipient_role: string }>(
      'SELECT recipient_role FROM booking_notifications WHERE booking_id = $1 ORDER BY recipient_role',
      [intent.bookingId]
    );
    expect(notifRes.rows.map((r) => r.recipient_role)).toEqual(['admin', 'guest', 'host']);

    // Host marks check-in & direct host net payment (P_host) completed
    const checkedIn = await confirmCheckInCompleted(hostUser, intent.bookingId);
    expect(checkedIn.status).toBe('CHECKED_IN_COMPLETED');
  });

  it('allows only admins to issue a verified booking fee refund and unlocks room nights', async () => {
    const member = await fetchSessionUserByEmail('nomad@vietnomad.demo');
    const admin = await fetchSessionUserByEmail('admin@vietnomad.demo');
    const stay = await getStayDetailBySlug('tay-ho-jade-residence-hanoi');
    const room = stay!.rooms[0];
    const pkg = room.packages[0];

    const booking = await createStayBooking(member, {
      stayId: stay!.id,
      roomId: room.id,
      packageId: pkg.id,
      checkIn: '2027-04-05',
      nights: 7,
      guestsCount: 1,
      checkoutMode: 'instant',
    });
    expect(booking.status).toBe('RESERVED_LOCKED');

    await expect(
      refundWifiMismatch(member, booking.bookingId, 'Self-reported slow speed')
    ).rejects.toThrow();

    const refund = await refundWifiMismatch(
      admin,
      booking.bookingId,
      'Admin verified technical outage on check-in day'
    );
    expect(refund.status).toBe('REFUNDED_WIFI_MISMATCH');
    expect(refund.refundAmountVnd).toBe(booking.quote.feeOnlineVnd);

    const locksRes = await dbQuery<{ booked_units: number }>(
      `SELECT booked_units FROM room_night_locks WHERE room_id = $1 AND stay_date = '2027-04-05'::date`,
      [room.id]
    );
    expect(Number(locksRes.rows[0]?.booked_units ?? 0)).toBe(0);
  });

  it('supports member cancellation cooling-off refund against paidOnlineVnd', async () => {
    const member = await fetchSessionUserByEmail('nomad@vietnomad.demo');
    const stay = await getStayDetailBySlug('cam-chau-lantern-garden-villa-hoi-an');
    const room = stay!.rooms[0];
    const pkg = room.packages[0];

    const booking = await createStayBooking(member, {
      stayId: stay!.id,
      roomId: room.id,
      packageId: pkg.id,
      checkIn: '2027-05-01',
      nights: 14,
      guestsCount: 1,
      checkoutMode: 'instant',
    });

    const cancelRes = await cancelBookingByMember(member, booking.bookingId);
    expect(cancelRes.tier).toBe('cooling_off');
    expect(cancelRes.refundAmountVnd).toBe(booking.quote.feeOnlineVnd);
  });

  it('charges StayDirect™ 1% referral fee from prepaid host wallet and supports top-ups', async () => {
    const freeNomad = await fetchSessionUserByEmail('nomad@vietnomad.demo');
    const directStay = await getStayDetailBySlug('thao-dien-founders-coliving-saigon');
    expect(directStay?.businessModel).toBe('stay_direct');
    const room = directStay!.rooms[0];
    const pkg = room.packages[0];

    const directHost = await fetchSessionUserByEmail('direct@vietnomad.demo');

    const beforeRes = await dbQuery<{ balance_vnd: string | number }>(
      `SELECT balance_vnd FROM host_wallets WHERE host_id = $1`,
      [directHost.id]
    );
    const beforeBal = Number(beforeRes.rows[0]?.balance_vnd ?? 0);

    const referral = await createStayBooking(freeNomad, {
      stayId: directStay!.id,
      roomId: room.id,
      packageId: pkg.id,
      checkIn: '2027-03-01',
      nights: 14,
      guestsCount: 1,
    });

    expect(referral.businessModel).toBe('stay_direct');
    expect(referral.referralFeeChargedVnd).toBeGreaterThan(0);

    const afterRes = await dbQuery<{ balance_vnd: string | number }>(
      `SELECT balance_vnd FROM host_wallets WHERE host_id = $1`,
      [directHost.id]
    );
    const afterBal = Number(afterRes.rows[0]?.balance_vnd ?? 0);
    expect(afterBal).toBe(beforeBal - referral.referralFeeChargedVnd);

    const topped = await topUpHostAdWallet(directHost, 100);
    expect(topped.balanceVnd).toBe(afterBal + 2_540_000);
  });

  it('submits a €39 stay application and publishes a new Stay with HOST_VERIFIED tier', async () => {
    const hostUser = await fetchSessionUserByEmail('host@vietnomad.demo');
    const adminUser = await fetchSessionUserByEmail('admin@vietnomad.demo');

    const app = await submitHostApplication(hostUser, {
      businessName: 'Saigon Canal Collective',
      stayName: 'Ben Nghe River Desk House',
      destinationSlug: 'ho-chi-minh-city',
      propertyType: 'coliving',
      businessModel: 'booking_flow',
      measuredDownloadMbps: 220,
      hasKitchen: true,
      hasLaundry: true,
      hasWorkspace: true,
    });

    const reviewed = await reviewHostApplication(
      adminUser,
      app.applicationId,
      'approved',
      'Verified desk + fiber line'
    );
    expect(reviewed.status).toBe('approved');
    expect(reviewed.createdStaySlug).toBeTruthy();

    const createdStay = await getStayDetailBySlug(reviewed.createdStaySlug!);
    expect(createdStay).not.toBeNull();
    expect(createdStay!.wifiDownloadMbps).toBe(220);
    expect(createdStay!.verificationTier).toBe('HOST_VERIFIED');
  });

  it('parses RFC 5545 iCal events & formats contextual WhatsApp Concierge links', () => {
    const sampleIcs = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      'DTSTART;VALUE=DATE:20270601',
      'DTEND;VALUE=DATE:20270604',
      'SUMMARY:Reserved',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const parsedIcal = parseIcalBlockedDates(sampleIcs);
    expect(parsedIcal.blockedDates).toEqual(['2027-06-01', '2027-06-02', '2027-06-03']);
    expect(parsedIcal.ranges[0]?.summary).toBe('Reserved');

    const waUrl = buildConciergeWhatsappUrl({
      stayTitle: 'An Thuong Coastal Atelier',
      checkIn: '2027-06-01',
      nights: 30,
      locale: 'en',
    });
    expect(waUrl).toContain('https://wa.me/');
    expect(waUrl).toContain('An%20Thuong%20Coastal%20Atelier');
  });
});
