import crypto from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SessionUser } from '@/lib/auth/session';
import { hashPassword } from '@/lib/auth/password';
import { addDaysIso, getTodayIsoVietnam } from '@/lib/dates';
import { closeDb, dbQuery, ensureDbReady } from '@/lib/db';
import { SEED_IDS } from '@/lib/db/seed-data';
import { reviewHostApplication } from '@/modules/admin';
import { getAdminActorContext } from '@/modules/admin-rbac';
import {
  createHostLead,
  listHostLeads,
  moderateListing,
  updateHostLead,
  updateSupportTicket,
} from '@/modules/admin-bos';
import { confirmBookingFeePayment, createStayBooking } from '@/modules/bookings';
import { createDraftStay, submitHostApplication, submitHostStayForReview } from '@/modules/host';
import {
  createGuestSupportTicket,
  listGuestSupportTickets,
  replyToGuestSupportTicket,
} from '@/modules/support';

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
    preferredCurrency: (u.preferred_currency as SessionUser['preferredCurrency']) ?? 'USD',
    phone: u.phone ? String(u.phone) : null,
  };
}

beforeAll(async () => {
  tempDir = mkdtempSync(join(tmpdir(), 'vietnomad-phase2-sync-'));
  process.env.PGLITE_DATA_DIR = tempDir;
  delete process.env.DATABASE_URL;
  await ensureDbReady();
});

afterAll(async () => {
  await closeDb();
  rmSync(tempDir, { recursive: true, force: true });
});

