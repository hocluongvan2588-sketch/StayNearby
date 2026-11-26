import crypto from 'node:crypto';
import type { SessionUser } from '@/lib/auth/session';
import { requireRole } from '@/lib/auth/session';
import { dbQuery, type DbClient } from '@/lib/db';
import { AppError } from '@/lib/errors';

export type AdminAction =
  | 'view'
  | 'create'
  | 'edit'
  | 'approve'
  | 'delete'
  | 'export'
  | 'assign';

export const ALL_ADMIN_ACTIONS: AdminAction[] = [
  'view',
  'create',
  'edit',
  'approve',
  'delete',
  'export',
  'assign',
];

export const ADMIN_MODULE_KEYS = [
  'overview',
  'executive',
  'tasks',
  'notifications',
  'reports',
  'host_crm',
  'guest_crm',
  'host_acquisition',
  'local_partners',
  'listings',
  'bookings',
  'reviews',
  'support',
  'safety',
  'destinations',
  'discovery',
  'content',
  'campaigns',
  'promotions',
  'finance_transactions',
  'finance_revenue',
  'finance_payouts',
  'finance_refunds',
  'finance_reconciliation',
  'finance_invoices',
  'finance_reports',
  'system_team',
  'system_roles',
  'system_audit',
  'system_settings',
] as const;

export type AdminModuleKey = (typeof ADMIN_MODULE_KEYS)[number];

export interface ModulePermissionGrant {
  moduleKey: AdminModuleKey;
  actions: AdminAction[];
  piiAccess: boolean;
  dataScope: 'all' | 'assigned' | 'department';
}

export interface AdminActorContext {
  user: SessionUser;
  roleId: string;
  roleSlug: string;
  roleName: string;
  department: string;
  title: string;
  assignedCities: string[];
  permissions: Record<string, ModulePermissionGrant>;
  hasPiiAccess: boolean;
}

export interface SystemRoleTemplate {
  id: string;
  slug: string;
  name: string;
  description: string;
  piiAccess: boolean;
  grants: Partial<Record<AdminModuleKey, AdminAction[]>>;
}

