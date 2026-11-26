import crypto from 'node:crypto';
import type { HostLeadStage } from '@/lib/admin-constants';
import type { DbClient } from '@/lib/db';

const LINEAR_LEAD_STAGES: readonly HostLeadStage[] = [
  'new_lead',
  'contacted',
  'interested',
  'onboarding',
  'under_review',
  'published',
  'first_booking',
  'active',
];

function getStageRank(stage: string): number {
  const idx = LINEAR_LEAD_STAGES.indexOf(stage as HostLeadStage);
  return idx;
}

export function normalizeLeadEmail(email?: string | null): string {
  return String(email ?? '').trim().toLowerCase();
}

export function normalizeLeadPhone(phone?: string | null): string {
  return String(phone ?? '').replace(/[^0-9]/g, '');
}

async function findMatchingLeadForUpdate(
  tx: DbClient,
  params: { userId?: string | null; email?: string | null; phone?: string | null }
): Promise<{
  id: string;
  linked_user_id: string | null;
  stage: string;
  notes: string;
  assigned_staff_id: string | null;
  email: string;
  phone: string;
} | null> {
  const normalizedEmail = normalizeLeadEmail(params.email);
  const normalizedPhone = normalizeLeadPhone(params.phone);
  const last9 = normalizedPhone.length >= 8 ? normalizedPhone.slice(-9) : '';

  if (params.userId) {
    const byUser = await tx.query<{
      id: string;
      linked_user_id: string | null;
      stage: string;
      notes: string;
      assigned_staff_id: string | null;
      email: string;
      phone: string;
    }>(
      `SELECT id, linked_user_id, stage, notes, assigned_staff_id, email, phone
       FROM host_leads
       WHERE linked_user_id = $1
       ORDER BY updated_at DESC
       LIMIT 1
       FOR UPDATE`,
      [params.userId]
    );
    if (byUser.rows[0]) return byUser.rows[0];
  }

  if (normalizedEmail) {
    const byEmail = await tx.query<{
      id: string;
      linked_user_id: string | null;
      stage: string;
      notes: string;
      assigned_staff_id: string | null;
      email: string;
      phone: string;
    }>(
      `SELECT id, linked_user_id, stage, notes, assigned_staff_id, email, phone
       FROM host_leads
       WHERE LOWER(TRIM(email)) = $1
       ORDER BY updated_at DESC
       LIMIT 1
       FOR UPDATE`,
      [normalizedEmail]
    );
    if (byEmail.rows[0]) return byEmail.rows[0];
  }

  if (last9) {
    const byPhone = await tx.query<{
      id: string;
      linked_user_id: string | null;
      stage: string;
      notes: string;
      assigned_staff_id: string | null;
      email: string;
      phone: string;
    }>(
      `SELECT id, linked_user_id, stage, notes, assigned_staff_id, email, phone
       FROM host_leads
       WHERE (
         LENGTH(REGEXP_REPLACE(COALESCE(phone, ''), '[^0-9]', '', 'g')) >= 8
         AND RIGHT(REGEXP_REPLACE(COALESCE(phone, ''), '[^0-9]', '', 'g'), 9) = $1
       ) OR (
         LENGTH(REGEXP_REPLACE(COALESCE(whatsapp_zalo, ''), '[^0-9]', '', 'g')) >= 8
         AND RIGHT(REGEXP_REPLACE(COALESCE(whatsapp_zalo, ''), '[^0-9]', '', 'g'), 9) = $1
       )
       ORDER BY updated_at DESC
       LIMIT 1
       FOR UPDATE`,
      [last9]
    );
    if (byPhone.rows[0]) return byPhone.rows[0];
  }

  return null;
}

