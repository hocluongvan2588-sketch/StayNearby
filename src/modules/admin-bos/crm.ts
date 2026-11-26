import crypto from 'node:crypto';
import { hashPassword } from '@/lib/auth/password';
import { isValidUuid } from '@/lib/dates';
import { dbQuery, dbTransaction, toNum } from '@/lib/db';
import { AppError } from '@/lib/errors';
import { safeRevalidateAll } from '@/lib/revalidate-safe';
import {
  logAdminAudit,
  maskEmail,
  maskPhone,
  type AdminActorContext,
} from '@/modules/admin-rbac';

import { HOST_LEAD_STAGES, type HostLeadStage } from '@/lib/admin-constants';
export { HOST_LEAD_STAGES, type HostLeadStage };

export async function listHostsCrm(
  actor: AdminActorContext,
  filters?: { q?: string; stage?: string; destination?: string }
) {
  const conditions: string[] = [`u.role = 'host'`];
  const params: unknown[] = [];

  if (filters?.q?.trim()) {
    params.push(`%${filters.q.trim()}%`);
    conditions.push(
      `(u.full_name ILIKE $${params.length} OR u.email ILIKE $${params.length} OR COALESCE(hs.display_name,'') ILIKE $${params.length})`
    );
  }
  if (filters?.stage && filters.stage !== 'all') {
    params.push(filters.stage);
    conditions.push(`u.crm_stage = $${params.length}`);
  }
  if (filters?.destination && filters.destination !== 'all') {
    params.push(filters.destination);
    conditions.push(
      `EXISTS (SELECT 1 FROM stays s2 JOIN destinations d2 ON d2.id = s2.destination_id WHERE s2.host_id = u.id AND d2.slug = $${params.length})`
    );
  }

  const res = await dbQuery<{
    id: string;
    full_name: string;
    email: string;
    phone: string | null;
    crm_stage: string;
    crm_note: string;
    kyc_verified: boolean;
    risk_flag: string;
    assigned_staff_id: string | null;
    created_at: string;
    display_name: string | null;
    whatsapp_number: string | null;
    zalo_handle: string | null;
    stays_count: string | number;
    live_stays_count: string | number;
    bookings_count: string | number;
    gmv_vnd: string | number;
  }>(
    `SELECT u.id, u.full_name, u.email, u.phone, u.crm_stage, u.crm_note,
            u.kyc_verified, u.risk_flag, u.assigned_staff_id, u.created_at,
            hs.display_name, hs.whatsapp_number, hs.zalo_handle,
            COUNT(DISTINCT s.id) AS stays_count,
            COUNT(DISTINCT s.id) FILTER (WHERE s.status IN ('live', 'limited')) AS live_stays_count,
            COUNT(DISTINCT b.id) FILTER (WHERE b.booking_status = 'confirmed') AS bookings_count,
            COALESCE(SUM(b.guest_total_vnd) FILTER (WHERE b.booking_status = 'confirmed'), 0) AS gmv_vnd
     FROM users u
     LEFT JOIN host_settings hs ON hs.host_id = u.id
     LEFT JOIN stays s ON s.host_id = u.id
     LEFT JOIN bookings b ON b.stay_id = s.id
     WHERE ${conditions.join(' AND ')}
     GROUP BY u.id, hs.display_name, hs.whatsapp_number, hs.zalo_handle
     ORDER BY gmv_vnd DESC, stays_count DESC, u.created_at DESC`,
    params
  );

  return res.rows.map((h) => ({
    id: String(h.id),
    fullName: String(h.full_name),
    displayName: h.display_name ? String(h.display_name) : String(h.full_name),
    email: actor.hasPiiAccess ? String(h.email) : maskEmail(String(h.email)),
    phone: actor.hasPiiAccess ? String(h.phone ?? '') : maskPhone(h.phone),
    whatsappNumber: actor.hasPiiAccess ? String(h.whatsapp_number ?? '') : maskPhone(h.whatsapp_number),
    zaloHandle: String(h.zalo_handle ?? ''),
    crmStage: String(h.crm_stage),
    crmNote: String(h.crm_note ?? ''),
    kycVerified: Boolean(h.kyc_verified),
    riskFlag: String(h.risk_flag),
    assignedStaffId: h.assigned_staff_id ? String(h.assigned_staff_id) : null,
    staysCount: toNum(h.stays_count),
    liveStaysCount: toNum(h.live_stays_count),
    bookingsCount: toNum(h.bookings_count),
    gmvVnd: toNum(h.gmv_vnd),
    createdAt: new Date(String(h.created_at)).toISOString(),
  }));
}

