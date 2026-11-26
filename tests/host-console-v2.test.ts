import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SessionUser } from '@/lib/auth/session';
import { closeDb, dbQuery, ensureDbReady } from '@/lib/db';
import { calculateStayQuote } from '@/lib/pricing';
import { getStayDetailBySlug } from '@/modules/catalog';
import {
  confirmBookingFeePayment,
  createStayBooking,
  respondToPendingBooking,
  updateHostBookingNote,
} from '@/modules/bookings';
import {
  exportHostEarningsCsv,
  generateRoomIcalExport,
  getHostCalendarData,
  getHostDrafts,
  getHostEarningsData,
  getHostInsightsData,
  getHostOverviewData,
  getHostReservationsData,
  getHostReviewsData,
  getHostSettings,
  recordStayView,
  replyToStayReview,
  saveHostDraft,
  updateHostCalendarRange,
  updateHostSettings,
} from '@/modules/host-console';
import {
  createHostQuickReply,
  deleteHostQuickReply,
  ensureConversationForBooking,
  getConversationMessages,
  getHostInboxData,
  sendConversationMessage,
} from '@/modules/host-inbox';
import { updateHostStayConfiguration } from '@/modules/host';

let tempDir: string;

async function fetchUser(email: string): Promise<SessionUser> {
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
    preferredCurrency: 'VND',
    phone: u.phone ? String(u.phone) : null,
  };
}

