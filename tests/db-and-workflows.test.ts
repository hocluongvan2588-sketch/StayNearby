import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SessionUser } from '@/lib/auth/session';
import { closeDb, dbQuery, ensureDbReady } from '@/lib/db';
import { parseIcalBlockedDates } from '@/lib/ical';
import { getStayDetailBySlug, searchStays } from '@/modules/catalog';
import {
  cancelBookingByMember,
  confirmBookingFeePayment,
  confirmCheckInCompleted,
  createStayBooking,
  refundWifiMismatch,
} from '@/modules/bookings';
import { submitHostApplication } from '@/modules/host';
import { reviewHostApplication, updateAdminStayVerification } from '@/modules/admin';
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
    const statsRes = await dbQuery<{ stays: string; destinations: string }>(
      `SELECT
         (SELECT COUNT(*) FROM stays WHERE status = 'live') AS stays,
         (SELECT COUNT(*) FROM destinations) AS destinations`
    );
    expect(Number(statsRes.rows[0]!.stays)).toBeGreaterThanOrEqual(7);
    expect(Number(statsRes.rows[0]!.destinations)).toBe(6);

    const daNangStays = await searchStays({ destination: 'da-nang', nights: 30, minWifiMbps: 150 });
    expect(daNangStays.length).toBeGreaterThanOrEqual(2);
    expect(daNangStays.every((s) => (s.wifiDownloadMbps ?? -1) >= 150)).toBe(true);
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

  it('unifies all 10 stays on BookingFlow and supports optional Wi-Fi Verified & Work-Ready filters', async () => {
    const allStays = await searchStays({ nights: 30 });
    expect(allStays.length).toBe(10);
    expect(allStays.every((s) => s.businessModel === 'booking_flow')).toBe(true);

    const saigonColiving = await getStayDetailBySlug('thao-dien-founders-coliving-saigon');
    const phuQuocVilla = await getStayDetailBySlug('phu-quoc-emerald-bay-work-villa');
    expect(saigonColiving?.businessModel).toBe('booking_flow');
    expect(phuQuocVilla?.businessModel).toBe('booking_flow');
    expect(phuQuocVilla?.isWifiVerified).toBe(false);
    expect(phuQuocVilla?.isWorkReady).toBe(false);

    const verifiedOnly = await searchStays({ wifiVerifiedOnly: true });
    expect(verifiedOnly.every((s) => s.isWifiVerified)).toBe(true);
    expect(verifiedOnly.length).toBeLessThan(allStays.length);

    const workReadyOnly = await searchStays({ workReadyOnly: true });
    expect(workReadyOnly.every((s) => s.isWorkReady)).toBe(true);
    expect(workReadyOnly.length).toBeLessThan(allStays.length);
  });

  it('submits a free (€0) stay application without mandatory hardware gates and lets Admin toggle badges', async () => {
    const hostUser = await fetchSessionUserByEmail('host@vietnomad.demo');
    const adminUser = await fetchSessionUserByEmail('admin@vietnomad.demo');

    const app = await submitHostApplication(hostUser, {
      businessName: 'Saigon Canal Collective',
      stayName: 'Ben Nghe River Loft',
      destinationSlug: 'ho-chi-minh-city',
      propertyType: 'apartment',
      measuredDownloadMbps: 120,
      hasKitchen: false,
      hasLaundry: false,
      hasWorkspace: false,
      kitchenType: 'none',
      laundryType: 'none',
    });

    const staysBefore = await dbQuery('SELECT id FROM stays WHERE host_id = $1', [hostUser.id]);
    const reviewed = await reviewHostApplication(
      adminUser,
      app.applicationId,
      'approved',
      'Free listing approved for launch'
    );
    // Phase 5: application approval = lead CRM only — no stay is created.
    expect(reviewed.status).toBe('approved');
    expect(reviewed.createdStaySlug).toBeNull();

    const staysAfter = await dbQuery('SELECT id FROM stays WHERE host_id = $1', [hostUser.id]);
    expect(staysAfter.rows.length).toBe(staysBefore.rows.length);

    const appRow = await dbQuery<{ status: string; created_stay_id: string | null }>(
      'SELECT status, created_stay_id FROM host_applications WHERE id = $1',
      [app.applicationId]
    );
    expect(appRow.rows[0]!.status).toBe('approved');
    expect(appRow.rows[0]!.created_stay_id).toBeNull();

    // Admin optionally grants Wi-Fi Verified badge later (existing live listing —
    // verification stays an admin badge action independent of applications)
    const target = await getStayDetailBySlug('phu-quoc-emerald-bay-work-villa');
    expect(target).not.toBeNull();
    expect(target!.isWifiVerified).toBe(false);
    await updateAdminStayVerification(adminUser, target!.id, {
      isWifiVerified: true,
      isWorkReady: false,
    });
    const updatedStay = await getStayDetailBySlug('phu-quoc-emerald-bay-work-villa');
    expect(updatedStay!.isWifiVerified).toBe(true);
    expect(updatedStay!.isWorkReady).toBe(false);
    expect(updatedStay!.verificationTier).toBe('HOST_VERIFIED');
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
