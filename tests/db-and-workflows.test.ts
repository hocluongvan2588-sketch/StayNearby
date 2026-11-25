import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SessionUser } from '@/lib/auth/session';
import { closeDb, dbQuery, ensureDbReady } from '@/lib/db';
import { getCommunityAndMarketplaceData, getStayDetailBySlug, searchStays } from '@/modules/catalog';
import { cancelBookingByMember, createStayBooking } from '@/modules/bookings';
import { submitHostApplication, topUpHostAdWallet } from '@/modules/host';
import { reviewHostApplication } from '@/modules/admin';

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

describe('VietNomad Stays End-to-End PostgreSQL Domain Workflows', () => {
  it('loads seeded Vietnam destinations, stays, and live stats', async () => {
    const stats = await getCommunityAndMarketplaceData();
    expect(stats.stats.liveStays).toBeGreaterThanOrEqual(7);
    expect(stats.stats.destinations).toBe(6);

    const daNangStays = await searchStays({ destination: 'da-nang', nights: 30, minWifiMbps: 150 });
    expect(daNangStays.length).toBeGreaterThanOrEqual(2);
    expect(daNangStays.every((s) => s.wifiDownloadMbps >= 150)).toBe(true);
  });

  it('creates an atomic BookingFlow instant booking, locks room nights, and cancels with cooling-off refund', async () => {
    const member = await fetchSessionUserByEmail('premium@vietnomad.demo');
    const stay = await getStayDetailBySlug('tay-ho-jade-residence-hanoi');
    expect(stay).not.toBeNull();
    const room = stay!.rooms[0];
    const pkg = room.packages[0];

    const result = await createStayBooking(member, {
      stayId: stay!.id,
      roomId: room.id,
      packageId: pkg.id,
      checkIn: '2027-02-01',
      nights: 14,
      guestsCount: 1,
      applyVatFree: true,
    });

    expect(result.businessModel).toBe('booking_flow');
    expect(result.bookingCode).toMatch(/^VN-/);
    expect(result.quote.guestTotalVnd).toBeGreaterThan(0);

    // Immediate cancellation within 48h qualifies for Cooling-Off 100% refund
    const cancelRes = await cancelBookingByMember(member, result.bookingId);
    expect(cancelRes.tier).toBe('cooling_off');
    expect(cancelRes.refundAmountVnd).toBe(result.quote.guestTotalVnd);
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

    // Host top-up $100 adds 2,540,000 VND
    const topped = await topUpHostAdWallet(directHost, 100);
    expect(topped.balanceVnd).toBe(afterBal + 2_540_000);
  });

  it('submits a €39 stay application and publishes a new Stay when Admin approves', async () => {
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
  });
});
