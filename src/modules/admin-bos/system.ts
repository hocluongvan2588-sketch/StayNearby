import crypto from 'node:crypto';
import { hashPassword } from '@/lib/auth/password';
import { isValidUuid } from '@/lib/dates';
import { dbQuery, dbTransaction } from '@/lib/db';
import { AppError } from '@/lib/errors';
import {
  ADMIN_MODULE_KEYS,
  ALL_ADMIN_ACTIONS,
  ensureSystemRolesSeeded,
  logAdminAudit,
  type AdminAction,
  type AdminActorContext,
} from '@/modules/admin-rbac';

export async function listAdminTeamMembers() {
  await ensureSystemRolesSeeded();

  const [staffRes, rolesRes] = await Promise.all([
    dbQuery<{
      user_id: string;
      email: string;
      full_name: string;
      role_id: string | null;
      role_slug: string | null;
      role_name: string | null;
      department: string | null;
      title: string | null;
      is_active: boolean | null;
      assigned_cities: unknown;
      created_at: string;
    }>(
      `SELECT u.id AS user_id, u.email, u.full_name, u.created_at,
              sp.role_id, ar.slug AS role_slug, ar.name AS role_name,
              sp.department, sp.title, sp.is_active, sp.assigned_cities
       FROM users u
       LEFT JOIN admin_staff_profiles sp ON sp.user_id = u.id
       LEFT JOIN admin_roles ar ON ar.id = sp.role_id
       WHERE u.role = 'admin' OR sp.user_id IS NOT NULL
       ORDER BY u.created_at ASC`
    ),
    dbQuery<{ id: string; slug: string; name: string }>(
      `SELECT id, slug, name FROM admin_roles ORDER BY is_system DESC, name ASC`
    ),
  ]);

  return {
    members: staffRes.rows.map((m) => ({
      userId: String(m.user_id),
      email: String(m.email),
      fullName: String(m.full_name),
      roleId: m.role_id ? String(m.role_id) : 'a1000000-0000-4000-8000-000000000001',
      roleSlug: m.role_slug ? String(m.role_slug) : 'super_admin',
      roleName: m.role_name ? String(m.role_name) : 'Super Admin',
      department: m.department ? String(m.department) : 'Executive',
      title: m.title ? String(m.title) : 'Platform Admin',
      isActive: m.is_active === null ? true : Boolean(m.is_active),
      assignedCities: Array.isArray(m.assigned_cities) ? (m.assigned_cities as string[]) : [],
      createdAt: new Date(String(m.created_at)).toISOString(),
    })),
    roles: rolesRes.rows.map((r) => ({
      id: String(r.id),
      slug: String(r.slug),
      name: String(r.name),
    })),
  };
}

export async function inviteOrAssignStaffMember(
  actor: AdminActorContext,
  input: {
    email: string;
    fullName: string;
    password?: string;
    roleId: string;
    department: string;
    title: string;
    assignedCities?: string[];
  }
) {
  await ensureSystemRolesSeeded();
  if (!isValidUuid(input.roleId)) throw new AppError('VALIDATION_ERROR', 'Invalid role ID.');
  const email = input.email.trim().toLowerCase();

  return dbTransaction(async (tx) => {
    const roleCheck = await tx.query('SELECT id, name FROM admin_roles WHERE id = $1', [input.roleId]);
    if (!roleCheck.rows[0]) throw new AppError('NOT_FOUND', 'Role not found.');

    const existing = await tx.query<{ id: string }>('SELECT id FROM users WHERE LOWER(email) = $1', [
      email,
    ]);

    let userId = existing.rows[0]?.id;
    if (!userId) {
      if (!input.password || input.password.length < 8) {
        throw new AppError(
          'VALIDATION_ERROR',
          'Password of at least 8 characters is required for new staff accounts.'
        );
      }
      userId = crypto.randomUUID();
      const pwHash = await hashPassword(input.password);
      await tx.query(
        `INSERT INTO users (id, email, password_hash, full_name, role, nationality, crm_stage)
         VALUES ($1,$2,$3,$4,'admin','Vietnam','active')`,
        [userId, email, pwHash, input.fullName.trim()]
      );
    } else {
      await tx.query(`UPDATE users SET role = 'admin', full_name = $1 WHERE id = $2`, [
        input.fullName.trim(),
        userId,
      ]);
    }

    await tx.query(
      `INSERT INTO admin_staff_profiles (user_id, role_id, department, title, is_active, assigned_cities)
       VALUES ($1,$2,$3,$4,TRUE,$5::jsonb)
       ON CONFLICT (user_id) DO UPDATE
       SET role_id = EXCLUDED.role_id,
           department = EXCLUDED.department,
           title = EXCLUDED.title,
           is_active = TRUE,
           assigned_cities = EXCLUDED.assigned_cities,
           updated_at = NOW()`,
      [
        userId,
        input.roleId,
        input.department.trim(),
        input.title.trim(),
        JSON.stringify(input.assignedCities ?? []),
      ]
    );

    await logAdminAudit(
      {
        actor,
        module: 'system_team',
        action: existing.rows[0] ? 'edit' : 'create',
        entityType: 'admin_staff_profile',
        entityId: userId,
        after: { email, roleId: input.roleId, department: input.department, title: input.title },
      },
      tx
    );

    return { userId };
  });
}