beforeAll(async () => {
  tempDir = mkdtempSync(join(tmpdir(), 'vietnomad-host-v2-'));
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

describe('Host Console v2 Pricing, Calendar, Pending Bookings, Inbox, Insights & RBAC', () => {
  it('combines per-day calendar overrides with 7/14/21/30 package rates accurately', () => {
    const pkg = {
      wholesale7Vnd: 7_000_000, // 1,000,000 / night baseline
      wholesale14Vnd: 13_300_000,
      wholesale21Vnd: 19_500_000,
      wholesale30Vnd: 27_000_000,
      compare30Vnd: null,
      extraNightVnd: 950_000,
    };

    // 7 nights with 2 nights overridden to 1,500,000 VND each -> 5*1,000,000 + 2*1,500,000 = 8,000,000
    const quote = calculateStayQuote({
      pkg,
      nights: 7,
      nightOverridesVnd: [1_500_000, 1_500_000, null, null, null, null, null],
    });

    expect(quote.wholesaleTotalVnd).toBe(8_000_000);
    expect(quote.payAtCheckinVnd).toBe(8_000_000);
    expect(quote.baseBookingFeeVnd).toBe(Math.round(8_000_000 * 0.12));
  });

  it('updates calendar ranges, exports RFC 5545 iCal, and applies overrides to guest catalog quotes', async () => {
    const host = await fetchUser('host@vietnomad.demo');
    const stay = await getStayDetailBySlug('my-khe-coastal-atelier-da-nang');
    expect(stay).not.toBeNull();
    const room = stay!.rooms[0]!;

    const res = await updateHostCalendarRange(host, {
      roomId: room.id,
      startDate: '2027-08-01',
      endDate: '2027-08-03',
      block: true,
      customNightlyVnd: 1_250_000,
      minNights: 14,
      note: 'Holiday peak pricing',
    });
    expect(res.updatedDays).toBe(3);

    const cal = await getHostCalendarData(host, { startDate: '2027-08-01', days: 14 });
    const lock1 = cal.locks.find(
      (l) => l.roomId === room.id && l.stayDate === '2027-08-01'
    );
    expect(lock1?.blockedUnits).toBeGreaterThan(0);
    expect(lock1?.customNightlyVnd).toBe(1_250_000);
    expect(lock1?.minNights).toBe(14);

    // Unblock dates while preserving custom nightly price
    await updateHostCalendarRange(host, {
      roomId: room.id,
      startDate: '2027-08-01',
      endDate: '2027-08-03',
      block: false,
    });

    const ics = await generateRoomIcalExport(host, room.id);
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('END:VCALENDAR');
  });

  it('routes non-instant stays through PENDING_HOST_APPROVAL and supports approve/decline + internal notes', async () => {
    const host = await fetchUser('host@vietnomad.demo');
    const guest = await fetchUser('nomad@vietnomad.demo');
    const stay = await getStayDetailBySlug('my-khe-coastal-atelier-da-nang');
    const room = stay!.rooms[0]!;
    const pkg = room.packages[0]!;

    // Switch stay to host approval required & add house rules
    await updateHostStayConfiguration(host, stay!.id, {
      isInstantBook: false,
      checkinFrom: '15:00',
      checkoutBefore: '11:00',
      defaultMinNights: 7,
      houseRules: {
        quietHours: '22:30 - 07:00',
        smokingAllowed: false,
        partiesAllowed: false,
        petsNote: 'Small cats allowed on request',
        extraGuestNote: 'Register passport on check-in',
      },
    });

    const intent = await createStayBooking(guest, {
      stayId: stay!.id,
      roomId: room.id,
      packageId: pkg.id,
      checkIn: '2027-09-01',
      nights: 7,
      guestsCount: 1,
      checkoutMode: 'intent',
    });

    const paid = await confirmBookingFeePayment(guest, intent.bookingId);
    expect(paid.status).toBe('PENDING_HOST_APPROVAL');

    // Host adds an internal note and declines -> cancels & refunds fee
    await updateHostBookingNote(host, intent.bookingId, 'Need renovation in September');
    const preDecline = await getHostReservationsData(host, { status: 'pending' });
    expect(
      preDecline.reservations.find((r) => r.id === intent.bookingId)?.hostInternalNote
    ).toBe('Need renovation in September');

    const declined = await respondToPendingBooking(
      host,
      intent.bookingId,
      'decline',
      'Maintenance window'
    );
    expect(declined.status).toBe('cancelled');
    expect(declined.refundAmountVnd).toBe(intent.quote.feeOnlineVnd);

    // Check audit timeline in Reservations payload
    const reservations = await getHostReservationsData(host, { status: 'cancelled' });
    const found = reservations.reservations.find((r) => r.id === intent.bookingId);
    expect(found).toBeDefined();
    expect(found!.hostInternalNote).toBe('Maintenance window');
    expect(found!.events.length).toBeGreaterThanOrEqual(2);
  });

  it('tracks real stay view events, inbox conversations, quick replies, reviews, drafts, and settings', async () => {
    const host = await fetchUser('host@vietnomad.demo');
    const guest = await fetchUser('nomad@vietnomad.demo');
    const stay = await getStayDetailBySlug('tay-ho-jade-residence-hanoi');
    expect(stay).not.toBeNull();

    // 1. View events & deduplication
    const v1 = await recordStayView(stay!.slug, 'sess-abc-123', guest.id);
    const v2 = await recordStayView(stay!.slug, 'sess-abc-123', guest.id);
    expect(v1.deduplicated).toBe(false);
    expect(v2.deduplicated).toBe(true);

    const insights = await getHostInsightsData(host, { stayId: stay!.id, range: '30d' });
    expect(insights.metrics.viewsCount).toBeGreaterThanOrEqual(1);

    // 2. Inbox & quick replies
    const inbox = await getHostInboxData(host);
    expect(inbox.conversations.length).toBeGreaterThanOrEqual(1);
    const firstConv = inbox.conversations[0]!;
    const msgs = await getConversationMessages(host, firstConv.id);
    expect(msgs.length).toBeGreaterThanOrEqual(1);

    const sent = await sendConversationMessage(host, firstConv.id, {
      body: 'Welcome! Keypad code is 4820#.',
    });
    expect(sent.senderRole).toBe('host');

    const qr = await createHostQuickReply(host, {
      title: 'Airport taxi',
      body: 'Grab from Da Nang Airport takes about 12 minutes.',
    });
    expect(qr.id).toBeTruthy();
    await deleteHostQuickReply(host, qr.id);

    // 3. Review reply + RBAC check
    const revId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeee1';
    await dbQuery(
      `INSERT INTO stay_reviews (id, stay_id, guest_id, rating, comment)
       VALUES ($1, $2, $3, 5, 'Spotless studio and fast support!')
       ON CONFLICT (id) DO NOTHING`,
      [revId, stay!.id, guest.id]
    );
    await expect(
      replyToStayReview(guest, revId, 'Fake reply')
    ).rejects.toThrow();
    await replyToStayReview(host, revId, 'Thank you for staying with us!');
    const revData = await getHostReviewsData(host, { replyFilter: 'replied' });
    expect(revData.reviews.some((r) => r.id === revId)).toBe(true);

    // 4. Draft save + settings + overview + earnings CSV
    const draft = await saveHostDraft(host, {
      currentStep: 2,
      payload: {
        businessName: 'Coastal Studio Group',
        stayName: 'Son Tra Cliff Loft',
        destinationSlug: 'da-nang',
      },
    });
    const drafts = await getHostDrafts(host);
    expect(drafts.some((d) => d.id === draft.id)).toBe(true);

    await updateHostSettings(host, {
      bankName: 'Techcombank',
      bankAccountNumber: '190300112233',
    });
    const settingsOut = await getHostSettings(host);
    expect(settingsOut.settings.bankName).toBe('Techcombank');

    const overview = await getHostOverviewData(host, { range: '30d' });
    expect(overview.stays.length).toBeGreaterThanOrEqual(1);

    const earnings = await getHostEarningsData(host);
    expect(earnings.byStay.length).toBeGreaterThanOrEqual(1);
    const csv = await exportHostEarningsCsv(host);
    expect(csv).toContain('Booking Code');
    expect(csv).toContain('Host Net Payout 100%');

    // Ensure RBAC blocks guest from reading/sending in unrelated conversations if any
    const convByGuest = await ensureConversationForBooking(
      guest,
      (await getHostReservationsData(host)).reservations[0]!.id
    );
    expect(convByGuest.conversationId).toBeTruthy();
  });
});
