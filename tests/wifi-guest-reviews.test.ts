import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi, type Mock } from 'vitest';
import type { SessionUser } from '@/lib/auth/session';
import { closeDb, dbQuery, ensureDbReady } from '@/lib/db';
import { createDraftStay, updateHostStayConfiguration } from '@/modules/host';
import { getStayDetailBySlug } from '@/modules/catalog';

vi.mock('@/lib/auth/session', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth/session')>();
  return { ...actual, requireUser: vi.fn() };
});

import { requireUser } from '@/lib/auth/session';
import { POST as postReview } from '@/app/api/stays/[slug]/reviews/route';

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

let staySeq = 0;
async function createStayFixture(host: SessionUser) {
  staySeq += 1;
  const stay = await createDraftStay(host, {
    titleEn: `Wifi Guest Reviews Fixture ${staySeq}`,
  });
  const row = await dbQuery<{ slug: string }>('SELECT slug FROM stays WHERE id = $1', [
    stay.id,
  ]);
  const room = await dbQuery<{ id: string }>(
    'SELECT id FROM stay_rooms WHERE stay_id = $1 ORDER BY max_guests DESC LIMIT 1',
    [stay.id]
  );
  const pkg = await dbQuery<{ id: string }>(
    'SELECT id FROM stay_packages WHERE stay_id = $1 ORDER BY wholesale_30_vnd ASC LIMIT 1',
    [stay.id]
  );
  return {
    stayId: String(stay.id),
    slug: String(row.rows[0].slug),
    roomId: String(room.rows[0].id),
    packageId: String(pkg.rows[0].id),
  };
}

async function createBooking(
  stayId: string,
  roomId: string,
  packageId: string,
  guestId: string,
  status: string
): Promise<string> {
  const id = crypto.randomUUID();
  await dbQuery(
    `INSERT INTO bookings (
       id, booking_code, stay_id, room_id, package_id, guest_id, business_model, status,
       check_in, check_out, nights, wholesale_total_vnd, guest_total_vnd, cancellation_policy
     ) VALUES ($1, $2, $3, $4, $5, $6, 'booking_flow', $7,
               '2026-11-01', '2026-11-08', 7, 1000000, 1120000, 'flexible')`,
    [id, `WIFI-GR-${id.slice(0, 8)}`, stayId, roomId, packageId, guestId, status]
  );
  return id;
}

async function insertWifiReview(
  stayId: string,
  bookingId: string,
  guestId: string,
  wifi: { speed?: number; stability?: number; work?: number },
  daysAgo = 0
): Promise<string> {
  const id = crypto.randomUUID();
  await dbQuery(
    `INSERT INTO stay_reviews (
       id, stay_id, booking_id, guest_id, rating, comment,
       wifi_speed_rating, wifi_stability_rating, wifi_work_rating, created_at
     ) VALUES ($1, $2, $3, $4, 5, 'Solid stay',
               $5, $6, $7, NOW() - ($8 || ' days')::interval)`,
    [
      id,
      stayId,
      bookingId,
      guestId,
      wifi.speed ?? null,
      wifi.stability ?? null,
      wifi.work ?? null,
      String(daysAgo),
    ]
  );
  return id;
}

beforeAll(async () => {
  tempDir = mkdtempSync(join(tmpdir(), 'vietnomad-wifi-guest-reviews-'));
  process.env.PGLITE_DATA_DIR = tempDir;
  delete process.env.DATABASE_URL;
  await ensureDbReady();
});

afterAll(async () => {
  await closeDb();
  rmSync(tempDir, { recursive: true, force: true });
});

