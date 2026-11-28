/* One-off demo data for Stay Extras screenshots (safe to re-run). */
import { dbQuery, closeDb } from '@/lib/db';
import { createStayBooking } from '@/modules/bookings';
import { getStayDetailBySlug } from '@/modules/catalog';
import {
  getServiceCatalog,
  hostServiceRequestAction,
  submitGuestServiceDetails,
  upsertStayService,
  listGuestServiceRequests,
} from '@/modules/stay-extras';
import type { SessionUser } from '@/lib/auth/session';

async function user(email: string): Promise<SessionUser> {
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

async function main() {
  const member = await user('nomad@vietnomad.demo');
  const host = await user('host@vietnomad.demo');
  const stay = await getStayDetailBySlug('tay-ho-jade-residence-hanoi');
  if (!stay) throw new Error('stay missing');
  const stayRow = await dbQuery<{ id: string }>(
    `SELECT id FROM stays WHERE slug = 'tay-ho-jade-residence-hanoi'`
  );
  const stayId = String(stayRow.rows[0]!.id);

  const catalog = await getServiceCatalog();
  const byKey = new Map(catalog.map((c) => [c.key, c]));

  const motorbike = await upsertStayService(host, {
    stayId,
    catalogId: byKey.get('motorbike_rental')!.id,
    enabled: true,
    priceVnd: 180_000,
    priceUnit: 'day',
    descriptionVi: 'Honda Vision 2019, giao tại chung cư, bao bảo hiểm cơ bản.',
    descriptionEn: 'Honda Vision 2019, delivered to the building, basic insurance included.',
    conditionsVi: 'Cần bằng lái A1. Nhận xe từ 8:00–20:00.',
    leadTimeHours: 24,
    providerType: 'host',
    changeCancelVi: 'Hủy miễn phí trước 24 giờ giờ nhận xe.',
  });
  const airport = await upsertStayService(host, {
    stayId,
    catalogId: byKey.get('airport_pickup')!.id,
    enabled: true,
    priceVnd: 350_000,
    priceUnit: 'trip',
    descriptionVi: 'Đón tại sân bay Nội Bài, xe 4 chỗ, hỗ trợ hành lý.',
    descriptionEn: 'Noi Bai airport pick-up, 4-seat car, luggage help.',
    leadTimeHours: 12,
    providerType: 'third_party',
    changeCancelVi: 'Đổi giờ miễn phí trước 6 giờ.',
  });
  const cleaning = await upsertStayService(host, {
    stayId,
    catalogId: byKey.get('room_cleaning')!.id,
    enabled: true,
    priceVnd: 250_000,
    priceUnit: 'visit',
    descriptionVi: 'Dọn phòng + thay ga trong kỳ lưu trú.',
    descriptionEn: 'Room cleaning + linen change during the stay.',
    providerType: 'host',
  });
  await upsertStayService(host, {
    stayId,
    catalogId: byKey.get('coworking_pass')!.id,
    enabled: true,
    isIncluded: true,
    priceUnit: 'day',
    descriptionVi: 'Vé coworking đối tác cách 500 m — đã bao gồm cho khách dài ngày.',
    descriptionEn: 'Partner coworking pass 500 m away — included for long stays.',
    providerType: 'third_party',
  });

  // Idempotency: only create the demo booking once.
  const existing = await dbQuery<{ id: string }>(
    `SELECT id FROM bookings
     WHERE guest_id = $1 AND check_in = '2026-12-15'::date
     LIMIT 1`,
    [member.id]
  );
  let bookingId = existing.rows[0] ? String(existing.rows[0].id) : '';
  if (!bookingId) {
    const booking = await createStayBooking(member, {
      stayId,
      roomId: stay.rooms[0]!.id,
      packageId: stay.rooms[0]!.packages[0]!.id,
      checkIn: '2026-12-15',
      nights: 14,
      guestsCount: 2,
      checkoutMode: 'instant',
      extrasSelection: [
        { serviceId: motorbike.id },
        { serviceId: airport.id },
        { serviceId: cleaning.id },
      ],
    });
    bookingId = booking.bookingId;
  }

  const requests = await listGuestServiceRequests(member, bookingId);
  const bySvc = new Map(requests.map((r) => [r.stayServiceId, r]));

  // Airport → quote awaiting guest (rich screenshot state).
  const airportReq = bySvc.get(airport.id);
  if (airportReq && airportReq.status === 'pending') {
    await hostServiceRequestAction(host, airportReq.id, 'quote', {
      quotePriceVnd: 380_000,
      quoteNote: 'Xe 7 chỗ giờ cao điểm, đón tại sảnh T2.',
    });
  }
  // Cleaning → confirmed with guest details submitted.
  const cleaningReq = bySvc.get(cleaning.id);
  if (cleaningReq) {
    if (cleaningReq.status === 'pending') {
      await hostServiceRequestAction(host, cleaningReq.id, 'confirm');
    }
    await submitGuestServiceDetails(member, cleaningReq.id, {
      date: '2026-12-20',
      time: '10:00',
      frequency: '1 lần',
    }).catch(() => undefined);
  }
  // Motorbike stays pending (host has not responded yet).

  console.log(
    JSON.stringify({
      bookingId,
      motorbikeReq: bySvc.get(motorbike.id)?.status,
      airportReqStatus: (
        await listGuestServiceRequests(member, bookingId)
      ).find((r) => r.stayServiceId === airport.id)?.status,
      cleaningReqStatus: (
        await listGuestServiceRequests(member, bookingId)
      ).find((r) => r.stayServiceId === cleaning.id)?.status,
    })
  );
  await closeDb();
}

main().catch(async (e) => {
  console.error(e);
  await closeDb().catch(() => undefined);
  process.exit(1);
});