async function ensureHostLeadFollowUpTaskTx(
  tx: DbClient,
  params: {
    leadId: string;
    title: string;
    description: string;
    assignedStaffId?: string | null;
    createdBy: string;
  }
) {
  const existingTask = await tx.query<{ id: string }>(
    `SELECT id FROM admin_tasks
     WHERE entity_type = 'host_lead' AND entity_id = $1 AND status IN ('todo', 'in_progress')
     LIMIT 1`,
    [params.leadId]
  );
  if (existingTask.rows[0]) return;

  const ruleRes = await tx.query<{
    is_active: boolean;
    action_config: { defaultPriority?: string; dueHours?: number } | null;
  }>(`SELECT is_active, action_config FROM automation_rules WHERE rule_key = $1 LIMIT 1`, [
    'auto_task_host_application',
  ]);
  const rule = ruleRes.rows[0];
  if (rule && !rule.is_active) return;

  const cfg = rule?.action_config ?? {};
  const priority =
    cfg.defaultPriority === 'low' ||
    cfg.defaultPriority === 'medium' ||
    cfg.defaultPriority === 'high' ||
    cfg.defaultPriority === 'urgent'
      ? cfg.defaultPriority
      : 'high';
  const dueHours = Number(cfg.dueHours ?? 24) || 24;

  await tx.query(
    `INSERT INTO admin_tasks (
      id, title, description, priority, status, entity_type, entity_id,
      assigned_staff_id, due_at, created_by, auto_rule_key
    ) VALUES (
      $1,$2,$3,$4,'todo','host_lead',$5,$6, NOW() + ($7 || ' hours')::interval, $8, $9
    )`,
    [
      crypto.randomUUID(),
      params.title,
      params.description,
      priority,
      params.leadId,
      params.assignedStaffId ?? null,
      String(dueHours),
      params.createdBy,
      'auto_task_host_application',
    ]
  );
}

export async function syncHostLeadFromApplicationTx(
  tx: DbClient,
  params: {
    applicationId: string;
    userId: string;
    email: string;
    fullName: string;
    phone?: string | null;
    businessName: string;
    stayName: string;
    destinationSlug: string;
    propertyType: string;
    sourceDetail?: string;
    utmSource?: string;
    utmCampaign?: string;
  }
): Promise<{ leadId: string; created: boolean; stage: HostLeadStage }> {
  const normalizedEmail = normalizeLeadEmail(params.email);
  const existing = await findMatchingLeadForUpdate(tx, {
    userId: params.userId,
    email: normalizedEmail,
    phone: params.phone,
  });

  const srcDetail = (params.sourceDetail ?? 'list_your_stay_form').trim().slice(0, 120);
  const utmSrc = (params.utmSource ?? '').trim().slice(0, 120);
  const utmCamp = (params.utmCampaign ?? '').trim().slice(0, 120);

  if (existing) {
    // Preserve existing higher pipeline stage (never downgrade to new_lead);
    // advance early/re-engaged stages to 'under_review' since an application was formally submitted.
    const currentRank = getStageRank(existing.stage);
    const underReviewRank = getStageRank('under_review');
    const nextStage: HostLeadStage =
      currentRank >= underReviewRank
        ? (existing.stage as HostLeadStage)
        : 'under_review';

    await tx.query(
      `UPDATE host_leads
       SET linked_user_id = COALESCE(linked_user_id, $1),
           application_id = $2,
           stage = $3,
           destination_slug = COALESCE(NULLIF($4, ''), destination_slug),
           property_type = COALESCE(NULLIF($5, ''), property_type),
           source_detail = COALESCE(NULLIF($6, ''), source_detail),
           utm_source = COALESCE(NULLIF($7, ''), utm_source),
           utm_campaign = COALESCE(NULLIF($8, ''), utm_campaign),
           updated_at = NOW()
       WHERE id = $9`,
      [
        params.userId,
        params.applicationId,
        nextStage,
        params.destinationSlug,
        params.propertyType,
        srcDetail,
        utmSrc,
        utmCamp,
        existing.id,
      ]
    );

    await tx.query(
      `INSERT INTO crm_activities (id, entity_type, entity_id, activity_type, summary, body, actor_user_id)
       VALUES ($1, 'host_lead', $2, 'system', $3, $4, $5)`,
      [
        crypto.randomUUID(),
        existing.id,
        `Application submitted via /list-your-stay: ${params.stayName}`,
        JSON.stringify({
          applicationId: params.applicationId,
          businessName: params.businessName,
          stayName: params.stayName,
          destinationSlug: params.destinationSlug,
          propertyType: params.propertyType,
          previousStage: existing.stage,
          nextStage,
          sourceDetail: srcDetail,
          utmSource: utmSrc || undefined,
          utmCampaign: utmCamp || undefined,
        }),
        params.userId,
      ]
    );

    await ensureHostLeadFollowUpTaskTx(tx, {
      leadId: existing.id,
      title: `Review resubmitted host application: ${params.stayName}`,
      description: `${params.businessName} (${params.destinationSlug}) submitted application ${params.applicationId}. Previous notes & assignee preserved.`,
      assignedStaffId: existing.assigned_staff_id,
      createdBy: params.userId,
    });

    return { leadId: existing.id, created: false, stage: nextStage };
  }

  const leadId = crypto.randomUUID();
  const initialStage: HostLeadStage = 'new_lead';
  const cleanPhone = String(params.phone ?? '').trim();

  await tx.query(
    `INSERT INTO host_leads (
      id, linked_user_id, source, business_name, contact_name, email, phone, whatsapp_zalo,
      destination_slug, property_type, estimated_units, stage, kyc_status, notes,
      application_id, source_detail, utm_source, utm_campaign
    ) VALUES (
      $1,$2,'list_your_stay',$3,$4,$5,$6,$6,$7,$8,1,$9,'pending','',$10,$11,$12,$13
    )`,
    [
      leadId,
      params.userId,
      params.businessName.trim(),
      params.fullName.trim() || params.businessName.trim(),
      normalizedEmail,
      cleanPhone,
      params.destinationSlug,
      params.propertyType,
      initialStage,
      params.applicationId,
      srcDetail,
      utmSrc,
      utmCamp,
    ]
  );

  await tx.query(
    `INSERT INTO crm_activities (id, entity_type, entity_id, activity_type, summary, body, actor_user_id)
     VALUES ($1, 'host_lead', $2, 'system', $3, $4, $5)`,
    [
      crypto.randomUUID(),
      leadId,
      `New host lead captured via /list-your-stay: ${params.stayName}`,
      JSON.stringify({
        applicationId: params.applicationId,
        businessName: params.businessName,
        stayName: params.stayName,
        destinationSlug: params.destinationSlug,
        propertyType: params.propertyType,
        sourceDetail: srcDetail,
        utmSource: utmSrc || undefined,
        utmCampaign: utmCamp || undefined,
      }),
      params.userId,
    ]
  );

  await ensureHostLeadFollowUpTaskTx(tx, {
    leadId,
    title: `Review new host application: ${params.stayName}`,
    description: `${params.businessName} (${params.destinationSlug}) applied via /list-your-stay. Verify details & approve listing.`,
    assignedStaffId: null,
    createdBy: params.userId,
  });

  return { leadId, created: true, stage: initialStage };
}

