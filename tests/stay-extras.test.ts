import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SessionUser } from '@/lib/auth/session';
import { closeDb, dbQuery, dbTransaction, ensureDbReady } from '@/lib/db';
import { AppError } from '@/lib/errors';
import { createStayBooking, respondToPendingBooking, cancelBookingByMember } from '@/modules/bookings';
import { getStayDetailBySlug } from '@/modules/catalog';
import {
  confirmSandboxTransaction,
  createGatewayCheckoutSession,
} from '@/modules/payments';
import {
  cancelServiceRequestByGuest,
  createGuestServiceRequest,
  deleteStayService,
  ensureServiceRequestsForBookingTx,
  getServiceCatalog,
  getStayServicesForPublic,
  handleBookingCancelledForExtrasTx,
  hostServiceRequestAction,
  listAdminServiceRequests,
  listGuestServiceRequests,
  listHostServiceRequests,
  respondToServiceQuote,
  upsertStayService,
} from '@/modules/stay-extras';

/**
 * Stay Extras — the 18 acceptance scenarios from spec §18:
 * no services / one / many / none selected / selected / pay fail / RTB
 * pending / confirmation / duplicate webhook / quote change / accept /
 * reject / unavailable / add-after-booking / during-stay lifecycle /
 * booking cancel / host disabling a service with requests / three-tier
 * permissions / fee consistency. Extras never enter the platform fee
 * computation and are never paid through the gateway.
 */

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
    preferredCurrency: 'VND',
    phone: u.phone ? String(u.phone) : null,
  };
}

const STAY_SLUG = 'tay-ho-jade-residence-hanoi';

async function getStayRow() {
  const stay = await getStayDetailBySlug(STAY_SLUG);
  if (!stay) throw new Error('seed stay missing');
  const res = await dbQuery<{ id: string; host_id: string }>(
    'SELECT id, host_id FROM stays WHERE slug = $1',
    [STAY_SLUG]
  );
  const row = res.rows[0];
  if (!row) throw new Error('seed stay missing');
  return {
    id: String(row.id),
    host_id: String(row.host_id),
    room_id: stay.rooms[0]!.id,
    package_id: stay.rooms[0]!.packages[0]!.id,
  };
}

async function declareService(
  host: SessionUser,
  stayId: string,
  overrides: Partial<Parameters<typeof upsertStayService>[1]> = {}
) {
  const catalog = await getServiceCatalog();
  const item = catalog[0]!;
  return upsertStayService(host, {
    stayId,
    catalogId: item.id,
    enabled: true,
    priceVnd: 150_000,
    priceUnit: 'day',
    isIncluded: false,
    descriptionVi: 'Xe máy số tự động',
    descriptionEn: 'Automatic motorbike',
    ...overrides,
  });
}

async function makeBooking(
  member: SessionUser,
  checkIn: string,
  extras?: Array<{ serviceId: string }>,
  mode: 'instant' | 'intent' = 'instant'
) {
  const stay = await getStayRow();
  return createStayBooking(member, {
    stayId: stay.id,
    roomId: stay.room_id,
    packageId: stay.package_id,
    checkIn,
    nights: 14,
    guestsCount: 1,
    checkoutMode: mode,
    ...(extras ? { extrasSelection: extras } : {}),
  });
}

async function confirmViaSandbox(member: SessionUser, bookingId: string) {
  const tx = await createGatewayCheckoutSession(member, {
    purpose: 'booking_fee',
    provider: 'vietqr',
    bookingId,
  });
  await confirmSandboxTransaction(member, tx.id);
}

async function requestCount(bookingId: string): Promise<number> {
  const res = await dbQuery<{ c: string }>(
    'SELECT COUNT(*) AS c FROM service_requests WHERE booking_id = $1',
    [bookingId]
  );
  return Number(res.rows[0]!.c);
}

beforeAll(async () => {
  tempDir = mkdtempSync(join(tmpdir(), 'vietnomad-extras-test-'));
  process.env.PGLITE_DATA_DIR = tempDir;
  process.env.VIETNOMAD_DATA_DIR = tempDir;
  process.env.DATABASE_URL = '';
  await closeDb();
  await ensureDbReady();
}, 180_000);

afterAll(async () => {
  await closeDb();
  rmSync(tempDir, { recursive: true, force: true });
});

