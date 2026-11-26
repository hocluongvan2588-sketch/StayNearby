import crypto from 'node:crypto';
import { isValidUuid } from '@/lib/dates';
import { dbQuery, toNum } from '@/lib/db';
import { AppError } from '@/lib/errors';
import {
  logAdminAudit,
  maskEmail,
  type AdminActorContext,
} from '@/modules/admin-rbac';

export interface AttentionItem {
  id: string;
  category:
    | 'host_application'
    | 'listing_review'
    | 'booking_approval'
    | 'refund_request'
    | 'support_ticket'
    | 'safety_report'
    | 'management_report'
    | 'overdue_task';
  title: string;
  subtitle: string;
  severity: 'urgent' | 'high' | 'medium';
  href: string;
  createdAt: string;
}

export async function getOverviewDashboardData(
  actor: AdminActorContext,
  rangeDays = 90
) {
  const days = Math.min(Math.max(Math.round(rangeDays), 7), 365);

  const [
    bookingStatsRes,
    opexRes,
    supplyStatsRes,
    userStatsRes,
    funnelRes,
    destStatsRes,
    monthlyTrendRes,
    pendingAppsRes,
    pendingStaysRes,
    pendingBookingsRes,
    pendingRefundsRes,
    urgentTicketsRes,
    openSafetyRes,
    submittedReportsRes,
    overdueTasksRes,
  ] = await Promise.all([
    dbQuery<{
      total_bookings: string | number;
      confirmed_bookings: string | number;
      cancelled_bookings: string | number;
      gmv_vnd: string | number;
      platform_revenue_vnd: string | number;
      host_payable_vnd: string | number;
      avg_nights: string | number;
    }>(
      `SELECT
        COUNT(*) AS total_bookings,
        COUNT(*) FILTER (WHERE booking_status = 'confirmed') AS confirmed_bookings,
        COUNT(*) FILTER (WHERE booking_status = 'cancelled') AS cancelled_bookings,
        COALESCE(SUM(guest_total_vnd) FILTER (WHERE booking_status = 'confirmed' OR payment_status = 'paid'), 0) AS gmv_vnd,
        COALESCE(SUM(COALESCE(NULLIF(booking_fee_online_vnd, 0), service_fee_vnd)) FILTER (WHERE payment_status IN ('paid', 'partially_refunded')), 0) AS platform_revenue_vnd,
        COALESCE(SUM(COALESCE(NULLIF(pay_at_checkin_vnd, 0), wholesale_total_vnd)) FILTER (WHERE booking_status = 'confirmed'), 0) AS host_payable_vnd,
        COALESCE(AVG(nights) FILTER (WHERE booking_status = 'confirmed'), 0) AS avg_nights
       FROM bookings
       WHERE created_at >= NOW() - ($1 || ' days')::interval`,
      [String(days)]
    ),
    dbQuery<{ total_opex: string | number }>(
      `SELECT COALESCE(SUM(amount_vnd), 0) AS total_opex
       FROM operating_expenses
       WHERE incurred_date >= CURRENT_DATE - $1::integer`,
      [days]
    ),
    dbQuery<{
      live_stays: string | number;
      pending_stays: string | number;
      total_stays: string | number;
    }>(
      `SELECT
        COUNT(*) FILTER (WHERE status IN ('live', 'limited')) AS live_stays,
        COUNT(*) FILTER (WHERE status = 'pending_review') AS pending_stays,
        COUNT(*) AS total_stays
       FROM stays`
    ),
    dbQuery<{
      hosts_count: string | number;
      guests_count: string | number;
      active_leads: string | number;
    }>(
      `SELECT
        (SELECT COUNT(*) FROM users WHERE role = 'host') AS hosts_count,
        (SELECT COUNT(*) FROM users WHERE role = 'nomad') AS guests_count,
        (SELECT COUNT(*) FROM host_leads WHERE stage NOT IN ('lost', 'inactive', 'active')) AS active_leads`
    ),
    dbQuery<{
      stay_views: string | number;
      checkout_starts: string | number;
      completed: string | number;
    }>(
      `SELECT
        COUNT(*) FILTER (WHERE event_name = 'stay_view') AS stay_views,
        COUNT(*) FILTER (WHERE event_name = 'checkout_start') AS checkout_starts,
        COUNT(*) FILTER (WHERE event_name = 'booking_completed') AS completed
       FROM attribution_events
       WHERE created_at >= NOW() - ($1 || ' days')::interval`,
      [String(days)]
    ),
    dbQuery<{
      id: string;
      slug: string;
      name_en: string;
      stays_count: string | number;
      bookings_count: string | number;
      gmv_vnd: string | number;
      revenue_vnd: string | number;
    }>(
      `SELECT
        d.id, d.slug, d.name_en,
        COUNT(DISTINCT s.id) FILTER (WHERE s.status IN ('live', 'limited')) AS stays_count,
        COUNT(DISTINCT b.id) FILTER (WHERE b.booking_status = 'confirmed') AS bookings_count,
        COALESCE(SUM(b.guest_total_vnd) FILTER (WHERE b.booking_status = 'confirmed'), 0) AS gmv_vnd,
        COALESCE(SUM(COALESCE(NULLIF(b.booking_fee_online_vnd, 0), b.service_fee_vnd)) FILTER (WHERE b.payment_status = 'paid'), 0) AS revenue_vnd
       FROM destinations d
       LEFT JOIN stays s ON s.destination_id = d.id
       LEFT JOIN bookings b ON b.stay_id = s.id AND b.created_at >= NOW() - ($1 || ' days')::interval
       GROUP BY d.id, d.slug, d.name_en
       ORDER BY gmv_vnd DESC, stays_count DESC`,
      [String(days)]
    ),
    dbQuery<{
      month_label: string;
      bookings_count: string | number;
      gmv_vnd: string | number;
      revenue_vnd: string | number;
    }>(
      `SELECT
        TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS month_label,
        COUNT(*) FILTER (WHERE booking_status = 'confirmed') AS bookings_count,
        COALESCE(SUM(guest_total_vnd) FILTER (WHERE booking_status = 'confirmed'), 0) AS gmv_vnd,
        COALESCE(SUM(COALESCE(NULLIF(booking_fee_online_vnd, 0), service_fee_vnd)) FILTER (WHERE payment_status = 'paid'), 0) AS revenue_vnd
       FROM bookings
       WHERE created_at >= NOW() - INTERVAL '6 months'
       GROUP BY DATE_TRUNC('month', created_at)
       ORDER BY DATE_TRUNC('month', created_at) ASC`
    ),
    dbQuery<{ id: string; stay_name: string; destination_slug: string; created_at: string }>(
      `SELECT id, stay_name, destination_slug, created_at
       FROM host_applications
       WHERE status = 'submitted'
       ORDER BY created_at DESC LIMIT 6`
    ),
    dbQuery<{ id: string; title_en: string; slug: string; updated_at: string }>(
      `SELECT id, title_en, slug, created_at AS updated_at
       FROM stays WHERE status = 'pending_review'
       ORDER BY created_at DESC LIMIT 6`
    ),
    dbQuery<{ id: string; booking_code: string; guest_total_vnd: string | number; created_at: string }>(
      `SELECT id, booking_code, guest_total_vnd, created_at
       FROM bookings
       WHERE booking_status = 'pending_approval' OR dispute_flag = TRUE
       ORDER BY created_at DESC LIMIT 6`
    ),
    dbQuery<{ id: string; amount_vnd: string | number; refund_type: string; created_at: string }>(
      `SELECT id, amount_vnd, refund_type, created_at
       FROM refund_requests
       WHERE status = 'requested'
       ORDER BY created_at DESC LIMIT 6`
    ),
    dbQuery<{ id: string; ticket_code: string; subject: string; priority: string; created_at: string }>(
      `SELECT id, ticket_code, subject, priority, created_at
       FROM support_tickets
       WHERE status IN ('open', 'in_progress') AND priority IN ('high', 'urgent')
       ORDER BY created_at DESC LIMIT 6`
    ),
    dbQuery<{ id: string; report_type: string; summary: string; severity: string; created_at: string }>(
      `SELECT id, report_type, summary, severity, created_at
       FROM safety_reports
       WHERE status IN ('open', 'investigating')
       ORDER BY created_at DESC LIMIT 5`
    ),
    dbQuery<{ id: string; department: string; period_label: string; created_at: string }>(
      `SELECT id, department, period_label, created_at
       FROM management_reports
       WHERE status = 'submitted'
       ORDER BY created_at DESC LIMIT 5`
    ),
    dbQuery<{ id: string; title: string; priority: string; due_at: string }>(
      `SELECT id, title, priority, due_at
       FROM admin_tasks
       WHERE status <> 'done' AND due_at IS NOT NULL AND due_at < NOW()
       ORDER BY due_at ASC LIMIT 5`
    ),
  ]);

  const b = bookingStatsRes.rows[0];
  const totalBookings = toNum(b?.total_bookings);
  const confirmedBookings = toNum(b?.confirmed_bookings);
  const cancelledBookings = toNum(b?.cancelled_bookings);
  const gmvVnd = toNum(b?.gmv_vnd);
  const platformRevenueVnd = toNum(b?.platform_revenue_vnd);
  const hostPayableVnd = toNum(b?.host_payable_vnd);
  const opexVnd = toNum(opexRes.rows[0]?.total_opex);
  const contributionProfitVnd = platformRevenueVnd - opexVnd;
  const cancellationRatePct =
    totalBookings > 0 ? Math.round((cancelledBookings / totalBookings) * 1000) / 10 : 0;
  const alosNights = Math.round(toNum(b?.avg_nights) * 10) / 10;

  const f = funnelRes.rows[0];
  const stayViews = toNum(f?.stay_views);
  const checkoutStarts = toNum(f?.checkout_starts);
  const funnelCompleted = toNum(f?.completed);
  const conversionRatePct =
    stayViews > 0 ? Math.round((funnelCompleted / stayViews) * 1000) / 10 : 0;

  const attention: AttentionItem[] = [];
  for (const row of pendingAppsRes.rows) {
    attention.push({
      id: `app-${row.id}`,
      category: 'host_application',
      title: `Host application: ${row.stay_name}`,
      subtitle: `Destination: ${row.destination_slug}`,
      severity: 'high',
      href: '/admin/operations/listings?tab=applications',
      createdAt: new Date(String(row.created_at)).toISOString(),
    });
  }
  for (const row of pendingStaysRes.rows) {
    attention.push({
      id: `stay-${row.id}`,
      category: 'listing_review',
      title: `Listing awaiting moderation: ${row.title_en}`,
      subtitle: row.slug,
      severity: 'high',
      href: '/admin/operations/listings?status=pending_review',
      createdAt: new Date(String(row.updated_at)).toISOString(),
    });
  }
  for (const row of pendingRefundsRes.rows) {
    attention.push({
      id: `refund-${row.id}`,
      category: 'refund_request',
      title: `Refund request (${row.refund_type.replace('_', ' ')})`,
      subtitle: `Amount: ${toNum(row.amount_vnd).toLocaleString()} VND`,
      severity: 'urgent',
      href: '/admin/finance/refunds',
      createdAt: new Date(String(row.created_at)).toISOString(),
    });
  }
  for (const row of urgentTicketsRes.rows) {
    attention.push({
      id: `ticket-${row.id}`,
      category: 'support_ticket',
      title: `${row.ticket_code}: ${row.subject}`,
      subtitle: `Priority: ${row.priority.toUpperCase()}`,
      severity: row.priority === 'urgent' ? 'urgent' : 'high',
      href: '/admin/operations/support',
      createdAt: new Date(String(row.created_at)).toISOString(),
    });
  }
  for (const row of pendingBookingsRes.rows) {
    attention.push({
      id: `booking-${row.id}`,
      category: 'booking_approval',
      title: `Booking action required: ${row.booking_code}`,
      subtitle: `Total: ${toNum(row.guest_total_vnd).toLocaleString()} VND`,
      severity: 'high',
      href: '/admin/operations/bookings',
      createdAt: new Date(String(row.created_at)).toISOString(),
    });
  }
  for (const row of openSafetyRes.rows) {
    attention.push({
      id: `safety-${row.id}`,
      category: 'safety_report',
      title: `Safety / Violation: ${row.report_type.replace('_', ' ')}`,
      subtitle: row.summary.slice(0, 90),
      severity: row.severity === 'critical' || row.severity === 'high' ? 'urgent' : 'medium',
      href: '/admin/operations/trust-safety',
      createdAt: new Date(String(row.created_at)).toISOString(),
    });
  }
  for (const row of submittedReportsRes.rows) {
    attention.push({
      id: `report-${row.id}`,
      category: 'management_report',
      title: `Report awaiting sign-off: ${row.department}`,
      subtitle: row.period_label,
      severity: 'medium',
      href: '/admin/workspace/reports',
      createdAt: new Date(String(row.created_at)).toISOString(),
    });
  }
  for (const row of overdueTasksRes.rows) {
    attention.push({
      id: `task-${row.id}`,
      category: 'overdue_task',
      title: `Overdue task: ${row.title}`,
      subtitle: `Due ${new Date(String(row.due_at)).toISOString().slice(0, 10)}`,
      severity: row.priority === 'urgent' ? 'urgent' : 'medium',
      href: '/admin/workspace/tasks',
      createdAt: new Date(String(row.due_at)).toISOString(),
    });
  }

  return {
    rangeDays: days,
    actorSummary: {
      roleName: actor.roleName,
      roleSlug: actor.roleSlug,
      department: actor.department,
      hasPiiAccess: actor.hasPiiAccess,
    },
    kpis: {
      gmvVnd,
      platformRevenueVnd,
      hostPayableVnd,
      opexVnd,
      contributionProfitVnd,
      totalBookings,
      confirmedBookings,
      cancelledBookings,
      cancellationRatePct,
      alosNights,
      conversionRatePct,
      stayViews,
      checkoutStarts,
      liveStays: toNum(supplyStatsRes.rows[0]?.live_stays),
      pendingStays: toNum(supplyStatsRes.rows[0]?.pending_stays),
      totalStays: toNum(supplyStatsRes.rows[0]?.total_stays),
      hostsCount: toNum(userStatsRes.rows[0]?.hosts_count),
      guestsCount: toNum(userStatsRes.rows[0]?.guests_count),
      activeLeads: toNum(userStatsRes.rows[0]?.active_leads),
    },
    destinations: destStatsRes.rows.map((d) => ({
      id: String(d.id),
      slug: String(d.slug),
      nameEn: String(d.name_en),
      staysCount: toNum(d.stays_count),
      bookingsCount: toNum(d.bookings_count),
      gmvVnd: toNum(d.gmv_vnd),
      revenueVnd: toNum(d.revenue_vnd),
    })),
    monthlyTrend: monthlyTrendRes.rows.map((m) => ({
      month: String(m.month_label),
      bookingsCount: toNum(m.bookings_count),
      gmvVnd: toNum(m.gmv_vnd),
      platformRevenueVnd: toNum(m.revenue_vnd),
    })),
    requiresAttention: attention,
  };
}

