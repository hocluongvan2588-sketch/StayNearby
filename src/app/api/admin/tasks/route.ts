import { NextRequest } from 'next/server';
import { z } from 'zod';
import { AppError } from '@/lib/errors';
import { errJson, okJson } from '@/lib/http';
import { requireAdminPermission } from '@/modules/admin-rbac';
import { createAdminTask, listAdminTasks, updateAdminTask } from '@/modules/admin-bos';

const createSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().max(1000).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  assignedStaffId: z.string().nullable().optional(),
  dueAt: z.string().nullable().optional(),
  entityType: z
    .enum([
      'general',
      'host_lead',
      'host',
      'guest',
      'stay',
      'booking',
      'ticket',
      'payout',
      'refund',
    ])
    .optional(),
  entityId: z.string().max(120).optional(),
});

const patchSchema = z.object({
  taskId: z.string().uuid(),
  status: z.enum(['todo', 'in_progress', 'blocked', 'done']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  assignedStaffId: z.string().nullable().optional(),
  title: z.string().min(3).max(200).optional(),
  description: z.string().max(1000).optional(),
  dueAt: z.string().nullable().optional(),
});

export async function GET(req: NextRequest) {
  try {
    await requireAdminPermission('tasks', 'view');
    const data = await listAdminTasks({
      status: req.nextUrl.searchParams.get('status') ?? undefined,
      priority: req.nextUrl.searchParams.get('priority') ?? undefined,
      q: req.nextUrl.searchParams.get('q') ?? undefined,
    });
    return okJson(data);
  } catch (err) {
    return errJson(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireAdminPermission('tasks', 'create');
    const parsed = createSchema.safeParse(await req.json());
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', 'Invalid task payload.');
    const out = await createAdminTask(actor, parsed.data);
    return okJson(out, 201);
  } catch (err) {
    return errJson(err);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const actor = await requireAdminPermission('tasks', 'edit');
    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', 'Invalid task update payload.');
    const { taskId, ...rest } = parsed.data;
    const out = await updateAdminTask(actor, taskId, rest);
    return okJson(out);
  } catch (err) {
    return errJson(err);
  }
}