export async function updateStaffProfile(
  actor: AdminActorContext,
  targetUserId: string,
  input: {
    roleId?: string;
    department?: string;
    title?: string;
    isActive?: boolean;
  }
) {
  if (!isValidUuid(targetUserId)) throw new AppError('VALIDATION_ERROR', 'Invalid staff ID.');
  if (targetUserId === actor.user.id && input.isActive === false) {
    throw new AppError('CONFLICT', 'You cannot deactivate your own admin account.');
  }

  await dbQuery(
    `UPDATE admin_staff_profiles
     SET role_id = COALESCE($1, role_id),
         department = COALESCE($2, department),
         title = COALESCE($3, title),
         is_active = COALESCE($4, is_active),
         updated_at = NOW()
     WHERE user_id = $5`,
    [
      input.roleId && isValidUuid(input.roleId) ? input.roleId : null,
      input.department?.trim() ?? null,
      input.title?.trim() ?? null,
      input.isActive ?? null,
      targetUserId,
    ]
  );

  await logAdminAudit({
    actor,
    module: 'system_team',
    action: 'edit',
    entityType: 'admin_staff_profile',
    entityId: targetUserId,
    after: input,
  });

  return { ok: true };
}

export async function listRolesAndPermissions() {
  await ensureSystemRolesSeeded();

  const [rolesRes, permsRes] = await Promise.all([
    dbQuery<{
      id: string;
      slug: string;
      name: string;
      description: string;
      is_system: boolean;
      members_count: string | number;
    }>(
      `SELECT ar.*, COUNT(sp.user_id) AS members_count
       FROM admin_roles ar
       LEFT JOIN admin_staff_profiles sp ON sp.role_id = ar.id AND sp.is_active = TRUE
       GROUP BY ar.id
       ORDER BY ar.is_system DESC, ar.name ASC`
    ),
    dbQuery<{
      role_id: string;
      module_key: string;
      actions: unknown;
      pii_access: boolean;
      data_scope: string;
    }>(`SELECT * FROM admin_role_permissions`),
  ]);

  const permsByRole: Record<
    string,
    Array<{
      moduleKey: string;
      actions: AdminAction[];
      piiAccess: boolean;
      dataScope: string;
    }>
  > = {};

  for (const p of permsRes.rows) {
    const rid = String(p.role_id);
    if (!permsByRole[rid]) permsByRole[rid] = [];
    permsByRole[rid].push({
      moduleKey: String(p.module_key),
      actions: Array.isArray(p.actions) ? (p.actions as AdminAction[]) : [],
      piiAccess: Boolean(p.pii_access),
      dataScope: String(p.data_scope),
    });
  }

  return {
    modules: [...ADMIN_MODULE_KEYS],
    actions: [...ALL_ADMIN_ACTIONS],
    roles: rolesRes.rows.map((r) => ({
      id: String(r.id),
      slug: String(r.slug),
      name: String(r.name),
      description: String(r.description),
      isSystem: Boolean(r.is_system),
      membersCount: Number(r.members_count ?? 0),
      permissions: permsByRole[String(r.id)] ?? [],
    })),
  };
}

