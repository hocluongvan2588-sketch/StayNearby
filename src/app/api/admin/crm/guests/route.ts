import { NextRequest } from 'next/server';
import { z } from 'zod';
import { AppError } from '@/lib/errors';
import { errJson, okJson } from '@/lib/http';
import { requireAdminPermission } from '@/modules/admin-rbac';
import {
  addCrmActivity,
  listGuestsCrm,
  updateHostOrGuestCrmProfile,
} from '@/modules/admin-bos';

const patchSchema = z.object({
  userId: z.string().uuid(),
  crmStage: z.enum(['lead', 'active', 'vip', 'follow_up', 'paused']).optional(),
  crmNote: z.string().max(1000).optional(),
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
    const actor = await requireAdminPermission('guest_crm', 'view');
    const guests = await listGuestsCrm(actor, {
      q: req.nextUrl.searchParams.get('q') ?? undefined,
      stage: req.nextUrl.searchParams.get('stage') ?? undefined,
      tier: req.nextUrl.searchParams.get('tier') ?? undefined,
      risk: req.nextUrl.searchParams.get('risk') ?? undefined,
    });
    return okJson({ guests });
  } catch (err) {
    return errJson(err);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const actor = await requireAdminPermission('guest_crm', 'edit');
    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', 'Invalid Guest CRM update.');
    const { userId, ...rest } = parsed.data;
    const out = await updateHostOrGuestCrmProfile(actor, userId, 'guest', rest);
    return okJson(out);
  } catch (err) {
    return errJson(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireAdminPermission('guest_crm', 'edit');
    const parsed = activitySchema.safeParse(await req.json());
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', 'Invalid activity payload.');
    const out = await addCrmActivity(actor, {
      entityType: 'guest',
      ...parsed.data,
    });
    return okJson(out, 201);
  } catch (err) {
    return errJson(err);
  }
}