export async function getHostDetail360(actor: AdminActorContext, hostId: string) {
  if (!isValidUuid(hostId)) throw new AppError('VALIDATION_ERROR', 'Invalid host ID.');

  const [userRes, staysRes, bookingsRes, activitiesRes, payoutsRes] = await Promise.all([
    dbQuery<{
      id: string;
      full_name: string;
      email: string;
      phone: string | null;
      nationality: string;
      crm_stage: string;
      crm_note: string;
      kyc_verified: boolean;
      risk_flag: string;
      created_at: string;
      display_name: string | null;
      contact_phone: string | null;
      whatsapp_number: string | null;
      zalo_handle: string | null;
      payout_bank_name: string | null;
      payout_account_number: string | null;
    }>(
      `SELECT u.*, hs.display_name, hs.contact_phone, hs.whatsapp_number, hs.zalo_handle,
              hs.payout_bank_name, hs.payout_account_number
       FROM users u
       LEFT JOIN host_settings hs ON hs.host_id = u.id
       WHERE u.id = $1`,
      [hostId]
    ),
    dbQuery<{ id: string; slug: string; title_en: string; status: string; created_at: string }>(
      `SELECT id, slug, title_en, status, created_at FROM stays WHERE host_id = $1 ORDER BY created_at DESC`,
      [hostId]
    ),
    dbQuery<{
      id: string;
      booking_code: string;
      booking_status: string;
      guest_total_vnd: string | number;
      created_at: string;
    }>(
      `SELECT b.id, b.booking_code, b.booking_status, b.guest_total_vnd, b.created_at
       FROM bookings b
       JOIN stays s ON s.id = b.stay_id
       WHERE s.host_id = $1
       ORDER BY b.created_at DESC LIMIT 20`,
      [hostId]
    ),
    dbQuery<{
      id: string;
      activity_type: string;
      summary: string;
      body: string;
      actor_name: string | null;
      created_at: string;
    }>(
      `SELECT ca.*, u.full_name AS actor_name
       FROM crm_activities ca
       LEFT JOIN users u ON u.id = ca.actor_user_id
       WHERE ca.entity_type = 'host' AND ca.entity_id = $1
       ORDER BY ca.created_at DESC LIMIT 30`,
      [hostId]
    ),
    dbQuery<{
      id: string;
      period_month: string;
      net_payable_vnd: string | number;
      status: string;
    }>(
      `SELECT id, period_month, net_payable_vnd, status
       FROM host_payouts WHERE host_id = $1 ORDER BY created_at DESC LIMIT 20`,
      [hostId]
    ),
  ]);

  const u = userRes.rows[0];
  if (!u) throw new AppError('NOT_FOUND', 'Host profile not found.');

  return {
    host: {
      id: String(u.id),
      fullName: String(u.full_name),
      displayName: u.display_name ? String(u.display_name) : String(u.full_name),
      email: actor.hasPiiAccess ? String(u.email) : maskEmail(String(u.email)),
      phone: actor.hasPiiAccess ? String(u.phone ?? u.contact_phone ?? '') : maskPhone(u.phone),
      whatsappNumber: actor.hasPiiAccess ? String(u.whatsapp_number ?? '') : maskPhone(u.whatsapp_number),
      zaloHandle: String(u.zalo_handle ?? ''),
      payoutBankName: String(u.payout_bank_name ?? ''),
      payoutAccountMasked: actor.hasPiiAccess
        ? String(u.payout_account_number ?? '')
        : u.payout_account_number
          ? `••••${String(u.payout_account_number).slice(-4)}`
          : '',
      crmStage: String(u.crm_stage),
      crmNote: String(u.crm_note ?? ''),
      kycVerified: Boolean(u.kyc_verified),
      riskFlag: String(u.risk_flag),
      createdAt: new Date(String(u.created_at)).toISOString(),
    },
    stays: staysRes.rows.map((s) => ({
      id: String(s.id),
      slug: String(s.slug),
      titleEn: String(s.title_en),
      status: String(s.status),
      createdAt: new Date(String(s.created_at)).toISOString(),
    })),
    bookings: bookingsRes.rows.map((b) => ({
      id: String(b.id),
      bookingCode: String(b.booking_code),
      bookingStatus: String(b.booking_status),
      guestTotalVnd: toNum(b.guest_total_vnd),
      createdAt: new Date(String(b.created_at)).toISOString(),
    })),
    activities: activitiesRes.rows.map((a) => ({
      id: String(a.id),
      activityType: String(a.activity_type),
      summary: String(a.summary),
      body: String(a.body ?? ''),
      actorName: a.actor_name ? String(a.actor_name) : 'System',
      createdAt: new Date(String(a.created_at)).toISOString(),
    })),
    payouts: payoutsRes.rows.map((p) => ({
      id: String(p.id),
      periodMonth: String(p.period_month),
      netPayableVnd: toNum(p.net_payable_vnd),
      status: String(p.status),
    })),
  };
}