export async function globalAdminSearch(actor: AdminActorContext, rawQuery: string) {
  const q = rawQuery.trim();
  if (q.length < 2) return { results: [] };
  const pattern = `%${q}%`;

  const [staysRes, bookingsRes, usersRes, leadsRes, ticketsRes, placesRes] = await Promise.all([
    dbQuery<{ id: string; slug: string; title_en: string; status: string }>(
      `SELECT id, slug, title_en, status
       FROM stays
       WHERE title_en ILIKE $1 OR title_vi ILIKE $1 OR slug ILIKE $1 OR registration_code ILIKE $1
       LIMIT 5`,
      [pattern]
    ),
    dbQuery<{ id: string; booking_code: string; booking_status: string; guest_total_vnd: string | number }>(
      `SELECT id, booking_code, booking_status, guest_total_vnd
       FROM bookings
       WHERE booking_code ILIKE $1
       LIMIT 5`,
      [pattern]
    ),
    dbQuery<{ id: string; full_name: string; email: string; role: string }>(
      `SELECT id, full_name, email, role
       FROM users
       WHERE full_name ILIKE $1 OR email ILIKE $1
       LIMIT 5`,
      [pattern]
    ),
    dbQuery<{ id: string; business_name: string; contact_name: string; stage: string }>(
      `SELECT id, business_name, contact_name, stage
       FROM host_leads
       WHERE business_name ILIKE $1 OR contact_name ILIKE $1 OR email ILIKE $1
       LIMIT 5`,
      [pattern]
    ),
    dbQuery<{ id: string; ticket_code: string; subject: string; status: string }>(
      `SELECT id, ticket_code, subject, status
       FROM support_tickets
       WHERE ticket_code ILIKE $1 OR subject ILIKE $1
       LIMIT 5`,
      [pattern]
    ),
    dbQuery<{ id: string; name: string; category: string; slug: string }>(
      `SELECT id, name, category, slug
       FROM places
       WHERE name ILIKE $1 OR address ILIKE $1
       LIMIT 5`,
      [pattern]
    ),
  ]);

  const results: Array<{
    type: string;
    id: string;
    title: string;
    subtitle: string;
    href: string;
  }> = [];

  for (const s of staysRes.rows) {
    results.push({
      type: 'Listing',
      id: s.id,
      title: s.title_en,
      subtitle: `${s.slug} · ${s.status}`,
      href: `/admin/operations/listings?q=${encodeURIComponent(s.slug)}`,
    });
  }
  for (const b of bookingsRes.rows) {
    results.push({
      type: 'Booking',
      id: b.id,
      title: b.booking_code,
      subtitle: `${b.booking_status} · ${toNum(b.guest_total_vnd).toLocaleString()} VND`,
      href: `/admin/operations/bookings?q=${encodeURIComponent(b.booking_code)}`,
    });
  }
  for (const u of usersRes.rows) {
    const emailDisplay = actor.hasPiiAccess ? u.email : maskEmail(u.email);
    results.push({
      type: u.role === 'host' ? 'Host' : u.role === 'admin' ? 'Staff' : 'Guest',
      id: u.id,
      title: u.full_name,
      subtitle: emailDisplay,
      href:
        u.role === 'host'
          ? `/admin/crm/hosts?q=${encodeURIComponent(u.full_name)}`
          : u.role === 'admin'
            ? `/admin/system/team`
            : `/admin/crm/guests?q=${encodeURIComponent(u.full_name)}`,
    });
  }
  for (const l of leadsRes.rows) {
    results.push({
      type: 'Host Lead',
      id: l.id,
      title: l.business_name,
      subtitle: `${l.contact_name} · ${l.stage}`,
      href: `/admin/crm/acquisition?q=${encodeURIComponent(l.business_name)}`,
    });
  }
  for (const t of ticketsRes.rows) {
    results.push({
      type: 'Ticket',
      id: t.id,
      title: `${t.ticket_code} · ${t.subject}`,
      subtitle: t.status,
      href: `/admin/operations/support?q=${encodeURIComponent(t.ticket_code)}`,
    });
  }
  for (const p of placesRes.rows) {
    results.push({
      type: 'Place',
      id: p.id,
      title: p.name,
      subtitle: `${p.category} · ${p.slug}`,
      href: `/admin/growth/discovery?q=${encodeURIComponent(p.name)}`,
    });
  }

  return { results };
}