export const SYSTEM_ROLE_TEMPLATES: SystemRoleTemplate[] = [
  {
    id: 'a1000000-0000-4000-8000-000000000001',
    slug: 'super_admin',
    name: 'Super Admin',
    description: 'Full access to all Business Operating System modules, RBAC, finance, and audit logs.',
    piiAccess: true,
    grants: Object.fromEntries(ADMIN_MODULE_KEYS.map((k) => [k, ALL_ADMIN_ACTIONS])),
  },
  {
    id: 'a1000000-0000-4000-8000-000000000002',
    slug: 'executive',
    name: 'Executive',
    description: 'Founder and leadership overview, P&L, department reports, and strategic approvals.',
    piiAccess: true,
    grants: {
      overview: ['view', 'export'],
      executive: ['view', 'export'],
      reports: ['view', 'approve', 'edit'],
      tasks: ['view', 'create', 'assign'],
      notifications: ['view'],
      host_crm: ['view'],
      guest_crm: ['view'],
      host_acquisition: ['view'],
      local_partners: ['view'],
      listings: ['view'],
      bookings: ['view', 'export'],
      reviews: ['view'],
      support: ['view'],
      safety: ['view'],
      destinations: ['view'],
      discovery: ['view'],
      content: ['view'],
      campaigns: ['view'],
      promotions: ['view'],
      finance_transactions: ['view', 'export'],
      finance_revenue: ['view', 'export'],
      finance_payouts: ['view'],
      finance_refunds: ['view', 'approve'],
      finance_reconciliation: ['view'],
      finance_invoices: ['view'],
      finance_reports: ['view', 'export'],
      system_audit: ['view'],
    },
  },
  {
    id: 'a1000000-0000-4000-8000-000000000003',
    slug: 'operations_manager',
    name: 'Operations Manager',
    description: 'Leads supply moderation, booking operations, support SLAs, and trust & safety.',
    piiAccess: true,
    grants: {
      overview: ['view', 'export'],
      tasks: ['view', 'create', 'edit', 'assign'],
      notifications: ['view', 'edit'],
      reports: ['view', 'create', 'edit'],
      host_crm: ['view', 'edit', 'assign'],
      guest_crm: ['view', 'edit'],
      host_acquisition: ['view', 'edit', 'approve', 'assign'],
      listings: ['view', 'create', 'edit', 'approve', 'assign'],
      bookings: ['view', 'edit', 'approve', 'export', 'assign'],
      reviews: ['view', 'edit', 'approve', 'delete'],
      support: ['view', 'create', 'edit', 'assign', 'approve'],
      safety: ['view', 'create', 'edit', 'approve', 'assign'],
      destinations: ['view', 'edit'],
      discovery: ['view', 'create', 'edit'],
      finance_refunds: ['view', 'create'],
    },
  },
  {
    id: 'a1000000-0000-4000-8000-000000000004',
    slug: 'host_acquisition',
    name: 'Host Acquisition',
    description: 'Manages host lead pipeline, onboarding outreach, and converting leads to live hosts.',
    piiAccess: false,
    grants: {
      overview: ['view'],
      tasks: ['view', 'create', 'edit'],
      notifications: ['view'],
      host_acquisition: ['view', 'create', 'edit', 'approve', 'assign'],
      host_crm: ['view', 'create', 'edit'],
      listings: ['view', 'create', 'edit'],
      destinations: ['view'],
      reports: ['view', 'create'],
    },
  },
  {
    id: 'a1000000-0000-4000-8000-000000000005',
    slug: 'listing_moderator',
    name: 'Listing Moderator',
    description: 'Reviews property submissions, photos, descriptions, visibility, and featured placement.',
    piiAccess: false,
    grants: {
      overview: ['view'],
      tasks: ['view', 'edit'],
      notifications: ['view'],
      listings: ['view', 'edit', 'approve'],
      host_crm: ['view'],
      safety: ['view', 'create', 'edit'],
      destinations: ['view'],
      discovery: ['view'],
    },
  },
  {
    id: 'a1000000-0000-4000-8000-000000000006',
    slug: 'customer_support',
    name: 'Customer Support',
    description: 'Handles guest/host support tickets, booking notes, disputes, and refund requests.',
    piiAccess: true,
    grants: {
      overview: ['view'],
      tasks: ['view', 'create', 'edit'],
      notifications: ['view', 'edit'],
      guest_crm: ['view', 'edit'],
      host_crm: ['view'],
      bookings: ['view', 'edit'],
      reviews: ['view', 'edit'],
      support: ['view', 'create', 'edit', 'assign'],
      safety: ['view', 'create', 'edit'],
      finance_refunds: ['view', 'create'],
      reports: ['view', 'create'],
    },
  },
  {
    id: 'a1000000-0000-4000-8000-000000000007',
    slug: 'finance',
    name: 'Finance',
    description: 'Manages GMV/Revenue ledgers, host payouts, refunds, reconciliation, invoices, and FX rates.',
    piiAccess: false,
    grants: {
      overview: ['view', 'export'],
      tasks: ['view', 'create', 'edit'],
      notifications: ['view'],
      reports: ['view', 'create', 'edit'],
      bookings: ['view', 'export'],
      host_crm: ['view'],
      guest_crm: ['view'],
      finance_transactions: ['view', 'create', 'edit', 'export'],
      finance_revenue: ['view', 'export'],
      finance_payouts: ['view', 'create', 'edit', 'approve', 'export'],
      finance_refunds: ['view', 'create', 'edit', 'approve', 'export'],
      finance_reconciliation: ['view', 'create', 'edit', 'approve', 'export'],
      finance_invoices: ['view', 'create', 'edit', 'export'],
      finance_reports: ['view', 'create', 'edit', 'export'],
      system_settings: ['view', 'edit'],
    },
  },
  {
    id: 'a1000000-0000-4000-8000-000000000008',
    slug: 'marketing',
    name: 'Marketing',
    description: 'Tracks campaigns, UTM attribution funnels, promo codes, and revenue-backed conversion.',
    piiAccess: false,
    grants: {
      overview: ['view', 'export'],
      tasks: ['view', 'create', 'edit'],
      reports: ['view', 'create', 'edit'],
      destinations: ['view'],
      discovery: ['view'],
      content: ['view', 'edit'],
      campaigns: ['view', 'create', 'edit', 'delete', 'export'],
      promotions: ['view', 'create', 'edit', 'approve', 'delete'],
    },
  },
  {
    id: 'a1000000-0000-4000-8000-000000000009',
    slug: 'content_seo',
    name: 'Content & SEO',
    description: 'Curates destinations, neighborhoods, local discovery places, editorial guides, and SEO metadata.',
    piiAccess: false,
    grants: {
      overview: ['view'],
      tasks: ['view', 'create', 'edit'],
      destinations: ['view', 'create', 'edit', 'approve'],
      discovery: ['view', 'create', 'edit', 'approve', 'delete'],
      content: ['view', 'create', 'edit', 'approve', 'delete'],
      campaigns: ['view'],
      reports: ['view', 'create'],
    },
  },
  {
    id: 'a1000000-0000-4000-8000-000000000010',
    slug: 'local_partner_manager',
    name: 'Local Partner Manager',
    description: 'Builds local merchant partnerships (cafes, coworking, gyms, transport) linked to Local Discovery.',
    piiAccess: false,
    grants: {
      overview: ['view'],
      tasks: ['view', 'create', 'edit'],
      local_partners: ['view', 'create', 'edit', 'approve', 'assign'],
      discovery: ['view', 'create', 'edit'],
      destinations: ['view'],
      reports: ['view', 'create'],
    },
  },
];