export async function updateHostOrGuestCrmProfile(
  actor: AdminActorContext,
  userId: string,
  entityType: 'host' | 'guest',
  input: {
    crmStage?: 'lead' | 'active' | 'vip' | 'follow_up' | 'paused';
    crmNote?: string;
    kycVerified?: boolean;
    riskFlag?: 'none' | 'watch' | 'restricted';
    reason?: string;
  }
) {
  if (!isValidUuid(userId)) throw new AppError('VALIDATION_ERROR', 'Invalid user ID.');
  const curRes = await dbQuery<{
    crm_stage: string;
    crm_note: string;
    kyc_verified: boolean;
    risk_flag: string;
  }>('SELECT crm_stage, crm_note, kyc_verified, risk_flag FROM users WHERE id = $1', [userId]);
  const cur = curRes.rows[0];
  if (!cur) throw new AppError('NOT_FOUND', 'User not found.');

  await dbQuery(
    `UPDATE users
     SET crm_stage = COALESCE($1, crm_stage),
         crm_note = COALESCE($2, crm_note),
         kyc_verified = COALESCE($3, kyc_verified),
         risk_flag = COALESCE($4, risk_flag)
     WHERE id = $5`,
    [
      input.crmStage ?? null,
      input.crmNote !== undefined ? input.crmNote.trim() : null,
      input.kycVerified ?? null,
      input.riskFlag ?? null,
      userId,
    ]
  );

  await logAdminAudit({
    actor,
    module: entityType === 'host' ? 'host_crm' : 'guest_crm',
    action: 'edit',
    entityType,
    entityId: userId,
    before: cur,
    after: input,
    reason: input.reason ?? '',
  });

  return { ok: true };
}