export async function getWorkspaceNotifications(actor: AdminActorContext) {
  const [bookingNotifsRes, taskAlertsRes, auditRecentRes] = await Promise.all([
    dbQuery<{
      id: string;
      booking_code: string;
      recipient_role: string;
      channel: string;
      recipient_contact: string;
      subject: string;
      status: string;
      created_at: string;
    }>(
      `SELECT bn.id, b.booking_code, bn.recipient_role, bn.channel, bn.recipient_contact,
              bn.subject, bn.status, bn.created_at
       FROM booking_notifications bn
       JOIN bookings b ON b.id = bn.booking_id
       ORDER BY bn.created_at DESC
       LIMIT 30`
    ),
    dbQuery<{
      id: string;
      title: string;
      status: string;
      priority: string;
      due_at: string | null;
      entity_type: string;
    }>(
      `SELECT id, title, status, priority, due_at, entity_type
       FROM admin_tasks
       WHERE status <> 'done' AND (assigned_staff_id = $1 OR assigned_staff_id IS NULL)
       ORDER BY due_at ASC NULLS LAST
       LIMIT 20`,
      [actor.user.id]
    ),
    dbQuery<{
      id: string;
      actor_email: string;
      module: string;
      action: string;
      entity_type: string;
      entity_id: string;
      reason: string;
      created_at: string;
    }>(
      `SELECT id, actor_email, module, action, entity_type, entity_id, reason, created_at
       FROM admin_audit_logs
       ORDER BY created_at DESC
       LIMIT 20`
    ),
  ]);

  return {
    bookingNotifications: bookingNotifsRes.rows.map((n) => ({
      id: String(n.id),
      bookingCode: String(n.booking_code),
      recipientRole: String(n.recipient_role),
      channel: String(n.channel),
      recipientContact: actor.hasPiiAccess
        ? String(n.recipient_contact)
        : maskEmail(String(n.recipient_contact)),
      subject: String(n.subject),
      status: String(n.status),
      createdAt: new Date(String(n.created_at)).toISOString(),
    })),
    taskAlerts: taskAlertsRes.rows.map((t) => ({
      id: String(t.id),
      title: String(t.title),
      status: String(t.status),
      priority: String(t.priority),
      dueAt: t.due_at ? new Date(String(t.due_at)).toISOString() : null,
      entityType: String(t.entity_type),
    })),
    recentAuditEvents: auditRecentRes.rows.map((a) => ({
      id: String(a.id),
      actorEmail: String(a.actor_email),
      module: String(a.module),
      action: String(a.action),
      entityType: String(a.entity_type),
      entityId: String(a.entity_id),
      reason: String(a.reason ?? ''),
      createdAt: new Date(String(a.created_at)).toISOString(),
    })),
  };
}