describe('Phase A scope: guest Wi-Fi reviews + Verified by Guests', () => {
  it('migration0012 adds the4 wifi columns on stay_reviews and seeds the CMS guide', async () => {
    const cols = await dbQuery<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'stay_reviews'
         AND column_name IN ('wifi_speed_rating', 'wifi_stability_rating', 'wifi_work_rating', 'wifi_comment')
       ORDER BY column_name`
    );
    expect(cols.rows.map((r) => r.column_name)).toEqual([
      'wifi_comment',
      'wifi_speed_rating',
      'wifi_stability_rating',
      'wifi_work_rating',
    ]);

    const guide = await dbQuery<{
      status: string;
      content_type: string;
      has_en: boolean;
      has_vi: boolean;
      author_id: string | null;
    }>(
      `SELECT status, content_type,
              body_doc_en IS NOT NULL AS has_en,
              body_doc_vi IS NOT NULL AS has_vi,
              author_id
       FROM cms_contents WHERE slug = 'wifi-speed-test-guide'`
    );
    expect(guide.rows).toHaveLength(1);
    expect(guide.rows[0].status).toBe('published');
    expect(guide.rows[0].content_type).toBe('article');
    expect(guide.rows[0].has_en).toBe(true);
    expect(guide.rows[0].has_vi).toBe(true);
    // Author is stamped only when the editorial seed user already exists at
    // migration time (true in prod; fresh DBs seed afterwards → NULL).
    expect(['10000000-0000-4000-8000-000000000005', null]).toContain(
      guide.rows[0].author_id
    );
  });

  it('PATCH saves wifiTestedAt + speedtestProofUrl; changing evidence on a verified listing drops it to reverify_pending', async () => {
    const host = await fetchSessionUserByEmail('host@vietnomad.demo');
    const fx = await createStayFixture(host);

    await updateHostStayConfiguration(host, fx.stayId, {
      wifiTestedAt: '2026-11-20',
      speedtestProofUrl: 'https://speedtest.example/result/1',
    });
    let row = await dbQuery<{
      wifi_tested_at: string | null;
      speedtest_proof_url: string | null;
      wifi_status: string;
      is_wifi_verified: boolean;
    }>(
      'SELECT wifi_tested_at, speedtest_proof_url, wifi_status, is_wifi_verified FROM stays WHERE id = $1',
      [fx.stayId]
    );
    expect(new Date(String(row.rows[0].wifi_tested_at)).toISOString().slice(0, 10)).toBe('2026-11-20');
    expect(row.rows[0].speedtest_proof_url).toBe('https://speedtest.example/result/1');
    expect(row.rows[0].is_wifi_verified).toBe(false);

    // Simulate a platform-verified state, then change only the evidence.
    await dbQuery(
      `UPDATE stays
       SET is_wifi_verified = true, wifi_status = 'verified', verified_at = NOW(),
           wifi_download_mbps = 100, wifi_upload_mbps = 50, wifi_ping_ms = 10
       WHERE id = $1`,
      [fx.stayId]
    );
    await updateHostStayConfiguration(host, fx.stayId, {
      speedtestProofUrl: 'https://speedtest.example/result/2',
    });
    row = await dbQuery(
      'SELECT wifi_tested_at, speedtest_proof_url, wifi_status, is_wifi_verified FROM stays WHERE id = $1',
      [fx.stayId]
    );
    expect(row.rows[0].speedtest_proof_url).toBe('https://speedtest.example/result/2');
    expect(row.rows[0].wifi_status).toBe('reverify_pending');
    expect(row.rows[0].is_wifi_verified).toBe(false);

    // Same flip when only the test date changes.
    await dbQuery(
      `UPDATE stays SET is_wifi_verified = true, wifi_status = 'verified', verified_at = NOW()
       WHERE id = $1`,
      [fx.stayId]
    );
    await updateHostStayConfiguration(host, fx.stayId, { wifiTestedAt: '2026-11-25' });
    row = await dbQuery(
      'SELECT wifi_tested_at, wifi_status, is_wifi_verified FROM stays WHERE id = $1',
      [fx.stayId]
    );
    expect(new Date(String(row.rows[0].wifi_tested_at)).toISOString().slice(0, 10)).toBe('2026-11-25');
    expect(row.rows[0].wifi_status).toBe('reverify_pending');
    expect(row.rows[0].is_wifi_verified).toBe(false);
  });

  it('guest Wi-Fi quality + Verified by Guests: ≥5 completed bookings, avg ≥4.5, within 90 days, no severe open complaint', async () => {
    const host = await fetchSessionUserByEmail('host@vietnomad.demo');
    const guestA = await fetchSessionUserByEmail('nomad@vietnomad.demo');
    const guestB = await fetchSessionUserByEmail('premium@vietnomad.demo');
    const guestC = await fetchSessionUserByEmail('direct@vietnomad.demo');
    const fx = await createStayFixture(host);
    const guests = [guestA, guestB, guestC, guestA, guestB];

    for (const g of guests) {
      const bookingId = await createBooking(
        fx.stayId,
        fx.roomId,
        fx.packageId,
        g.id,
        'CHECKED_IN_COMPLETED'
      );
      await insertWifiReview(fx.stayId, bookingId, g.id, { speed: 5, stability: 5, work: 5 });
    }

    let detail = await getStayDetailBySlug(fx.slug);
    expect(detail).not.toBeNull();
    expect(detail!.wifiGuestReviewCount).toBe(5);
    expect(detail!.wifiGuestAvgRating).toBe(5);
    expect(detail!.wifiGuestRecentBookingCount).toBe(5);
    expect(detail!.wifiVerifiedByGuests).toBe(true);

    // Severe unresolved Wi-Fi complaint kills the badge (count unchanged).
    await dbQuery(
      `INSERT INTO support_tickets (
         id, ticket_code, category, issue_sub_category, priority, status,
         stay_id, subject, description
       ) VALUES ($1, $2, 'listing_accuracy', 'wifi_speed_mismatch', 'high', 'open',
                 $3, 'Wi-Fi far slower than declared', 'Guest reports 8 Mbps vs 120 declared.')`,
      [crypto.randomUUID(), `WIFI-TK-${Date.now()}`, fx.stayId]
    );
    detail = await getStayDetailBySlug(fx.slug);
    expect(detail!.wifiGuestReviewCount).toBe(5);
    expect(detail!.wifiVerifiedByGuests).toBe(false);

    // Resolving it restores the badge.
    await dbQuery(
      `UPDATE support_tickets SET status = 'resolved' WHERE stay_id = $1 AND category = 'listing_accuracy'`,
      [fx.stayId]
    );
    detail = await getStayDetailBySlug(fx.slug);
    expect(detail!.wifiVerifiedByGuests).toBe(true);

    // Reviews older than 90 days stop counting for the badge but keep the average.
    await dbQuery(
      `UPDATE stay_reviews SET created_at = NOW() - INTERVAL '100 days' WHERE stay_id = $1`,
      [fx.stayId]
    );
    detail = await getStayDetailBySlug(fx.slug);
    expect(detail!.wifiGuestReviewCount).toBe(5);
    expect(detail!.wifiGuestRecentBookingCount).toBe(0);
    expect(detail!.wifiVerifiedByGuests).toBe(false);
  });

  it('partial Wi-Fi ratings average only the criteria the guest gave', async () => {
    const host = await fetchSessionUserByEmail('host@vietnomad.demo');
    const guest = await fetchSessionUserByEmail('nomad@vietnomad.demo');
    const fx = await createStayFixture(host);

    const b1 = await createBooking(fx.stayId, fx.roomId, fx.packageId, guest.id, 'completed');
    await insertWifiReview(fx.stayId, b1, guest.id, { speed: 3, stability: 3, work: 3 });
    const b2 = await createBooking(fx.stayId, fx.roomId, fx.packageId, guest.id, 'completed');
    await insertWifiReview(fx.stayId, b2, guest.id, { speed: 5 });

    const detail = await getStayDetailBySlug(fx.slug);
    expect(detail!.wifiGuestReviewCount).toBe(2);
    // (3 + 5) / 2 — the second review averages only its single given criterion.
    expect(detail!.wifiGuestAvgRating).toBe(4);
    expect(detail!.wifiVerifiedByGuests).toBe(false); // only 2 bookings
  });

  it('reviews POST: wifi criteria accepted only from completed stays; skipping wifi stays available', async () => {
    const guest = await fetchSessionUserByEmail('nomad@vietnomad.demo');
    const host = await fetchSessionUserByEmail('host@vietnomad.demo');
    (requireUser as Mock).mockResolvedValue(guest);

    // Completed stay → wifi criteria accepted and persisted.
    const doneFx = await createStayFixture(host);
    const doneBooking = await createBooking(
      doneFx.stayId,
      doneFx.roomId,
      doneFx.packageId,
      guest.id,
      'CHECKED_IN_COMPLETED'
    );
    const okRes = await postReview(
      new Request('http://test.local/api/stays/x/reviews', {
        method: 'POST',
        body: JSON.stringify({
          bookingId: doneBooking,
          rating: 5,
          comment: 'Great stay, wifi was fine',
          speed: 4,
          stability: 5,
          workFromHome: 4,
          wifiComment: 'Stable for calls',
        }),
      }),
      { params: Promise.resolve({ slug: doneFx.slug }) }
    );
    expect(okRes.status).toBe(201);
    const saved = await dbQuery<{
      wifi_speed_rating: number | null;
      wifi_stability_rating: number | null;
      wifi_work_rating: number | null;
      wifi_comment: string | null;
    }>(
      `SELECT wifi_speed_rating, wifi_stability_rating, wifi_work_rating, wifi_comment
       FROM stay_reviews WHERE booking_id = $1`,
      [doneBooking]
    );
    expect(saved.rows[0]).toMatchObject({
      wifi_speed_rating: 4,
      wifi_stability_rating: 5,
      wifi_work_rating: 4,
      wifi_comment: 'Stable for calls',
    });

    // Confirmed-but-not-completed stay → any review (wifi or not) is rejected.
    const lockedFx = await createStayFixture(host);
    const lockedBooking = await createBooking(
      lockedFx.stayId,
      lockedFx.roomId,
      lockedFx.packageId,
      guest.id,
      'confirmed'
    );
    const rejected = await postReview(
      new Request('http://test.local/api/stays/x/reviews', {
        method: 'POST',
        body: JSON.stringify({
          bookingId: lockedBooking,
          rating: 4,
          comment: 'Review before completion',
          speed: 5,
        }),
      }),
      { params: Promise.resolve({ slug: lockedFx.slug }) }
    );
    expect(rejected.status).toBe(400);
    const rejectedJson = (await rejected.json()) as { ok: boolean; error: { message: string } };
    expect(rejectedJson.ok).toBe(false);
    expect(rejectedJson.error.message).toContain('completed');

    // Completed stay without wifi criteria → succeeds, wifi columns stay NULL
    // (skipping Wi-Fi is always allowed for eligible reviewers).
    const skipBooking = await createBooking(
      doneFx.stayId,
      doneFx.roomId,
      doneFx.packageId,
      guest.id,
      'completed'
    );
    const skipRes = await postReview(
      new Request('http://test.local/api/stays/x/reviews', {
        method: 'POST',
        body: JSON.stringify({
          bookingId: skipBooking,
          rating: 4,
          comment: 'Review without wifi criteria',
        }),
      }),
      { params: Promise.resolve({ slug: doneFx.slug }) }
    );
    expect(skipRes.status).toBe(201);
    const skipSaved = await dbQuery<{ wifi_speed_rating: number | null }>(
      'SELECT wifi_speed_rating FROM stay_reviews WHERE booking_id = $1',
      [skipBooking]
    );
    expect(skipSaved.rows[0].wifi_speed_rating).toBeNull();

    // The wifi-specific gate also guards the no-booking (admin) path: wifi
    // criteria without a completed booking are rejected.
    const admin = await fetchSessionUserByEmail('admin@vietnomad.demo');
    (requireUser as Mock).mockResolvedValue(admin);
    const adminGate = await postReview(
      new Request('http://test.local/api/stays/x/reviews', {
        method: 'POST',
        body: JSON.stringify({
          rating: 5,
          comment: 'Admin entry with wifi criteria',
          speed: 5,
        }),
      }),
      { params: Promise.resolve({ slug: lockedFx.slug }) }
    );
    expect(adminGate.status).toBe(400);
    const adminGateJson = (await adminGate.json()) as {
      ok: boolean;
      error: { message: string };
    };
    expect(adminGateJson.error.message).toContain('Wi-Fi ratings');
  });
});