export async function listHostLeads(
  actor: AdminActorContext,
  filters?: { q?: string; stage?: string; destination?: string }
) {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters?.q?.trim()) {
    params.push(`%${filters.q.trim()}%`);
    conditions.push(
      `(hl.business_name ILIKE $${params.length} OR hl.contact_name ILIKE $${params.length} OR hl.email ILIKE $${params.length})`
    );
  }
  if (filters?.stage && filters.stage !== 'all') {
    params.push(filters.stage);
    conditions.push(`hl.stage = $${params.length}`);
  }
  if (filters?.destination && filters.destination !== 'all') {
    params.push(filters.destination);
    conditions.push(`hl.destination_slug = $${params.length}`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const res = await dbQuery<{
    id: string;
    linked_user_id: string | null;
    source: string;
    business_name: string;
    contact_name: string;
    email: string;
    phone: string;
    whatsapp_zalo: string;
    destination_slug: string;
    property_type: string;
    estimated_units: number;
    stage: HostLeadStage;
    loss_reason: string;
    assigned_staff_id: string | null;
    assignee_name: string | null;
    next_follow_up_at: string | null;
    kyc_status: string;
    notes: string;
    application_id: string | null;
    source_detail: string | null;
    utm_source: string | null;
    utm_campaign: string | null;
    created_at: string;
    updated_at: string;
  }>(
    `SELECT hl.*, u.full_name AS assignee_name
     FROM host_leads hl
     LEFT JOIN users u ON u.id = hl.assigned_staff_id
     ${where}
     ORDER BY hl.updated_at DESC`,
    params
  );

  return res.rows.map((l) => ({
    id: String(l.id),
    linkedUserId: l.linked_user_id ? String(l.linked_user_id) : null,
    applicationId: l.application_id ? String(l.application_id) : null,
    source: String(l.source),
    sourceDetail: l.source_detail ? String(l.source_detail) : null,
    utmSource: l.utm_source ? String(l.utm_source) : null,
    utmCampaign: l.utm_campaign ? String(l.utm_campaign) : null,
    businessName: String(l.business_name),
    contactName: String(l.contact_name),
    email: actor.hasPiiAccess ? String(l.email) : maskEmail(String(l.email)),
    phone: actor.hasPiiAccess ? String(l.phone ?? '') : maskPhone(l.phone),
    whatsappZalo: actor.hasPiiAccess ? String(l.whatsapp_zalo ?? '') : maskPhone(l.whatsapp_zalo),
    destinationSlug: String(l.destination_slug),
    propertyType: String(l.property_type),
    estimatedUnits: toNum(l.estimated_units, 1),
    stage: l.stage,
    lossReason: String(l.loss_reason ?? ''),
    assignedStaffId: l.assigned_staff_id ? String(l.assigned_staff_id) : null,
    assigneeName: l.assignee_name ? String(l.assignee_name) : null,
    nextFollowUpAt: l.next_follow_up_at ? new Date(String(l.next_follow_up_at)).toISOString() : null,
    kycStatus: String(l.kyc_status),
    notes: String(l.notes ?? ''),
    createdAt: new Date(String(l.created_at)).toISOString(),
    updatedAt: new Date(String(l.updated_at)).toISOString(),
  }));
}

export async function createHostLead(
  actor: AdminActorContext,
  input: {
    source?: string;
    businessName: string;
    contactName: string;
    email: string;
    phone?: string;
    whatsappZalo?: string;
    destinationSlug?: string;
    propertyType?: string;
    estimatedUnits?: number;
    notes?: string;
    assignedStaffId?: string | null;
  }
) {
  const email = input.email.trim().toLowerCase();
  const id = crypto.randomUUID();

  // Check if already a user in DB (non-duplicative lookup)
  const existingUser = await dbQuery<{ id: string }>('SELECT id FROM users WHERE LOWER(email) = $1', [
    email,
  ]);
  const linkedUserId = existingUser.rows[0]?.id ?? null;

  await dbQuery(
    `INSERT INTO host_leads (
      id, linked_user_id, source, business_name, contact_name, email, phone, whatsapp_zalo,
      destination_slug, property_type, estimated_units, stage, assigned_staff_id, notes
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'new_lead',$12,$13)`,
    [
      id,
      linkedUserId,
      input.source?.trim() || 'inbound_web',
      input.businessName.trim(),
      input.contactName.trim(),
      email,
      input.phone?.trim() ?? '',
      input.whatsappZalo?.trim() ?? input.phone?.trim() ?? '',
      input.destinationSlug?.trim() || 'da-nang',
      input.propertyType?.trim() || 'apartment',
      Math.max(1, input.estimatedUnits ?? 1),
      input.assignedStaffId && isValidUuid(input.assignedStaffId)
        ? input.assignedStaffId
        : actor.user.id,
      input.notes?.trim() ?? '',
    ]
  );

  await dbQuery(
    `INSERT INTO crm_activities (id, entity_type, entity_id, activity_type, summary, actor_user_id)
     VALUES ($1, 'host_lead', $2, 'system', 'Host lead created', $3)`,
    [crypto.randomUUID(), id, actor.user.id]
  );

  await logAdminAudit({
    actor,
    module: 'host_acquisition',
    action: 'create',
    entityType: 'host_lead',
    entityId: id,
    after: { businessName: input.businessName, destinationSlug: input.destinationSlug },
  });

  return { id, linkedUserId };
}

export async function updateHostLead(
  actor: AdminActorContext,
  leadId: string,
  input: {
    stage?: HostLeadStage;
    lossReason?: string;
    kycStatus?: 'pending' | 'submitted' | 'verified' | 'rejected';
    notes?: string;
    nextFollowUpAt?: string | null;
    assignedStaffId?: string | null;
  }
) {
  if (!isValidUuid(leadId)) throw new AppError('VALIDATION_ERROR', 'Invalid lead ID.');
  const curRes = await dbQuery<{ stage: string; kyc_status: string; notes: string }>(
    'SELECT stage, kyc_status, notes FROM host_leads WHERE id = $1',
    [leadId]
  );
  const cur = curRes.rows[0];
  if (!cur) throw new AppError('NOT_FOUND', 'Host lead not found.');

  await dbQuery(
    `UPDATE host_leads
     SET stage = COALESCE($1, stage),
         loss_reason = COALESCE($2, loss_reason),
         kyc_status = COALESCE($3, kyc_status),
         notes = COALESCE($4, notes),
         next_follow_up_at = CASE WHEN $5::boolean THEN $6::timestamptz ELSE next_follow_up_at END,
         assigned_staff_id = CASE WHEN $7::boolean THEN $8 ELSE assigned_staff_id END,
         updated_at = NOW()
     WHERE id = $9`,
    [
      input.stage ?? null,
      input.lossReason !== undefined ? input.lossReason.trim() : null,
      input.kycStatus ?? null,
      input.notes !== undefined ? input.notes.trim() : null,
      input.nextFollowUpAt !== undefined,
      input.nextFollowUpAt ? new Date(input.nextFollowUpAt).toISOString() : null,
      input.assignedStaffId !== undefined,
      input.assignedStaffId && isValidUuid(input.assignedStaffId) ? input.assignedStaffId : null,
      leadId,
    ]
  );

  if (input.stage && input.stage !== cur.stage) {
    await dbQuery(
      `INSERT INTO crm_activities (id, entity_type, entity_id, activity_type, summary, body, actor_user_id)
       VALUES ($1, 'host_lead', $2, 'stage_change', $3, $4, $5)`,
      [
        crypto.randomUUID(),
        leadId,
        `Stage moved: ${cur.stage} -> ${input.stage}`,
        input.lossReason ?? '',
        actor.user.id,
      ]
    );
  }

  await logAdminAudit({
    actor,
    module: 'host_acquisition',
    action: 'edit',
    entityType: 'host_lead',
    entityId: leadId,
    before: cur,
    after: input,
  });

  return { ok: true };
}

export async function convertHostLeadToHost(actor: AdminActorContext, leadId: string) {
  if (!isValidUuid(leadId)) throw new AppError('VALIDATION_ERROR', 'Invalid lead ID.');

  return dbTransaction(async (tx) => {
    const leadRes = await tx.query<{
      id: string;
      linked_user_id: string | null;
      business_name: string;
      contact_name: string;
      email: string;
      phone: string;
      whatsapp_zalo: string;
      stage: string;
    }>('SELECT * FROM host_leads WHERE id = $1 FOR UPDATE', [leadId]);
    const lead = leadRes.rows[0];
    if (!lead) throw new AppError('NOT_FOUND', 'Host lead not found.');

    const email = lead.email.trim().toLowerCase();
    const existingRes = await tx.query<{ id: string; role: string }>(
      'SELECT id, role FROM users WHERE LOWER(email) = $1',
      [email]
    );

    let hostUserId = lead.linked_user_id ?? existingRes.rows[0]?.id ?? null;
    let createdNewAccount = false;

    if (!hostUserId) {
      hostUserId = crypto.randomUUID();
      const tempPasswordHash = await hashPassword(crypto.randomBytes(16).toString('hex'));
      await tx.query(
        `INSERT INTO users (
          id, email, password_hash, full_name, role, nationality, phone, crm_stage,
          acquisition_source, assigned_staff_id
        ) VALUES ($1,$2,$3,$4,'host','Vietnam',$5,'active','host_acquisition',$6)`,
        [hostUserId, email, tempPasswordHash, lead.contact_name, lead.phone, actor.user.id]
      );
      createdNewAccount = true;
    } else if (existingRes.rows[0]?.role === 'nomad') {
      await tx.query(`UPDATE users SET role = 'host' WHERE id = $1`, [hostUserId]);
    }

    await tx.query(
      `INSERT INTO host_settings (
        host_id, display_name, contact_phone, whatsapp_number, zalo_handle
      ) VALUES ($1,$2,$3,$4,$5)
      ON CONFLICT (host_id) DO UPDATE
      SET display_name = COALESCE(NULLIF(host_settings.display_name, ''), EXCLUDED.display_name),
          contact_phone = COALESCE(NULLIF(host_settings.contact_phone, ''), EXCLUDED.contact_phone),
          whatsapp_number = COALESCE(NULLIF(host_settings.whatsapp_number, ''), EXCLUDED.whatsapp_number),
          zalo_handle = COALESCE(NULLIF(host_settings.zalo_handle, ''), EXCLUDED.zalo_handle)`,
      [hostUserId, lead.business_name, lead.phone, lead.whatsapp_zalo, lead.whatsapp_zalo]
    );

    const nextStage = ['published', 'first_booking', 'active'].includes(lead.stage)
      ? lead.stage
      : 'onboarding';

    await tx.query(
      `UPDATE host_leads
       SET linked_user_id = $1, stage = $2, updated_at = NOW()
       WHERE id = $3`,
      [hostUserId, nextStage, leadId]
    );

    await tx.query(
      `INSERT INTO crm_activities (id, entity_type, entity_id, activity_type, summary, actor_user_id)
       VALUES ($1, 'host', $2, 'system', $3, $4)`,
      [
        crypto.randomUUID(),
        hostUserId,
        `Converted from Host Acquisition lead (${lead.business_name})`,
        actor.user.id,
      ]
    );

    await logAdminAudit(
      {
        actor,
        module: 'host_acquisition',
        action: 'approve',
        entityType: 'host_lead',
        entityId: leadId,
        after: { linkedUserId: hostUserId, createdNewAccount, nextStage },
        reason: 'Lead converted to Host CRM account',
      },
      tx
    );

    return { hostUserId, createdNewAccount, stage: nextStage };
  });
}

export async function listGuestsCrm(
  actor: AdminActorContext,
  filters?: { q?: string; stage?: string; tier?: string; risk?: string }
) {
  const conditions: string[] = [`u.role = 'nomad'`];
  const params: unknown[] = [];

  if (filters?.q?.trim()) {
    params.push(`%${filters.q.trim()}%`);
    conditions.push(`(u.full_name ILIKE $${params.length} OR u.email ILIKE $${params.length})`);
  }
  if (filters?.stage && filters.stage !== 'all') {
    params.push(filters.stage);
    conditions.push(`u.crm_stage = $${params.length}`);
  }
  if (filters?.tier && filters.tier !== 'all') {
    params.push(filters.tier);
    conditions.push(`u.membership_tier = $${params.length}`);
  }
  if (filters?.risk && filters.risk !== 'all') {
    params.push(filters.risk);
    conditions.push(`u.risk_flag = $${params.length}`);
  }

  const res = await dbQuery<{
    id: string;
    full_name: string;
    email: string;
    phone: string | null;
    nationality: string;
    membership_tier: string;
    reward_credit_vnd: string | number;
    crm_stage: string;
    crm_note: string;
    risk_flag: string;
    acquisition_source: string;
    created_at: string;
    bookings_count: string | number;
    cancelled_count: string | number;
    total_spent_vnd: string | number;
    last_booking_at: string | null;
  }>(
    `SELECT u.id, u.full_name, u.email, u.phone, u.nationality, u.membership_tier,
            u.reward_credit_vnd, u.crm_stage, u.crm_note, u.risk_flag,
            u.acquisition_source, u.created_at,
            COUNT(b.id) AS bookings_count,
            COUNT(b.id) FILTER (WHERE b.booking_status = 'cancelled') AS cancelled_count,
            COALESCE(SUM(b.guest_total_vnd) FILTER (WHERE b.booking_status = 'confirmed'), 0) AS total_spent_vnd,
            MAX(b.created_at) AS last_booking_at
     FROM users u
     LEFT JOIN bookings b ON b.guest_id = u.id
     WHERE ${conditions.join(' AND ')}
     GROUP BY u.id
     ORDER BY total_spent_vnd DESC, u.created_at DESC`,
    params
  );

  return res.rows.map((g) => ({
    id: String(g.id),
    fullName: String(g.full_name),
    email: actor.hasPiiAccess ? String(g.email) : maskEmail(String(g.email)),
    phone: actor.hasPiiAccess ? String(g.phone ?? '') : maskPhone(g.phone),
    nationality: String(g.nationality),
    membershipTier: String(g.membership_tier),
    rewardCreditVnd: toNum(g.reward_credit_vnd),
    crmStage: String(g.crm_stage),
    crmNote: String(g.crm_note ?? ''),
    riskFlag: String(g.risk_flag),
    acquisitionSource: String(g.acquisition_source),
    bookingsCount: toNum(g.bookings_count),
    cancelledCount: toNum(g.cancelled_count),
    totalSpentVnd: toNum(g.total_spent_vnd),
    lastBookingAt: g.last_booking_at ? new Date(String(g.last_booking_at)).toISOString() : null,
    createdAt: new Date(String(g.created_at)).toISOString(),
  }));
}

export async function getGuestDetail360(actor: AdminActorContext, guestId: string) {
  if (!isValidUuid(guestId)) throw new AppError('VALIDATION_ERROR', 'Invalid guest ID.');

  const [userRes, bookingsRes, activitiesRes, ticketsRes] = await Promise.all([
    dbQuery(
      `SELECT id, full_name, email, phone, nationality, membership_tier, reward_credit_vnd,
              crm_stage, crm_note, risk_flag, acquisition_source, created_at
       FROM users WHERE id = $1`,
      [guestId]
    ),
    dbQuery<{
      id: string;
      booking_code: string;
      stay_title: string;
      booking_status: string;
      stay_status: string;
      payment_status: string;
      guest_total_vnd: string | number;
      nights: number;
      check_in: string;
      check_out: string;
    }>(
      `SELECT b.id, b.booking_code, s.title_en AS stay_title, b.booking_status, b.stay_status,
              b.payment_status, b.guest_total_vnd, b.nights, b.check_in, b.check_out
       FROM bookings b
       JOIN stays s ON s.id = b.stay_id
       WHERE b.guest_id = $1
       ORDER BY b.created_at DESC`,
      [guestId]
    ),
    dbQuery<{
      id: string;
      activity_type: string;
      summary: string;
      body: string;
      actor_name: string | null;
      created_at: string;
    }>(
      `SELECT ca.*, u.full_name AS actor_name
       FROM crm_activities ca
       LEFT JOIN users u ON u.id = ca.actor_user_id
       WHERE ca.entity_type = 'guest' AND ca.entity_id = $1
       ORDER BY ca.created_at DESC LIMIT 30`,
      [guestId]
    ),
    dbQuery<{ id: string; ticket_code: string; subject: string; status: string }>(
      `SELECT id, ticket_code, subject, status
       FROM support_tickets WHERE guest_id = $1 ORDER BY created_at DESC LIMIT 10`,
      [guestId]
    ),
  ]);

  const g = userRes.rows[0];
  if (!g) throw new AppError('NOT_FOUND', 'Guest profile not found.');

  return {
    guest: {
      id: String(g.id),
      fullName: String(g.full_name),
      email: actor.hasPiiAccess ? String(g.email) : maskEmail(String(g.email)),
      phone: actor.hasPiiAccess ? String(g.phone ?? '') : maskPhone(g.phone ? String(g.phone) : null),
      nationality: String(g.nationality),
      membershipTier: String(g.membership_tier),
      rewardCreditVnd: toNum(g.reward_credit_vnd),
      crmStage: String(g.crm_stage),
      crmNote: String(g.crm_note ?? ''),
      riskFlag: String(g.risk_flag),
      acquisitionSource: String(g.acquisition_source),
      createdAt: new Date(String(g.created_at)).toISOString(),
    },
    bookings: bookingsRes.rows.map((b) => ({
      id: String(b.id),
      bookingCode: String(b.booking_code),
      stayTitle: String(b.stay_title),
      bookingStatus: String(b.booking_status),
      stayStatus: String(b.stay_status),
      paymentStatus: String(b.payment_status),
      guestTotalVnd: toNum(b.guest_total_vnd),
      nights: toNum(b.nights),
      checkIn: String(b.check_in).slice(0, 10),
      checkOut: String(b.check_out).slice(0, 10),
    })),
    activities: activitiesRes.rows.map((a) => ({
      id: String(a.id),
      activityType: String(a.activity_type),
      summary: String(a.summary),
      body: String(a.body ?? ''),
      actorName: a.actor_name ? String(a.actor_name) : 'System',
      createdAt: new Date(String(a.created_at)).toISOString(),
    })),
    tickets: ticketsRes.rows.map((t) => ({
      id: String(t.id),
      ticketCode: String(t.ticket_code),
      subject: String(t.subject),
      status: String(t.status),
    })),
  };
}

export async function addCrmActivity(
  actor: AdminActorContext,
  input: {
    entityType: 'host_lead' | 'host' | 'guest' | 'local_partner';
    entityId: string;
    activityType: 'note' | 'call' | 'email' | 'zalo' | 'meeting';
    summary: string;
    body?: string;
  }
) {
  const id = crypto.randomUUID();
  await dbQuery(
    `INSERT INTO crm_activities (id, entity_type, entity_id, activity_type, summary, body, actor_user_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [
      id,
      input.entityType,
      input.entityId,
      input.activityType,
      input.summary.trim(),
      input.body?.trim() ?? '',
      actor.user.id,
    ]
  );

  await logAdminAudit({
    actor,
    module: input.entityType === 'host_lead' ? 'host_acquisition' : 'host_crm',
    action: 'create',
    entityType: 'crm_activity',
    entityId: id,
    after: { entityType: input.entityType, targetId: input.entityId, summary: input.summary },
  });

  return { id };
}

export async function listLocalPartners(filters?: { status?: string; category?: string; q?: string }) {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters?.status && filters.status !== 'all') {
    params.push(filters.status);
    conditions.push(`lp.partnership_status = $${params.length}`);
  }
  if (filters?.category && filters.category !== 'all') {
    params.push(filters.category);
    conditions.push(`lp.category = $${params.length}`);
  }
  if (filters?.q?.trim()) {
    params.push(`%${filters.q.trim()}%`);
    conditions.push(`(lp.business_name ILIKE $${params.length} OR lp.contact_name ILIKE $${params.length})`);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const [partnersRes, destinationsRes] = await Promise.all([
    dbQuery<{
      id: string;
      business_name: string;
      category: string;
      destination_id: string | null;
      destination_name: string | null;
      contact_name: string;
      contact_email: string;
      contact_phone: string;
      partnership_status: string;
      contract_ref: string;
      perk_offer: string;
      commission_terms: string;
      notes: string;
      places_count: string | number;
      created_at: string;
    }>(
      `SELECT lp.*, d.name_en AS destination_name,
              (SELECT COUNT(*) FROM places p WHERE p.partner_id = lp.id) AS places_count
       FROM local_partners lp
       LEFT JOIN destinations d ON d.id = lp.destination_id
       ${where}
       ORDER BY lp.created_at DESC`,
      params
    ),
    dbQuery<{ id: string; slug: string; name_en: string }>(
      `SELECT id, slug, name_en FROM destinations ORDER BY name_en ASC`
    ),
  ]);

  return {
    partners: partnersRes.rows.map((p) => ({
      id: String(p.id),
      businessName: String(p.business_name),
      category: String(p.category),
      destinationId: p.destination_id ? String(p.destination_id) : null,
      destinationName: p.destination_name ? String(p.destination_name) : 'All Vietnam',
      contactName: String(p.contact_name),
      contactEmail: String(p.contact_email),
      contactPhone: String(p.contact_phone),
      partnershipStatus: String(p.partnership_status),
      contractRef: String(p.contract_ref),
      perkOffer: String(p.perk_offer),
      commissionTerms: String(p.commission_terms),
      notes: String(p.notes),
      placesCount: toNum(p.places_count),
      createdAt: new Date(String(p.created_at)).toISOString(),
    })),
    destinations: destinationsRes.rows.map((d) => ({
      id: String(d.id),
      slug: String(d.slug),
      nameEn: String(d.name_en),
    })),
  };
}

export async function createLocalPartner(
  actor: AdminActorContext,
  input: {
    businessName: string;
    category: string;
    destinationId?: string | null;
    contactName?: string;
    contactEmail?: string;
    contactPhone?: string;
    partnershipStatus?: string;
    contractRef?: string;
    perkOffer?: string;
    commissionTerms?: string;
    notes?: string;
  }
) {
  const id = crypto.randomUUID();
  await dbQuery(
    `INSERT INTO local_partners (
      id, business_name, category, destination_id, contact_name, contact_email, contact_phone,
      assigned_staff_id, partnership_status, contract_ref, perk_offer, commission_terms, notes
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
    [
      id,
      input.businessName.trim(),
      input.category,
      input.destinationId && isValidUuid(input.destinationId) ? input.destinationId : null,
      input.contactName?.trim() ?? '',
      input.contactEmail?.trim() ?? '',
      input.contactPhone?.trim() ?? '',
      actor.user.id,
      input.partnershipStatus ?? 'prospect',
      input.contractRef?.trim() ?? '',
      input.perkOffer?.trim() ?? '',
      input.commissionTerms?.trim() ?? '',
      input.notes?.trim() ?? '',
    ]
  );

  await logAdminAudit({
    actor,
    module: 'local_partners',
    action: 'create',
    entityType: 'local_partner',
    entityId: id,
    after: { businessName: input.businessName, category: input.category },
  });

  safeRevalidateAll(['/destinations']);
  return { id };
}

export async function updateLocalPartner(
  actor: AdminActorContext,
  partnerId: string,
  input: {
    partnershipStatus?: string;
    perkOffer?: string;
    commissionTerms?: string;
    contractRef?: string;
    notes?: string;
  }
) {
  if (!isValidUuid(partnerId)) throw new AppError('VALIDATION_ERROR', 'Invalid partner ID.');
  const res = await dbQuery(
    `UPDATE local_partners
     SET partnership_status = COALESCE($1, partnership_status),
         perk_offer = COALESCE($2, perk_offer),
         commission_terms = COALESCE($3, commission_terms),
         contract_ref = COALESCE($4, contract_ref),
         notes = COALESCE($5, notes),
         updated_at = NOW()
     WHERE id = $6
     RETURNING id`,
    [
      input.partnershipStatus ?? null,
      input.perkOffer ?? null,
      input.commissionTerms ?? null,
      input.contractRef ?? null,
      input.notes ?? null,
      partnerId,
    ]
  );
  if (!res.rows[0]) throw new AppError('NOT_FOUND', 'Local partner not found.');

  await logAdminAudit({
    actor,
    module: 'local_partners',
    action: 'edit',
    entityType: 'local_partner',
    entityId: partnerId,
    after: input,
  });

  safeRevalidateAll(['/destinations']);
  return { ok: true };
}