export async function listAdminTasks(filters?: { status?: string; priority?: string; q?: string }) {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters?.status && filters.status !== 'all') {
    params.push(filters.status);
    conditions.push(`t.status = $${params.length}`);
  }
  if (filters?.priority && filters.priority !== 'all') {
    params.push(filters.priority);
    conditions.push(`t.priority = $${params.length}`);
  }
  if (filters?.q?.trim()) {
    params.push(`%${filters.q.trim()}%`);
    conditions.push(`(t.title ILIKE $${params.length} OR t.description ILIKE $${params.length})`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const [tasksRes, staffRes] = await Promise.all([
    dbQuery<{
      id: string;
      title: string;
      description: string;
      status: string;
      priority: string;
      assigned_staff_id: string | null;
      assignee_name: string | null;
      due_at: string | null;
      entity_type: string;
      entity_id: string;
      auto_rule_key: string | null;
      created_at: string;
      updated_at: string;
    }>(
      `SELECT t.*, u.full_name AS assignee_name
       FROM admin_tasks t
       LEFT JOIN users u ON u.id = t.assigned_staff_id
       ${where}
       ORDER BY
         CASE t.status WHEN 'in_progress' THEN 1 WHEN 'todo' THEN 2 WHEN 'blocked' THEN 3 ELSE 4 END,
         t.due_at ASC NULLS LAST,
         t.created_at DESC`,
      params
    ),
    dbQuery<{ id: string; full_name: string; email: string }>(
      `SELECT u.id, u.full_name, u.email
       FROM users u
       WHERE u.role = 'admin'
       ORDER BY u.full_name ASC`
    ),
  ]);

  return {
    tasks: tasksRes.rows.map((t) => ({
      id: String(t.id),
      title: String(t.title),
      description: String(t.description ?? ''),
      status: String(t.status) as 'todo' | 'in_progress' | 'blocked' | 'done',
      priority: String(t.priority) as 'low' | 'medium' | 'high' | 'urgent',
      assignedStaffId: t.assigned_staff_id ? String(t.assigned_staff_id) : null,
      assigneeName: t.assignee_name ? String(t.assignee_name) : null,
      dueAt: t.due_at ? new Date(String(t.due_at)).toISOString() : null,
      entityType: String(t.entity_type),
      entityId: String(t.entity_id ?? ''),
      autoRuleKey: t.auto_rule_key ? String(t.auto_rule_key) : null,
      createdAt: new Date(String(t.created_at)).toISOString(),
      updatedAt: new Date(String(t.updated_at)).toISOString(),
    })),
    staffOptions: staffRes.rows.map((s) => ({
      id: String(s.id),
      fullName: String(s.full_name),
      email: String(s.email),
    })),
  };
}

export async function createAdminTask(
  actor: AdminActorContext,
  input: {
    title: string;
    description?: string;
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    assignedStaffId?: string | null;
    dueAt?: string | null;
    entityType?:
      | 'general'
      | 'host_lead'
      | 'host'
      | 'guest'
      | 'stay'
      | 'booking'
      | 'ticket'
      | 'payout'
      | 'refund';
    entityId?: string;
  }
) {
  const title = input.title.trim();
  if (title.length < 3) throw new AppError('VALIDATION_ERROR', 'Task title is too short.');

  const id = crypto.randomUUID();
  await dbQuery(
    `INSERT INTO admin_tasks (
      id, title, description, status, priority, assigned_staff_id, created_by,
      due_at, entity_type, entity_id
    ) VALUES ($1,$2,$3,'todo',$4,$5,$6,$7,$8,$9)`,
    [
      id,
      title,
      input.description?.trim() ?? '',
      input.priority ?? 'medium',
      input.assignedStaffId && isValidUuid(input.assignedStaffId) ? input.assignedStaffId : null,
      actor.user.id,
      input.dueAt ? new Date(input.dueAt).toISOString() : null,
      input.entityType ?? 'general',
      input.entityId?.trim() ?? '',
    ]
  );

  await logAdminAudit({
    actor,
    module: 'tasks',
    action: 'create',
    entityType: 'admin_task',
    entityId: id,
    after: { title, priority: input.priority ?? 'medium' },
  });

  return { id };
}

export async function updateAdminTask(
  actor: AdminActorContext,
  taskId: string,
  input: {
    status?: 'todo' | 'in_progress' | 'blocked' | 'done';
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    assignedStaffId?: string | null;
    title?: string;
    description?: string;
    dueAt?: string | null;
  }
) {
  if (!isValidUuid(taskId)) throw new AppError('VALIDATION_ERROR', 'Invalid task ID.');

  const curRes = await dbQuery('SELECT * FROM admin_tasks WHERE id = $1', [taskId]);
  const cur = curRes.rows[0];
  if (!cur) throw new AppError('NOT_FOUND', 'Task not found.');

  await dbQuery(
    `UPDATE admin_tasks
     SET status = COALESCE($1, status),
         priority = COALESCE($2, priority),
         assigned_staff_id = CASE WHEN $3::boolean THEN $4 ELSE assigned_staff_id END,
         title = COALESCE($5, title),
         description = COALESCE($6, description),
         due_at = CASE WHEN $7::boolean THEN $8::timestamptz ELSE due_at END,
         updated_at = NOW()
     WHERE id = $9`,
    [
      input.status ?? null,
      input.priority ?? null,
      input.assignedStaffId !== undefined,
      input.assignedStaffId && isValidUuid(input.assignedStaffId) ? input.assignedStaffId : null,
      input.title?.trim() || null,
      input.description !== undefined ? input.description.trim() : null,
      input.dueAt !== undefined,
      input.dueAt ? new Date(input.dueAt).toISOString() : null,
      taskId,
    ]
  );

  await logAdminAudit({
    actor,
    module: 'tasks',
    action: 'edit',
    entityType: 'admin_task',
    entityId: taskId,
    before: { status: cur.status, priority: cur.priority },
    after: input,
  });

  return { ok: true };
}

export async function listManagementReports() {
  const res = await dbQuery<{
    id: string;
    department: string;
    period_label: string;
    submitted_by: string | null;
    submitter_name: string | null;
    results_summary: string;
    target_comparison: string;
    issues_raised: string;
    root_cause_analysis: string;
    proposed_actions: string;
    next_plan: string;
    approval_request: string;
    status: string;
    executive_comment: string;
    reviewer_name: string | null;
    reviewed_at: string | null;
    created_at: string;
  }>(
    `SELECT mr.*, s.full_name AS submitter_name, r.full_name AS reviewer_name
     FROM management_reports mr
     LEFT JOIN users s ON s.id = mr.submitted_by
     LEFT JOIN users r ON r.id = mr.reviewed_by
     ORDER BY mr.created_at DESC`
  );

  return res.rows.map((r) => ({
    id: String(r.id),
    department: String(r.department),
    periodLabel: String(r.period_label),
    submitterName: r.submitter_name ? String(r.submitter_name) : 'Staff',
    resultsSummary: String(r.results_summary),
    targetComparison: String(r.target_comparison ?? ''),
    issuesRaised: String(r.issues_raised ?? ''),
    rootCauseAnalysis: String(r.root_cause_analysis ?? ''),
    proposedActions: String(r.proposed_actions ?? ''),
    nextPlan: String(r.next_plan ?? ''),
    approvalRequest: String(r.approval_request ?? ''),
    status: String(r.status) as 'draft' | 'submitted' | 'changes_requested' | 'approved',
    executiveComment: String(r.executive_comment ?? ''),
    reviewerName: r.reviewer_name ? String(r.reviewer_name) : null,
    reviewedAt: r.reviewed_at ? new Date(String(r.reviewed_at)).toISOString() : null,
    createdAt: new Date(String(r.created_at)).toISOString(),
  }));
}

export async function createManagementReport(
  actor: AdminActorContext,
  input: {
    department: string;
    periodLabel: string;
    resultsSummary: string;
    targetComparison?: string;
    issuesRaised?: string;
    rootCauseAnalysis?: string;
    proposedActions?: string;
    nextPlan?: string;
    approvalRequest?: string;
    status?: 'draft' | 'submitted';
  }
) {
  const id = crypto.randomUUID();
  await dbQuery(
    `INSERT INTO management_reports (
      id, department, period_label, submitted_by, results_summary, target_comparison,
      issues_raised, root_cause_analysis, proposed_actions, next_plan, approval_request, status
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [
      id,
      input.department.trim(),
      input.periodLabel.trim(),
      actor.user.id,
      input.resultsSummary.trim(),
      input.targetComparison?.trim() ?? '',
      input.issuesRaised?.trim() ?? '',
      input.rootCauseAnalysis?.trim() ?? '',
      input.proposedActions?.trim() ?? '',
      input.nextPlan?.trim() ?? '',
      input.approvalRequest?.trim() ?? '',
      input.status ?? 'submitted',
    ]
  );

  await logAdminAudit({
    actor,
    module: 'reports',
    action: 'create',
    entityType: 'management_report',
    entityId: id,
    after: { department: input.department, periodLabel: input.periodLabel },
  });

  return { id };
}

export async function reviewManagementReport(
  actor: AdminActorContext,
  reportId: string,
  input: {
    decision: 'approved' | 'changes_requested';
    executiveComment: string;
  }
) {
  if (!isValidUuid(reportId)) throw new AppError('VALIDATION_ERROR', 'Invalid report ID.');

  const res = await dbQuery(
    `UPDATE management_reports
     SET status = $1,
         executive_comment = $2,
         reviewed_by = $3,
         reviewed_at = NOW(),
         updated_at = NOW()
     WHERE id = $4
     RETURNING id`,
    [input.decision, input.executiveComment.trim(), actor.user.id, reportId]
  );
  if (!res.rows[0]) throw new AppError('NOT_FOUND', 'Management report not found.');

  await logAdminAudit({
    actor,
    module: 'reports',
    action: 'approve',
    entityType: 'management_report',
    entityId: reportId,
    after: input,
    reason: input.executiveComment,
  });

  return { ok: true };
}
