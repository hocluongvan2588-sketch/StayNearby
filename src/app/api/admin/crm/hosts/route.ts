import { NextRequest } from 'next/server';
import { z } from 'zod';
import { AppError } from '@/lib/errors';
import { errJson, okJson } from '@/lib/http';
import { requireAdminPermission } from '@/modules/admin-rbac';
import {
  addCrmActivity,
  listHostsCrm,
  updateHostOrGuestCrmProfile,
} from '@/modules/admin-bos';

const patchSchema = z.object({
  userId: z.string().uuid(),
  crmStage: z.enum(['lead', 'active', 'vip', 'follow_up', 'paused']).optional(),
  crmNote: z.string().max(1000).optional(),
  kycVerified: z.boolean().optional(),
  riskFlag: z.enum(['none', 'watch', 'restricted']).optional(),
  reason: z.string().max(400).optional(),
});

const activitySchema = z.object({
  entityId: z.string().uuid(),
  activityType: z.enum(['note', 'call', 'email', 'zalo', 'meeting']),
  summary: z.string().min(2).max(200),
  body: z.string().max(2000).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const actor = await requireAdminPermission('host_crm', 'view');
    const hosts = await listHostsCrm(actor, {
      q: req.nextUrl.searchParams.get('q') ?? undefined,
      stage: req.nextUrl.searchParams.get('stage') ?? undefined,
      destination: req.nextUrl.searchParams.get('destination') ?? undefined,
    });
    return okJson({ hosts });
  } catch (err) {
    return errJson(err);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const actor = await requireAdminPermission('host_crm', 'edit');
    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', 'Invalid Host CRM update.');
    const { userId, ...rest } = parsed.data;
    const out = await updateHostOrGuestCrmProfile(actor, userId, 'host', rest);
    return okJson(out);
  } catch (err) {
    return errJson(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireAdminPermission('host_crm', 'edit');
    const parsed = activitySchema.safeParse(await req.json());
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', 'Invalid activity payload.');
    const out = await addCrmActivity(actor, {
      entityType: 'host',
      ...parsed.data,
    });
    return okJson(out, 201);
  } catch (err) {
    return errJson(err);
  }
}