describe('Phase 2 Sync: Interactive Support Tickets & Host Lead CRM Pipeline', () => {
  it('supports guest ticket creation, attachment handling, strict isolation, and public/internal message threads', async () => {
    const guest = await fetchSessionUser(SEED_IDS.users.nomadFree);
    const otherGuest = await fetchSessionUser(SEED_IDS.users.nomadPremium);
    const admin = await fetchSessionUser(SEED_IDS.users.admin);
    const actor = await getAdminActorContext(admin);

    const checkInSupport = addDaysIso(getTodayIsoVietnam(), 30);
    const createdBooking = await createStayBooking(guest, {
      stayId: SEED_IDS.stays.myKheAtelier,
      roomId: SEED_IDS.rooms.myKheOceanStudio,
      packageId: SEED_IDS.packages.myKheDeal,
      checkIn: checkInSupport,
      nights: 7,
      guestsCount: 1,
      checkoutMode: 'intent',
    });

    const created = await createGuestSupportTicket(guest, {
      category: 'property_wifi',
      issueSubCategory: 'wifi_speed_mismatch',
      bookingId: createdBooking.bookingId,
      subject: 'Speedtest dropped to 18 Mbps in bedroom',
      description: 'Measured 18 Mbps download at desk during morning call.',
      attachments: ['https://speedtest.net/result/sample-123.png'],
    });
    expect(created.ticketCode).toMatch(/^SUP-/);
    expect(created.category).toBe('listing_accuracy');

    // Other guest cannot hijack another user's booking to open a ticket
    await expect(
      createGuestSupportTicket(otherGuest, {
        category: 'booking',
        bookingId: createdBooking.bookingId,
        subject: 'Unauthorized ticket attempt',
        description: 'Should be rejected for non-owner.',
      })
    ).rejects.toThrow(/own bookings/i);

    // Automation task created for support ticket
    const taskRes = await dbQuery<{ id: string }>(
      `SELECT id FROM admin_tasks WHERE entity_type = 'ticket' AND entity_id = $1`,
      [created.id]
    );
    expect(taskRes.rows.length).toBeGreaterThan(0);

    // Admin adds an internal staff note AND a public reply setting status waiting_user
    await updateSupportTicket(actor, created.id, {
      status: 'in_progress',
      messageBody: 'INTERNAL: Checking ISP ticket with host owner.',
      isInternalNote: true,
    });
    await updateSupportTicket(actor, created.id, {
      status: 'waiting_user',
      messageBody: 'Hi Minh, please share a screenshot from the living room router.',
      isInternalNote: false,
    });

    // Guest reads thread: sees initial message + public reply, NEVER internal note
    const guestTickets = await listGuestSupportTickets(guest.id);
    const t = guestTickets.find((item) => item.id === created.id);
    expect(t).toBeDefined();
    expect(t!.status).toBe('waiting_user');
    expect(t!.attachments).toContain('https://speedtest.net/result/sample-123.png');
    expect(t!.messages.some((m) => m.body.includes('INTERNAL:'))).toBe(false);
    expect(t!.messages.some((m) => m.body.includes('living room router'))).toBe(true);

    // Other guest cannot reply to this ticket
    await expect(
      replyToGuestSupportTicket(otherGuest, created.id, { body: 'Trying to snoop' })
    ).rejects.toThrow(/another member/i);

    // Guest replies -> status re-opens from waiting_user -> open
    const reply = await replyToGuestSupportTicket(guest, created.id, {
      body: 'Here is the updated test: 35 Mbps next to the router.',
    });
    expect(reply.status).toBe('open');
  });

  it('creates new CRM host_lead on /list-your-stay without prematurely promoting user role or listing live', async () => {
    const freshId = crypto.randomUUID();
    const freshEmail = `new-applicant-${freshId.slice(0, 6)}@example.com`;
    await dbQuery(
      `INSERT INTO users (id, email, password_hash, full_name, role, nationality, phone)
       VALUES ($1,$2,$3,'Lan Nguyen','nomad','Vietnam','+84 912 345 678')`,
      [freshId, freshEmail, hashPassword('DemoPass!2026')]
    );
    const applicant = await fetchSessionUser(freshId);

    const submitted = await submitHostApplication(applicant, {
      businessName: 'Lan Boutique Lofts',
      stayName: 'My Khe Sunlit Residence',
      destinationSlug: 'da-nang',
      propertyType: 'apartment',
      measuredDownloadMbps: 180,
      sourceDetail: 'landing_cta',
      utmSource: 'facebook',
      utmCampaign: 'danang_hosts_2026',
    });
    expect(submitted.status).toBe('submitted');
    expect(submitted.leadStage).toBe('new_lead');

    // Role remains 'nomad' until Admin approves; no stay is live yet
    const userRow = await dbQuery<{ role: string }>('SELECT role FROM users WHERE id = $1', [
      freshId,
    ]);
    expect(userRow.rows[0]!.role).toBe('nomad');

    const leadRow = await dbQuery<{
      id: string;
      source: string;
      stage: string;
      application_id: string;
      utm_source: string;
      utm_campaign: string;
    }>(
      `SELECT id, source, stage, application_id, utm_source, utm_campaign
       FROM host_leads WHERE id = $1`,
      [submitted.leadId]
    );
    expect(leadRow.rows[0]!.source).toBe('list_your_stay');
    expect(leadRow.rows[0]!.stage).toBe('new_lead');
    expect(leadRow.rows[0]!.application_id).toBe(submitted.applicationId);
    expect(leadRow.rows[0]!.utm_source).toBe('facebook');

    const admin = await fetchSessionUser(SEED_IDS.users.admin);
    const actor = await getAdminActorContext(admin);
    const leadsList = await listHostLeads(actor, { q: 'Lan Boutique Lofts' });
    expect(leadsList.length).toBe(1);
    expect(leadsList[0]!.applicationId).toBe(submitted.applicationId);
  });

  it('deduplicates existing host_lead by email/phone, preserves notes/assignee & stage, and advances on publish + first booking', async () => {
    const admin = await fetchSessionUser(SEED_IDS.users.admin);
    const actor = await getAdminActorContext(admin);
    const guest = await fetchSessionUser(SEED_IDS.users.nomadFree);

    // 1. Pre-create a lead in 'published'-preceding stage ('onboarding') with staff notes & assignee
    const userId = crypto.randomUUID();
    const leadEmail = `partner-${userId.slice(0, 6)}@staygroup.vn`;
    const lead = await createHostLead(actor, {
      source: 'outbound_bd',
      businessName: 'StayGroup Hoi An',
      contactName: 'Tuan Tran',
      email: leadEmail,
      phone: '+84 988 777 666',
      destinationSlug: 'hoi-an',
      propertyType: 'villa',
      estimatedUnits: 4,
      notes: 'VIP BD Partner - negotiated 0% commission intro.',
      assignedStaffId: admin.id,
    });
    await updateHostLead(actor, lead.id, {
      stage: 'onboarding',
    });

    // 2. User registers & submits application matching via email (different casing)
    await dbQuery(
      `INSERT INTO users (id, email, password_hash, full_name, role, nationality, phone)
       VALUES ($1,$2,$3,'Tuan Tran','nomad','Vietnam','0988-777-666')`,
      [userId, leadEmail.toUpperCase(), hashPassword('DemoPass!2026')]
    );
    const partnerUser = await fetchSessionUser(userId);

    const submitted = await submitHostApplication(partnerUser, {
      businessName: 'StayGroup Hoi An',
      stayName: 'Thu Bon Riverside Villa',
      destinationSlug: 'hoi-an',
      propertyType: 'villa',
      measuredDownloadMbps: 220,
    });

    // Deduplicated onto the exact same lead id!
    expect(submitted.leadId).toBe(lead.id);

    const leadAfterSubmit = await dbQuery<{
      stage: string;
      notes: string;
      assigned_staff_id: string;
      application_id: string;
      linked_user_id: string;
    }>(
      `SELECT stage, notes, assigned_staff_id, application_id, linked_user_id
       FROM host_leads WHERE id = $1`,
      [lead.id]
    );
    const row = leadAfterSubmit.rows[0]!;
    expect(row.stage).toBe('under_review'); // Never downgraded to new_lead!
    expect(row.notes).toBe('VIP BD Partner - negotiated 0% commission intro.');
    expect(row.assigned_staff_id).toBe(admin.id);
    expect(row.application_id).toBe(submitted.applicationId);
    expect(row.linked_user_id).toBe(userId);

    // 3. Admin approves application -> user role becomes 'host'; NO stay is
    //    created (application = lead CRM; listings live in their own lifecycle)
    const staysBefore = await dbQuery('SELECT id FROM stays WHERE host_id = $1', [userId]);
    const approved = await reviewHostApplication(
      admin,
      submitted.applicationId,
      'approved',
      'Verified and live'
    );
    expect(approved.status).toBe('approved');
    expect(approved.createdStaySlug).toBeNull();
    const staysAfter = await dbQuery('SELECT id FROM stays WHERE host_id = $1', [userId]);
    expect(staysAfter.rows.length).toBe(staysBefore.rows.length);

    const roleAfterApprove = await dbQuery<{ role: string }>(
      'SELECT role FROM users WHERE id = $1',
      [userId]
    );
    expect(roleAfterApprove.rows[0]!.role).toBe('host');

    // Lead stays at 'under_review' until the host's own listing goes live
    const postApproveLead = await dbQuery<{ stage: string }>(
      'SELECT stage FROM host_leads WHERE id = $1',
      [lead.id]
    );
    expect(postApproveLead.rows[0]!.stage).toBe('under_review');

    // 4. Host creates + publishes their listing the new way:
    //    draft stay -> pending_review -> live (admin moderation)
    const hostUser = await fetchSessionUser(userId);
    const stay = await createDraftStay(hostUser, {
      titleEn: 'Thu Bon Riverside Villa',
      destinationSlug: 'hoi-an',
      propertyType: 'villa',
    });
    await submitHostStayForReview(hostUser, stay.id);
    await moderateListing(actor, stay.id, { status: 'live' });

    const postPublishLead = await dbQuery<{ stage: string }>(
      'SELECT stage FROM host_leads WHERE id = $1',
      [lead.id]
    );
    expect(postPublishLead.rows[0]!.stage).toBe('published');

    // 5. Guest pays first booking on the live stay -> lead advances to 'first_booking'
    const stayInfo = await dbQuery<{
      stay_id: string;
      room_id: string;
      package_id: string;
    }>(
      `SELECT s.id AS stay_id, r.id AS room_id, p.id AS package_id
       FROM stays s
       JOIN stay_rooms r ON r.stay_id = s.id
       JOIN stay_packages p ON p.stay_id = s.id
       WHERE s.slug = $1 LIMIT 1`,
      [stay.slug]
    );
    expect(stayInfo.rows.length).toBe(1);
    const info = stayInfo.rows[0]!;
    const checkIn = addDaysIso(getTodayIsoVietnam(), 20);
    const booking = await createStayBooking(guest, {
      stayId: info.stay_id,
      roomId: info.room_id,
      packageId: info.package_id,
      checkIn,
      nights: 7,
      guestsCount: 1,
      checkoutMode: 'intent',
    });
    await confirmBookingFeePayment(guest, booking.bookingId);

    const postBookingLead = await dbQuery<{ stage: string }>(
      'SELECT stage FROM host_leads WHERE id = $1',
      [lead.id]
    );
    expect(postBookingLead.rows[0]!.stage).toBe('first_booking');
  });
});