let rolesSeededInProcess = false;

export async function seedSystemRoles(tx?: DbClient): Promise<void> {
  const exec = tx
    ? <T extends Record<string, unknown>>(s: string, p?: unknown[]) => tx.query<T>(s, p)
    : <T extends Record<string, unknown>>(s: string, p?: unknown[]) => dbQuery<T>(s, p);

  for (const tpl of SYSTEM_ROLE_TEMPLATES) {
    await exec(
      `INSERT INTO admin_roles (id, slug, name, description, is_system)
       VALUES ($1, $2, $3, $4, TRUE)
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description`,
      [tpl.id, tpl.slug, tpl.name, tpl.description]
    );

    const roleRow = await exec<{ id: string }>('SELECT id FROM admin_roles WHERE slug = $1', [
      tpl.slug,
    ]);
    const roleId = roleRow.rows[0]?.id ?? tpl.id;

    for (const [moduleKey, actions] of Object.entries(tpl.grants)) {
      if (!actions || actions.length === 0) continue;
      await exec(
        `INSERT INTO admin_role_permissions (role_id, module_key, actions, pii_access, data_scope)
         VALUES ($1, $2, $3::jsonb, $4, 'all')
         ON CONFLICT (role_id, module_key) DO NOTHING`,
        [roleId, moduleKey, JSON.stringify(actions), tpl.piiAccess]
      );
    }
  }
  rolesSeededInProcess = true;
}

export async function ensureSystemRolesSeeded(): Promise<void> {
  if (rolesSeededInProcess) return;
  const cnt = await dbQuery<{ c: string | number }>(
    'SELECT COUNT(*) AS c FROM admin_role_permissions'
  );
  if (Number(cnt.rows[0]?.c ?? 0) === 0) {
    await seedSystemRoles();
  } else {
    rolesSeededInProcess = true;
  }
}

export async function getAdminActorContext(user: SessionUser): Promise<AdminActorContext> {
  await ensureSystemRolesSeeded();

  const staffRes = await dbQuery<{
    role_id: string;
    role_slug: string;
    role_name: string;
    department: string;
    title: string;
    is_active: boolean;
    assigned_cities: unknown;
  }>(
    `SELECT sp.role_id, ar.slug AS role_slug, ar.name AS role_name,
            sp.department, sp.title, sp.is_active, sp.assigned_cities
     FROM admin_staff_profiles sp
     JOIN admin_roles ar ON ar.id = sp.role_id
     WHERE sp.user_id = $1`,
    [user.id]
  );

  let roleRow = staffRes.rows[0];
  if (roleRow && !roleRow.is_active) {
    throw new AppError('FORBIDDEN', 'Your staff profile has been deactivated.');
  }

  // Fallback for primary legacy admin users without an explicit staff profile row yet
  if (!roleRow) {
    const superRes = await dbQuery<{ id: string; slug: string; name: string }>(
      `SELECT id, slug, name FROM admin_roles WHERE slug = 'super_admin' LIMIT 1`
    );
    const sup = superRes.rows[0];
    if (!sup) {
      throw new AppError('UNAVAILABLE', 'System Super Admin role is missing.');
    }
    roleRow = {
      role_id: sup.id,
      role_slug: sup.slug,
      role_name: sup.name,
      department: 'Executive',
      title: 'Platform Administrator',
      is_active: true,
      assigned_cities: [],
    };
  }

  const permRes = await dbQuery<{
    module_key: string;
    actions: unknown;
    pii_access: boolean;
    data_scope: 'all' | 'assigned' | 'department';
  }>(
    `SELECT module_key, actions, pii_access, data_scope
     FROM admin_role_permissions
     WHERE role_id = $1`,
    [roleRow.role_id]
  );

  const permissions: Record<string, ModulePermissionGrant> = {};
  let hasPiiAccess = roleRow.role_slug === 'super_admin';

  for (const row of permRes.rows) {
    const acts = Array.isArray(row.actions) ? (row.actions as AdminAction[]) : [];
    const pii = Boolean(row.pii_access);
    if (pii) hasPiiAccess = true;
    permissions[row.module_key] = {
      moduleKey: row.module_key as AdminModuleKey,
      actions: acts,
      piiAccess: pii,
      dataScope: row.data_scope ?? 'all',
    };
  }

  // Ensure super_admin always retains full permissions dynamically even on future modules
  if (roleRow.role_slug === 'super_admin') {
    for (const key of ADMIN_MODULE_KEYS) {
      permissions[key] = {
        moduleKey: key,
        actions: ALL_ADMIN_ACTIONS,
        piiAccess: true,
        dataScope: 'all',
      };
    }
  }

  return {
    user,
    roleId: String(roleRow.role_id),
    roleSlug: String(roleRow.role_slug),
    roleName: String(roleRow.role_name),
    department: String(roleRow.department),
    title: String(roleRow.title),
    assignedCities: Array.isArray(roleRow.assigned_cities)
      ? roleRow.assigned_cities.map((c) => String(c))
      : [],
    permissions,
    hasPiiAccess,
  };
}