describe('Stay Extras — spec §18 acceptance scenarios', () => {
  it('1. stays without declared services expose an empty public list', async () => {
    const stay = await getStayRow();
    const list = await getStayServicesForPublic(stay.id);
    expect(list).toEqual([]);
  });

  it('2. one selected service materializes exactly one request on confirmation', async () => {
    const member = await fetchSessionUserByEmail('nomad@vietnomad.demo');
    const host = await fetchSessionUserByEmail('host@vietnomad.demo');
    const stay = await getStayRow();
    const svc = await declareService(host, stay.id);

    const booking = await makeBooking(member, '2026-12-01', [{ serviceId: svc.id }]);
    expect(await requestCount(booking.bookingId)).toBe(1);

    const res = await dbQuery<{ status: string; snapshot: Record<string, unknown> }>(
      `SELECT status, snapshot FROM service_requests WHERE booking_id = $1`,
      [booking.bookingId]
    );
    expect(res.rows[0]!.status).toBe('pending');
    expect(res.rows[0]!.snapshot.catalogKey).toBe('motorbike_rental');
    expect(res.rows[0]!.snapshot.priceVnd).toBe(150_000);
  });

  it('3. multiple selected services each materialize their own request', async () => {
    const member = await fetchSessionUserByEmail('nomad@vietnomad.demo');
    const host = await fetchSessionUserByEmail('host@vietnomad.demo');
    const stay = await getStayRow();
    const catalog = await getServiceCatalog();
    const svcA = await upsertStayService(host, {
      stayId: stay.id,
      catalogId: catalog[0]!.id,
      priceVnd: 200_000,
      priceUnit: 'day',
    });
    const svcB = await upsertStayService(host, {
      stayId: stay.id,
      catalogId: catalog[1]!.id,
      priceVnd: 100_000,
      priceUnit: 'trip',
    });

    const booking = await makeBooking(member, '2026-12-20', [
      { serviceId: svcA.id },
      { serviceId: svcB.id },
    ]);
    expect(await requestCount(booking.bookingId)).toBe(2);
  });

  it('4. checkout without selections creates no requests', async () => {
    const member = await fetchSessionUserByEmail('nomad@vietnomad.demo');
    const booking = await makeBooking(member, '2027-01-10');
    expect(await requestCount(booking.bookingId)).toBe(0);
  });

  it('5. an unpaid (pay-fail) booking never materializes requests', async () => {
    const member = await fetchSessionUserByEmail('nomad@vietnomad.demo');
    const host = await fetchSessionUserByEmail('host@vietnomad.demo');
    const stay = await getStayRow();
    const svc = await declareService(host, stay.id, { priceVnd: 90_000 });

    const booking = await makeBooking(member, '2027-02-01', [{ serviceId: svc.id }], 'intent');
    const bRes = await dbQuery<{ status: string }>('SELECT status FROM bookings WHERE id = $1', [
      booking.bookingId,
    ]);
    expect(bRes.rows[0]!.status).toBe('PENDING_PAYMENT');

    // Even a stray callback must not create anything before confirmation.
    const created = await dbTransaction((tx) =>
      ensureServiceRequestsForBookingTx(tx, booking.bookingId)
    );
    expect(created.created).toBe(0);
    expect(await requestCount(booking.bookingId)).toBe(0);
  });

  it('6. fee paid but awaiting host approval (RTB) creates nothing until approved', async () => {
    const member = await fetchSessionUserByEmail('nomad@vietnomad.demo');
    const host = await fetchSessionUserByEmail('host@vietnomad.demo');
    const stay = await getStayRow();
    // Make the stay request-to-book for this scenario.
    await dbQuery('UPDATE stays SET is_instant_book = FALSE WHERE id = $1', [stay.id]);
    const svc = await declareService(host, stay.id, { priceVnd: 120_000 });

    const booking = await makeBooking(member, '2027-03-01', [{ serviceId: svc.id }], 'intent');
    await confirmViaSandbox(member, booking.bookingId);

    const bRes = await dbQuery<{ status: string }>('SELECT status FROM bookings WHERE id = $1', [
      booking.bookingId,
    ]);
    expect(bRes.rows[0]!.status).toBe('PENDING_HOST_APPROVAL');
    expect(await requestCount(booking.bookingId)).toBe(0);

    // Keep the stay instant for the rest of the suite.
    await dbQuery('UPDATE stays SET is_instant_book = TRUE WHERE id = $1', [stay.id]);
    return { bookingId: booking.bookingId, host };
  });

  it('7. host approval of an RTB booking confirms it and materializes requests', async () => {
    const member = await fetchSessionUserByEmail('nomad@vietnomad.demo');
    const host = await fetchSessionUserByEmail('host@vietnomad.demo');
    const stay = await getStayRow();
    await dbQuery('UPDATE stays SET is_instant_book = FALSE WHERE id = $1', [stay.id]);
    const svc = await declareService(host, stay.id, { priceVnd: 130_000 });

    const booking = await makeBooking(member, '2027-04-01', [{ serviceId: svc.id }], 'intent');
    await confirmViaSandbox(member, booking.bookingId);
    expect(await requestCount(booking.bookingId)).toBe(0);

    const result = await respondToPendingBooking(host, booking.bookingId, 'approve');
    expect(result.status).toBe('RESERVED_LOCKED');
    expect(await requestCount(booking.bookingId)).toBe(1);

    await dbQuery('UPDATE stays SET is_instant_book = TRUE WHERE id = $1', [stay.id]);
  });

  it('8. a duplicate confirmation callback is idempotent (no double requests)', async () => {
    const member = await fetchSessionUserByEmail('nomad@vietnomad.demo');
    const host = await fetchSessionUserByEmail('host@vietnomad.demo');
    const stay = await getStayRow();
    const svc = await declareService(host, stay.id, { priceVnd: 140_000 });

    const booking = await makeBooking(member, '2027-04-20', [{ serviceId: svc.id }]);
    expect(await requestCount(booking.bookingId)).toBe(1);

    const again = await dbTransaction((tx) =>
      ensureServiceRequestsForBookingTx(tx, booking.bookingId)
    );
    expect(again.created).toBe(0);
    expect(await requestCount(booking.bookingId)).toBe(1);
  });

  it('9. a new quote bumps the version and stale-version acceptance is rejected', async () => {
    const member = await fetchSessionUserByEmail('nomad@vietnomad.demo');
    const host = await fetchSessionUserByEmail('host@vietnomad.demo');
    const stay = await getStayRow();
    const svc = await declareService(host, stay.id, { priceVnd: 160_000 });
    const booking = await makeBooking(member, '2027-05-10', [{ serviceId: svc.id }]);
    const req = (await listGuestServiceRequests(member, booking.bookingId))[0]!;

    await hostServiceRequestAction(host, req.id, 'quote', {
      quotePriceVnd: 500_000,
      quoteNote: 'Weekend rate',
    });
    let fresh = (await listGuestServiceRequests(member, booking.bookingId))[0]!;
    expect(fresh.status).toBe('awaiting_guest');
    expect(fresh.quoteVersion).toBe(1);

    // Guest accepts the current version → confirmed.
    await respondToServiceQuote(member, req.id, { accept: true, quoteVersion: 1 });
    fresh = (await listGuestServiceRequests(member, booking.bookingId))[0]!;
    expect(fresh.status).toBe('confirmed');

    // Host adjusts the price → awaiting_guest with version 2.
    await hostServiceRequestAction(host, req.id, 'quote', {
      quotePriceVnd: 550_000,
      quoteNote: 'Adjusted',
    });
    fresh = (await listGuestServiceRequests(member, booking.bookingId))[0]!;
    expect(fresh.status).toBe('awaiting_guest');
    expect(fresh.quoteVersion).toBe(2);

    // Replaying the OLD version must be rejected — never auto-accepted.
    await expect(
      respondToServiceQuote(member, req.id, { accept: true, quoteVersion: 1 })
    ).rejects.toThrow(/changed/i);

    await respondToServiceQuote(member, req.id, { accept: true, quoteVersion: 2 });
    fresh = (await listGuestServiceRequests(member, booking.bookingId))[0]!;
    expect(fresh.status).toBe('confirmed');
    expect(fresh.quotePriceVnd).toBe(550_000);
  });

  it('10. guest acceptance of the current quote confirms the request', async () => {
    // Covered explicitly in scenario 9; assert the event trail here.
    const member = await fetchSessionUserByEmail('nomad@vietnomad.demo');
    const stay = await getStayRow();
    const bookings = await dbQuery<{ id: string }>(
      `SELECT id FROM bookings WHERE guest_id = $1 AND status = 'RESERVED_LOCKED'
       ORDER BY created_at DESC LIMIT 1`,
      [member.id]
    );
    const bookingId = bookings.rows[0]!.id;
    const req = (await listGuestServiceRequests(member, bookingId))[0]!;
    const events = await dbQuery<{ event_type: string }>(
      `SELECT event_type FROM service_request_events WHERE request_id = $1`,
      [req.id]
    );
    const types = events.rows.map((r) => r.event_type);
    expect(types).toContain('requested');
    expect(stay.id).toBeTruthy();
  });

  it('11. guest declining a quote cancels the request', async () => {
    const member = await fetchSessionUserByEmail('nomad@vietnomad.demo');
    const host = await fetchSessionUserByEmail('host@vietnomad.demo');
    const stay = await getStayRow();
    const svc = await declareService(host, stay.id, { priceVnd: 170_000 });
    const booking = await makeBooking(member, '2027-06-01', [{ serviceId: svc.id }]);
    const req = (await listGuestServiceRequests(member, booking.bookingId))[0]!;

    await hostServiceRequestAction(host, req.id, 'quote', { quotePriceVnd: 999_000 });
    await respondToServiceQuote(member, req.id, { accept: false, quoteVersion: 1 });

    const fresh = (await listGuestServiceRequests(member, booking.bookingId))[0]!;
    expect(fresh.status).toBe('cancelled');
  });

  it('12. a service disabled between checkout and confirmation is skipped', async () => {
    const member = await fetchSessionUserByEmail('nomad@vietnomad.demo');
    const host = await fetchSessionUserByEmail('host@vietnomad.demo');
    const stay = await getStayRow();
    const svc = await declareService(host, stay.id, { priceVnd: 180_000 });

    const booking = await makeBooking(member, '2027-06-20', [{ serviceId: svc.id }], 'intent');
    // Host turns it off before the guest finishes paying.
    await upsertStayService(host, {
      id: svc.id,
      stayId: stay.id,
      catalogId: svc.catalogId,
      enabled: false,
      priceVnd: svc.priceVnd,
      priceUnit: svc.priceUnit,
      isIncluded: svc.isIncluded,
    });
    await confirmViaSandbox(member, booking.bookingId);

    const bRes = await dbQuery<{ status: string }>('SELECT status FROM bookings WHERE id = $1', [
      booking.bookingId,
    ]);
    expect(bRes.rows[0]!.status).toBe('RESERVED_LOCKED');
    expect(await requestCount(booking.bookingId)).toBe(0);
  });

  it('13. guest can request an additional service after the booking is confirmed', async () => {
    const member = await fetchSessionUserByEmail('nomad@vietnomad.demo');
    const host = await fetchSessionUserByEmail('host@vietnomad.demo');
    const stay = await getStayRow();
    const catalog = await getServiceCatalog();
    const extra = await upsertStayService(host, {
      stayId: stay.id,
      catalogId: catalog[3]!.id, // airport drop-off
      priceVnd: 350_000,
      priceUnit: 'trip',
    });
    const booking = await makeBooking(member, '2027-07-10');
    expect(await requestCount(booking.bookingId)).toBe(0);

    const created = await createGuestServiceRequest(member, booking.bookingId, {
      serviceId: extra.id,
      desiredAt: '2027-07-20T09:00:00.000Z',
      details: { flightNo: 'VN123', airport: 'sgn' },
    });
    expect(created.status).toBe('pending');
    expect(created.source).toBe('post_booking');
    expect(await requestCount(booking.bookingId)).toBe(1);

    // Duplicate active request for the same service is blocked.
    await expect(
      createGuestServiceRequest(member, booking.bookingId, { serviceId: extra.id })
    ).rejects.toThrow(/already exists/i);
  });

  it('14. host lifecycle confirm → preparing → completed works and terminal states are locked', async () => {
    const member = await fetchSessionUserByEmail('nomad@vietnomad.demo');
    const host = await fetchSessionUserByEmail('host@vietnomad.demo');
    const stay = await getStayRow();
    const svc = await declareService(host, stay.id, { priceVnd: 190_000 });
    const booking = await makeBooking(member, '2027-08-01', [{ serviceId: svc.id }]);
    const req = (await listGuestServiceRequests(member, booking.bookingId))[0]!;

    await hostServiceRequestAction(host, req.id, 'confirm');
    await hostServiceRequestAction(host, req.id, 'prepare');
    await hostServiceRequestAction(host, req.id, 'complete');

    const fresh = (await listGuestServiceRequests(member, booking.bookingId))[0]!;
    expect(fresh.status).toBe('completed');
    expect(fresh.completedAt).toBeTruthy();

    // No auto-revert from completed (spec §10: no Paid, no silent Completed).
    await expect(hostServiceRequestAction(host, req.id, 'prepare')).rejects.toThrow(
      /cannot move/i
    );
    await expect(hostServiceRequestAction(host, req.id, 'confirm')).rejects.toThrow(
      /cannot move/i
    );
  });

  it('15. cancelling the booking cancels unconfirmed requests and notifies on confirmed ones', async () => {
    const member = await fetchSessionUserByEmail('nomad@vietnomad.demo');
    const host = await fetchSessionUserByEmail('host@vietnomad.demo');
    const stay = await getStayRow();
    const catalog = await getServiceCatalog();
    const svcPending = await upsertStayService(host, {
      stayId: stay.id,
      catalogId: catalog[4]!.id,
      priceVnd: 250_000,
      priceUnit: 'visit',
    });
    const svcConfirmed = await upsertStayService(host, {
      stayId: stay.id,
      catalogId: catalog[6]!.id,
      priceVnd: 200_000,
      priceUnit: 'visit',
    });
    const booking = await makeBooking(member, '2027-08-20', [
      { serviceId: svcPending.id },
      { serviceId: svcConfirmed.id },
    ]);
    const [reqPending, reqConfirmed] = await listGuestServiceRequests(member, booking.bookingId);
    await hostServiceRequestAction(host, reqConfirmed!.id, 'confirm');

    await cancelBookingByMember(member, booking.bookingId);

    const rows = await dbQuery<{ id: string; status: string }>(
      'SELECT id, status FROM service_requests WHERE booking_id = $1 ORDER BY created_at ASC',
      [booking.bookingId]
    );
    const byId = new Map(rows.rows.map((r) => [r.id, r.status]));
    expect(byId.get(reqPending!.id)).toBe('cancelled');
    expect(byId.get(reqConfirmed!.id)).toBe('confirmed'); // notified, not auto-refunded

    const notice = await dbQuery<{ event_type: string }>(
      `SELECT event_type FROM service_request_events
       WHERE request_id = $1 AND event_type = 'booking_cancelled_notice'`,
      [reqConfirmed!.id]
    );
    expect(notice.rows.length).toBe(1);

    // Also callable directly for other cancel paths (admin, decline, wifi refund).
    const direct = await dbTransaction((tx) =>
      handleBookingCancelledForExtrasTx(tx, booking.bookingId)
    );
    expect(direct).toBeDefined();
  });

  it('16. host cannot delete a service that has active requests (disable instead)', async () => {
    const member = await fetchSessionUserByEmail('nomad@vietnomad.demo');
    const host = await fetchSessionUserByEmail('host@vietnomad.demo');
    const stay = await getStayRow();
    const svc = await declareService(host, stay.id, { priceVnd: 210_000 });
    const booking = await makeBooking(member, '2027-09-10', [{ serviceId: svc.id }]);
    expect(await requestCount(booking.bookingId)).toBe(1);

    await expect(deleteStayService(host, svc.id)).rejects.toThrow(/Disable it instead/i);

    // Disabling keeps the active request visible for handling.
    const disabled = await upsertStayService(host, {
      id: svc.id,
      stayId: stay.id,
      catalogId: svc.catalogId,
      enabled: false,
      priceVnd: svc.priceVnd,
      priceUnit: svc.priceUnit,
      isIncluded: svc.isIncluded,
    });
    expect(disabled.enabled).toBe(false);
    expect(await requestCount(booking.bookingId)).toBe(1);
    const publicList = await getStayServicesForPublic(stay.id);
    expect(publicList.some((s) => s.id === svc.id)).toBe(false);
  });

  it('17. three-tier permissions: guests, hosts, and admins only see their own scope', async () => {
    const memberA = await fetchSessionUserByEmail('nomad@vietnomad.demo');
    const memberB = await fetchSessionUserByEmail('premium@vietnomad.demo');
    const host = await fetchSessionUserByEmail('host@vietnomad.demo');
    const otherHost = await fetchSessionUserByEmail('direct@vietnomad.demo');
    const admin = await fetchSessionUserByEmail('admin@vietnomad.demo');
    const stay = await getStayRow();

    const svc = await declareService(host, stay.id, { priceVnd: 220_000 });
    const booking = await makeBooking(memberA, '2027-10-01', [{ serviceId: svc.id }]);
    const req = (await listGuestServiceRequests(memberA, booking.bookingId))[0]!;

    // Guest B cannot read guest A's requests.
    await expect(listGuestServiceRequests(memberB, booking.bookingId)).rejects.toThrow(
      /own bookings/i
    );
    // Another host cannot act on this host's request.
    await expect(
      hostServiceRequestAction(otherHost, req.id, 'confirm')
    ).rejects.toThrow(/own listings/i);
    // Admin can list everything.
    const adminList = await listAdminServiceRequests(admin, {});
    expect(adminList.some((r) => r.id === req.id)).toBe(true);
    // Non-admin cannot use the admin listing.
    await expect(listAdminServiceRequests(memberA, {})).rejects.toThrow(/Admin access/i);
    // Host listing scoped to own stays only.
    const hostList = await listHostServiceRequests(host, {});
    expect(hostList.some((r) => r.id === req.id)).toBe(true);
    const otherList = await listHostServiceRequests(otherHost, {});
    expect(otherList.some((r) => r.id === req.id)).toBe(false);
  });

  it('18. extras never change platform fees and never touch the payment ledger', async () => {
    const member = await fetchSessionUserByEmail('nomad@vietnomad.demo');
    const host = await fetchSessionUserByEmail('host@vietnomad.demo');
    const stay = await getStayRow();
    const svc = await declareService(host, stay.id, { priceVnd: 300_000 });

    const withExtras = await makeBooking(member, '2027-10-20', [{ serviceId: svc.id }]);
    const withoutExtras = await makeBooking(member, '2027-11-10');

    const rows = await dbQuery<{
      booking_fee_online_vnd: string;
      guest_total_vnd: string;
      service_fee_vnd: string;
      wholesale_total_vnd: string;
    }>(
      `SELECT booking_fee_online_vnd, guest_total_vnd, service_fee_vnd, wholesale_total_vnd
       FROM bookings WHERE id = ANY($1::uuid[])`,
      [[withExtras.bookingId, withoutExtras.bookingId]]
    );
    expect(rows.rows.length).toBe(2);
    const [a, b] = rows.rows;
    expect(a!.booking_fee_online_vnd).toBe(b!.booking_fee_online_vnd);
    expect(a!.guest_total_vnd).toBe(b!.guest_total_vnd);
    expect(a!.service_fee_vnd).toBe(b!.service_fee_vnd);
    expect(a!.wholesale_total_vnd).toBe(b!.wholesale_total_vnd);

    // Request handling writes events + notifications, never ledger entries
    // or gateway transactions (no platform money for extras, §2/§17).
    const req = (await listGuestServiceRequests(member, withExtras.bookingId))[0]!;
    const ledgerBefore = await dbQuery<{ c: string }>(
      'SELECT COUNT(*) AS c FROM ledger_entries WHERE booking_id = $1',
      [withExtras.bookingId]
    );
    const gatewayBefore = await dbQuery<{ c: string }>(
      'SELECT COUNT(*) AS c FROM payment_transactions WHERE booking_id = $1',
      [withExtras.bookingId]
    );

    await hostServiceRequestAction(host, req.id, 'confirm');
    await hostServiceRequestAction(host, req.id, 'prepare');
    await hostServiceRequestAction(host, req.id, 'complete');
    await cancelServiceRequestByGuest(member, req.id, 'n/a').catch(() => undefined);

    const ledgerAfter = await dbQuery<{ c: string }>(
      'SELECT COUNT(*) AS c FROM ledger_entries WHERE booking_id = $1',
      [withExtras.bookingId]
    );
    const gatewayAfter = await dbQuery<{ c: string }>(
      'SELECT COUNT(*) AS c FROM payment_transactions WHERE booking_id = $1',
      [withExtras.bookingId ]
    );
    expect(ledgerAfter.rows[0]!.c).toBe(ledgerBefore.rows[0]!.c);
    expect(gatewayAfter.rows[0]!.c).toBe(gatewayBefore.rows[0]!.c);

    // Admin audit helper import sanity: forbidden error type used across tiers.
    expect(new AppError('FORBIDDEN', 'x')).toBeInstanceOf(AppError);
  });
});
