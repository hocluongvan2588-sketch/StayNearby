import { NextRequest } from 'next/server';
import { z } from 'zod';
import { AppError } from '@/lib/errors';
import { errJson, okJson } from '@/lib/http';
import { ALL_ADMIN_ACTIONS, requireAdminPermission } from '@/modules/admin-rbac';
import {
  createCustomRole,
  inviteOrAssignStaffMember,
  listAdminAuditLogs,
  listAdminTeamMembers,
  listRolesAndPermissions,
  updateRolePermissionsMatrix,
  updateStaffProfile,
} from '@/modules/admin-bos';
import {
  listAutomationRules,
  listPlatformSettingsSnapshot,
  toggleAutomationRule,
  updatePlatformSetting,
} from '@/modules/platform-settings';

export async function GET(req: NextRequest) {
  try {
    const scope = req.nextUrl.searchParams.get('scope') ?? 'team';

    if (scope === 'roles') {
      await requireAdminPermission('system_roles', 'view');
      return okJson(await listRolesAndPermissions());
    }
    if (scope === 'audit') {
      await requireAdminPermission('system_audit', 'view');
      return okJson({
        logs: await listAdminAuditLogs({
          module: req.nextUrl.searchParams.get('module') ?? undefined,
          action: req.nextUrl.searchParams.get('action') ?? undefined,
          q: req.nextUrl.searchParams.get('q') ?? undefined,
        }),
      });
    }
    if (scope === 'settings') {
      await requireAdminPermission('system_settings', 'view');
      const [settings, rules] = await Promise.all([
        listPlatformSettingsSnapshot(),
        listAutomationRules(),
      ]);
      return okJson({ ...settings, automationRules: rules });
    }

    await requireAdminPermission('system_team', 'view');
    return okJson(await listAdminTeamMembers());
  } catch (err) {
    return errJson(err);
  }
}

const postSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('staff'),
    email: z.string().email(),
    fullName: z.string().min(2).max(120),
    password: z.string().min(8).optional(),
    roleId: z.string().uuid(),
    department: z.string().min(2).max(80),
    title: z.string().min(2).max(120),
    assignedCities: z.array(z.string()).optional(),
  }),
  z.object({
    kind: z.literal('role'),
    name: z.string().min(2).max(80),
    description: z.string().max(300).optional(),
  }),
]);

export async function POST(req: NextRequest) {
  try {
    const parsed = postSchema.safeParse(await req.json());
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', 'Invalid system creation payload.');

    if (parsed.data.kind === 'staff') {
      const actor = await requireAdminPermission('system_team', 'create');
      return okJson(await inviteOrAssignStaffMember(actor, parsed.data), 201);
    }

    const actor = await requireAdminPermission('system_roles', 'create');
    return okJson(
      await createCustomRole(actor, {
        name: parsed.data.name,
        description: parsed.data.description ?? '',
      }),
      201
    );
  } catch (err) {
    return errJson(err);
  }
}

const patchSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('staff'),
    userId: z.string().uuid(),
    roleId: z.string().uuid().optional(),
    department: z.string().max(80).optional(),
    title: z.string().max(120).optional(),
    isActive: z.boolean().optional(),
  }),
  z.object({
    kind: z.literal('role_permissions'),
    roleId: z.string().uuid(),
    grants: z.array(
      z.object({
        moduleKey: z.string(),
        actions: z.array(z.enum(ALL_ADMIN_ACTIONS)),
        piiAccess: z.boolean(),
        dataScope: z.enum(['all', 'assigned', 'department']).optional(),
      })
    ),
  }),
  z.object({
    kind: z.literal('setting'),
    key: z.string().min(2).max(80),
    value: z.unknown(),
    reason: z.string().max(300).optional(),
  }),
  z.object({
    kind: z.literal('automation_rule'),
    ruleId: z.string().uuid(),
    isActive: z.boolean(),
  }),
]);

export async function PATCH(req: NextRequest) {
  try {
    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', 'Invalid system update payload.');
    const d = parsed.data;

    if (d.kind === 'staff') {
      const actor = await requireAdminPermission('system_team', 'edit');
      return okJson(await updateStaffProfile(actor, d.userId, d));
    }
    if (d.kind === 'role_permissions') {
      const actor = await requireAdminPermission('system_roles', 'edit');
      return okJson(await updateRolePermissionsMatrix(actor, d.roleId, d.grants));
    }
    if (d.kind === 'automation_rule') {
      const actor = await requireAdminPermission('system_settings', 'edit');
      await toggleAutomationRule(actor, d.ruleId, d.isActive);
      return okJson({ ok: true });
    }

    const actor = await requireAdminPermission('system_settings', 'edit');
    await updatePlatformSetting(actor, d.key, d.value, d.reason ?? '');
    return okJson({ ok: true });
  } catch (err) {
    return errJson(err);
  }
}
