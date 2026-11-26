import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SessionUser } from '@/lib/auth/session';
import { addDaysIso, getTodayIsoVietnam } from '@/lib/dates';
import { closeDb, dbQuery, ensureDbReady } from '@/lib/db';
import { SEED_IDS } from '@/lib/db/seed-data';
import {
  assertAdminActorHasPermission,
  getAdminActorContext,
} from '@/modules/admin-rbac';
import {
  convertHostLeadToHost,
  createAdminPlace,
  createHostLead,
  createRefundRequest,
  escapeCsvCell,
  listGuestsCrm,
  moderateListing,
  processRefundRequest,
  updateBookingByAdmin,
} from '@/modules/admin-bos';
import { inviteOrAssignStaffMember } from '@/modules/admin-bos/system';
import { confirmBookingFeePayment, createStayBooking } from '@/modules/bookings';
import { getDestinationLocalPlaces } from '@/modules/catalog';
import { updatePlatformSetting } from '@/modules/platform-settings';

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

describe('Admin BOS: RBAC, 5-Axis Sync, Finance Ledger, Lead Conversion & Local Discovery', () => {
  beforeAll(async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'vietnomad-bos-test-'));
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

  it('enforces dynamic backend RBAC permissions and PII masking per role', async () => {
    const adminUser = await fetchSessionUser(SEED_IDS.users.admin);
    const superActor = await getAdminActorContext(adminUser);
    expect(superActor.roleSlug).toBe('super_admin');
    expect(superActor.hasPiiAccess).toBe(true);

    // Assign a Finance staff operator (role has no PII access & no system_roles access)
    const invited = await inviteOrAssignStaffMember(superActor, {
      email: 'finance.operator@vietnomad.test',
      fullName: 'Minh Anh Finance',
      password: 'Password123!',
      roleId: 'a1000000-0000-4000-8000-000000000007', // finance
      department: 'Finance',
      title: 'Finance Controller',
    });

    const financeUser = await fetchSessionUser(invited.userId);
    const financeActor = await getAdminActorContext(financeUser);

    await expect(
      assertAdminActorHasPermission(financeActor, 'finance_payouts', 'approve')
    ).resolves.toBeDefined();
    await expect(
      assertAdminActorHasPermission(financeActor, 'system_roles', 'edit')
    ).rejects.toThrow(/cannot perform/i);

    const maskedGuests = await listGuestsCrm(financeActor);
    const unmaskedGuests = await listGuestsCrm(superActor);
    expect(maskedGuests.length).toBeGreaterThan(0);
    expect(maskedGuests[0]!.email).toContain('***@');
    expect(unmaskedGuests[0]!.email).not.toContain('***@');
  });

  it('converts Host Acquisition leads without duplicating existing user accounts', async () => {
    const adminUser = await fetchSessionUser(SEED_IDS.users.admin);
    const superActor = await getAdminActorContext(adminUser);

    const existingHost = await fetchSessionUser(SEED_IDS.users.hostBookingFlow);

    const leadDupCheck = await createHostLead(superActor, {
      businessName: 'Existing Host Portfolio',
      contactName: 'Existing Host',
      email: existingHost.email,
      destinationSlug: 'da-nang',
      estimatedUnits: 4,
    });
    const convExisting = await convertHostLeadToHost(superActor, leadDupCheck.id);
    expect(convExisting.hostUserId).toBe(existingHost.id);
    expect(convExisting.createdNewAccount).toBe(false);

    const leadNew = await createHostLead(superActor, {
      businessName: 'My Khe Horizon Suites',
      contactName: 'Quoc Khanh',
      email: 'khanh.horizon@example.com',
      destinationSlug: 'da-nang',
      estimatedUnits: 6,
    });
    const convNew = await convertHostLeadToHost(superActor, leadNew.id);
    expect(convNew.createdNewAccount).toBe(true);
    expect(convNew.stage).toBe('onboarding');
  });

  it('uses DB-driven platform fee rates, records 5-axis statuses + ledger, and handles refunds + auto-tasks', async () => {
    const adminUser = await fetchSessionUser(SEED_IDS.users.admin);
    const superActor = await getAdminActorContext(adminUser);

    // Temporarily change fee rate to 10% in DB settings
    await updatePlatformSetting(superActor, 'service_fee_rate', 0.1, 'Test rate');

    const nomadUser = await fetchSessionUser(SEED_IDS.users.nomadFree);
    const checkIn = addDaysIso(getTodayIsoVietnam(), 25);
    const pkgRes = await dbQuery<{ id: string; stay_id: string; room_id: string }>(
      `SELECT sp.id, sp.stay_id, sp.room_id FROM stay_packages sp WHERE sp.stay_id = $1 LIMIT 1`,
      [SEED_IDS.stays.myKheAtelier]
    );
    const pkg = pkgRes.rows[0]!;

    const bookingOut = await createStayBooking(nomadUser, {
      stayId: pkg.stay_id,
      roomId: pkg.room_id,
      packageId: pkg.id,
      checkIn,
      nights: 7,
      guestsCount: 1,
      checkoutMode: 'instant',
    });

    // Restore 12% standard fee rate right away
    await updatePlatformSetting(superActor, 'service_fee_rate', 0.12, 'Restore default');

    const bSnapshot = await dbQuery<{
      applied_service_fee_rate: string | number;
      booking_status: string;
      payment_status: string;
    }>(
      `SELECT applied_service_fee_rate, booking_status, payment_status FROM bookings WHERE id = $1`,
      [bookingOut.bookingId]
    );
    expect(Number(bSnapshot.rows[0]?.applied_service_fee_rate)).toBeCloseTo(0.1, 2);

    // Pay booking fee & verify ledger + host payout + invoice created
    await confirmBookingFeePayment(nomadUser, bookingOut.bookingId);

    const ledgerRes = await dbQuery<{ count: string | number }>(
      `SELECT COUNT(*) AS count FROM ledger_entries WHERE booking_id = $1`,
      [bookingOut.bookingId]
    );
    expect(Number(ledgerRes.rows[0]?.count)).toBeGreaterThanOrEqual(2);

    const invoiceRes = await dbQuery<{ count: string | number }>(
      `SELECT COUNT(*) AS count FROM invoices WHERE booking_id = $1`,
      [bookingOut.bookingId]
    );
    expect(Number(invoiceRes.rows[0]?.count)).toBe(1);

    // Controlled 5-axis update by admin
    await updateBookingByAdmin(superActor, bookingOut.bookingId, {
      stayStatus: 'checked_in',
      disputeFlag: false,
      reason: 'Guest arrived early and checked in smoothly',
    });

    // Refund request triggers automation task & updates booking on completion
    const reqRefund = await createRefundRequest(superActor, {
      bookingCodeOrId: bookingOut.bookingCode,
      refundType: 'admin_goodwill',
      amountVnd: 200000,
      reason: 'Goodwill credit for AC maintenance',
    });

    const autoTaskRes = await dbQuery<{ id: string }>(
      `SELECT id FROM admin_tasks WHERE entity_type = 'refund' AND entity_id = $1`,
      [reqRefund.id]
    );
    expect(autoTaskRes.rows.length).toBe(1);

    await processRefundRequest(superActor, reqRefund.id, {
      decision: 'completed',
      decisionNote: 'Transferred refund to guest card',
    });

    const bAfterRefund = await dbQuery<{
      refund_status: string;
      payment_status: string;
      refund_amount_vnd: string | number;
    }>(`SELECT refund_status, payment_status, refund_amount_vnd FROM bookings WHERE id = $1`, [
      bookingOut.bookingId,
    ]);
    expect(bAfterRefund.rows[0]?.refund_status).toBe('completed');
    expect(bAfterRefund.rows[0]?.payment_status).toBe('refunded');
    expect(Number(bAfterRefund.rows[0]?.refund_amount_vnd)).toBe(200000);
  });

  it('allows listing approval without requiring Wi-Fi verification and surfaces centralized places', async () => {
    const adminUser = await fetchSessionUser(SEED_IDS.users.admin);
    const superActor = await getAdminActorContext(adminUser);

    const modOut = await moderateListing(superActor, SEED_IDS.stays.myKheAtelier, {
      status: 'live',
      isWifiVerified: false,
      isWorkReady: false,
      isFeatured: true,
      featuredRank: 1,
      moderationReason: 'Published cleanly without requiring speedtest verification',
    });
    expect(modOut.status).toBe('live');

    const createdPlace = await createAdminPlace(superActor, {
      destinationId: SEED_IDS.destinations.daNang,
      category: 'cafe',
      name: 'BOS Test Specialty Roasters',
      address: '100 Vo Nguyen Giap, Da Nang',
      descriptionEn: 'Oceanfront single-origin espresso bar.',
      isFeatured: true,
    });
    const dnPlaces = await getDestinationLocalPlaces('da-nang');
    expect(dnPlaces.some((p) => p.id === createdPlace.id)).toBe(true);

    // CSV formula injection defense check
    expect(escapeCsvCell('=HYPERLINK("http://evil.com")')).toBe(
      `"'=HYPERLINK(""http://evil.com"")"`
    );
  });
});