export function canPerform(
  ctx: AdminActorContext,
  moduleKey: AdminModuleKey,
  action: AdminAction
): boolean {
  if (ctx.roleSlug === 'super_admin') return true;
  const grant = ctx.permissions[moduleKey];
  if (!grant) return false;
  return grant.actions.includes(action);
}

export async function requireAdminPermission(
  moduleKey: AdminModuleKey,
  action: AdminAction = 'view'
): Promise<AdminActorContext> {
  const user = await requireRole('admin');
  const ctx = await getAdminActorContext(user);
  if (!canPerform(ctx, moduleKey, action)) {
    throw new AppError(
      'FORBIDDEN',
      `Your role (${ctx.roleName}) lacks '${action}' permission for '${moduleKey}'.`
    );
  }
  return ctx;
}

export async function assertAdminActorHasPermission(
  userOrActor: SessionUser | AdminActorContext,
  moduleKey: AdminModuleKey,
  action: AdminAction = 'view'
): Promise<AdminActorContext> {
  const ctx = 'user' in userOrActor
    ? userOrActor
    : await (() => {
        if (userOrActor.role !== 'admin') {
          throw new AppError('FORBIDDEN', 'Admin role required.');
        }
        return getAdminActorContext(userOrActor);
      })();

  if (!canPerform(ctx, moduleKey, action)) {
    throw new AppError(
      'FORBIDDEN',
      `Role ${ctx.roleName} cannot perform '${action}' on '${moduleKey}'.`
    );
  }
  return ctx;
}

export async function logAdminAudit(
  input: {
    actor: AdminActorContext | SessionUser | { id: string; email: string };
    module: string;
    action: string;
    entityType: string;
    entityId: string;
    before?: unknown;
    after?: unknown;
    reason?: string;
    ipAddress?: string;
  },
  tx?: DbClient
): Promise<void> {
  const actorUser = 'user' in input.actor ? input.actor.user : input.actor;
  const exec = tx
    ? (s: string, p?: unknown[]) => tx.query(s, p)
    : (s: string, p?: unknown[]) => dbQuery(s, p);

  await exec(
    `INSERT INTO admin_audit_logs (
      id, actor_user_id, actor_email, module, action, entity_type, entity_id,
      before_json, after_json, reason, ip_address
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10, $11)`,
    [
      crypto.randomUUID(),
      actorUser.id,
      actorUser.email,
      input.module,
      input.action,
      input.entityType,
      input.entityId,
      input.before !== undefined ? JSON.stringify(input.before) : null,
      input.after !== undefined ? JSON.stringify(input.after) : null,
      input.reason?.trim() || '',
      input.ipAddress?.trim() || '',
    ]
  );
}

export function maskEmail(email: string | null | undefined): string {
  if (!email || !email.includes('@')) return email ?? '';
  const [local, domain] = email.split('@');
  return `${local.slice(0, 2)}***@${domain}`;
}

export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return '';
  const trimmed = phone.trim();
  if (trimmed.length <= 4) return '****';
  return `${trimmed.slice(0, 3)}****${trimmed.slice(-3)}`;
}

export function maskEmailIfRestricted(email: string, hasPiiAccess: boolean): string {
  if (hasPiiAccess || !email.includes('@')) return email;
  return maskEmail(email);
}

export function maskPhoneIfRestricted(phone: string, hasPiiAccess: boolean): string {
  if (hasPiiAccess || !phone) return phone;
  return maskPhone(phone);
}