export async function advanceHostLeadMilestoneTx(
  tx: DbClient,
  params: {
    userId?: string | null;
    email?: string | null;
    targetStage: HostLeadStage;
    summary: string;
    actorUserId?: string | null;
    body?: string;
    allowFromLost?: boolean;
  }
): Promise<{ updated: boolean; leadId?: string; stage?: string }> {
  const lead = await findMatchingLeadForUpdate(tx, {
    userId: params.userId,
    email: params.email,
  });
  if (!lead) return { updated: false };

  if ((lead.stage === 'lost' || lead.stage === 'inactive') && !params.allowFromLost) {
    return { updated: false, leadId: lead.id, stage: lead.stage };
  }

  const currentRank = getStageRank(lead.stage);
  const targetRank = getStageRank(params.targetStage);

  if (targetRank <= currentRank && currentRank >= 0) {
    return { updated: false, leadId: lead.id, stage: lead.stage };
  }

  await tx.query(
    `UPDATE host_leads
     SET stage = $1,
         linked_user_id = COALESCE(linked_user_id, $2),
         updated_at = NOW()
     WHERE id = $3`,
    [params.targetStage, params.userId ?? null, lead.id]
  );

  await tx.query(
    `INSERT INTO crm_activities (id, entity_type, entity_id, activity_type, summary, body, actor_user_id)
     VALUES ($1, 'host_lead', $2, 'stage_change', $3, $4, $5)`,
    [
      crypto.randomUUID(),
      lead.id,
      `${params.summary} (${lead.stage} -> ${params.targetStage})`,
      params.body ?? '',
      params.actorUserId ?? params.userId ?? null,
    ]
  );

  return { updated: true, leadId: lead.id, stage: params.targetStage };
}