export async function createCustomRole(
  actor: AdminActorContext,
  input: {
    name: string;
    description: string;
  }
) {
  const id = crypto.randomUUID();
  const slugBase = input.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/(^_|_$)/g, '');
  const slug = `${slugBase}_${id.slice(0, 4)}`;

  await dbQuery(
    `INSERT INTO admin_roles (id, slug, name, description, is_system)
     VALUES ($1,$2,$3,$4,FALSE)`,
    [id, slug, input.name.trim(), input.description.trim()]
  );

  await logAdminAudit({
    actor,
    module: 'system_roles',
    action: 'create',
    entityType: 'admin_role',
    entityId: id,
    after: { slug, name: input.name },
  });

  return { id, slug };
}

export async function updateRolePermissionsMatrix(
  actor: AdminActorContext,
  roleId: string,
  grants: Array<{
    moduleKey: string;
    actions: AdminAction[];
    piiAccess: boolean;
    dataScope?: 'all' | 'assigned' | 'department';
  }>
) {
  if (!isValidUuid(roleId)) throw new AppError('VALIDATION_ERROR', 'Invalid role ID.');

  return dbTransaction(async (tx) => {
    const roleRes = await tx.query<{ slug: string }>(
      'SELECT slug FROM admin_roles WHERE id = $1',
      [roleId]
    );
    const role = roleRes.rows[0];
    if (!role) throw new AppError('NOT_FOUND', 'Role not found.');
    if (role.slug === 'super_admin') {
      throw new AppError('FORBIDDEN', 'Super Admin always retains full platform permissions.');
    }

    await tx.query('DELETE FROM admin_role_permissions WHERE role_id = $1', [roleId]);

    for (const g of grants) {
      if (!g.actions || g.actions.length === 0) continue;
      if (!(ADMIN_MODULE_KEYS as readonly string[]).includes(g.moduleKey)) continue;
      await tx.query(
        `INSERT INTO admin_role_permissions (role_id, module_key, actions, pii_access, data_scope)
         VALUES ($1,$2,$3::jsonb,$4,$5)`,
        [
          roleId,
          g.moduleKey,
          JSON.stringify(g.actions),
          Boolean(g.piiAccess),
          g.dataScope ?? 'all',
        ]
      );
    }

    await logAdminAudit(
      {
        actor,
        module: 'system_roles',
        action: 'edit',
        entityType: 'admin_role_permissions',
        entityId: roleId,
        after: { updatedModulesCount: grants.length },
      },
      tx
    );

    return { ok: true };
  });
}

export async function listAdminAuditLogs(filters?: { module?: string; action?: string; q?: string }) {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters?.module && filters.module !== 'all') {
    params.push(filters.module);
    conditions.push(`module = $${params.length}`);
  }
  if (filters?.action && filters.action !== 'all') {
    params.push(filters.action);
    conditions.push(`action = $${params.length}`);
  }
  if (filters?.q?.trim()) {
    params.push(`%${filters.q.trim()}%`);
    conditions.push(
      `(actor_email ILIKE $${params.length} OR entity_id ILIKE $${params.length} OR reason ILIKE $${params.length})`
    );
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const res = await dbQuery<{
    id: string;
    actor_email: string;
    module: string;
    action: string;
    entity_type: string;
    entity_id: string;
    before_json: unknown;
    after_json: unknown;
    reason: string;
    ip_address: string;
    created_at: string;
  }>(
    `SELECT * FROM admin_audit_logs
     ${where}
     ORDER BY created_at DESC
     LIMIT 250`,
    params
  );

  return res.rows.map((a) => ({
    id: String(a.id),
    actorEmail: String(a.actor_email),
    module: String(a.module),
    action: String(a.action),
    entityType: String(a.entity_type),
    entityId: String(a.entity_id),
    beforeJson: a.before_json ?? null,
    afterJson: a.after_json ?? null,
    reason: String(a.reason ?? ''),
    ipAddress: String(a.ip_address ?? ''),
    createdAt: new Date(String(a.created_at)).toISOString(),
  }));
}
