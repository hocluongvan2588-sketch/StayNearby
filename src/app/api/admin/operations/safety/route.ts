import { NextRequest } from 'next/server';
import { z } from 'zod';
import { AppError } from '@/lib/errors';
import { errJson, okJson } from '@/lib/http';
import { requireAdminPermission } from '@/modules/admin-rbac';
import {
  createSafetyReport,
  listSafetyReports,
  resolveSafetyReport,
} from '@/modules/admin-bos';

const createSchema = z.object({
  reportType: z.enum([
    'misleading_listing',
    'suspicious_account',
    'safety_incident',
    'dispute',
    'policy_violation',
  ]),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  summary: z.string().min(5).max(2000),
  stayId: z.string().nullable().optional(),
  bookingId: z.string().nullable().optional(),
});

const patchSchema = z.object({
  reportId: z.string().uuid(),
  status: z.enum(['investigating', 'action_taken', 'dismissed']),
  actionTaken: z.string().min(2).max(1000),
  suspendStay: z.boolean().optional(),
});

export async function GET(req: NextRequest) {
  try {
    await requireAdminPermission('safety', 'view');
    const reports = await listSafetyReports({
      status: req.nextUrl.searchParams.get('status') ?? undefined,
      severity: req.nextUrl.searchParams.get('severity') ?? undefined,
    });
    return okJson({ reports });
  } catch (err) {
    return errJson(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireAdminPermission('safety', 'create');
    const parsed = createSchema.safeParse(await req.json());
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', 'Invalid safety report payload.');
    const out = await createSafetyReport(actor, parsed.data);
    return okJson(out, 201);
  } catch (err) {
    return errJson(err);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const actor = await requireAdminPermission('safety', 'approve');
    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', 'Invalid safety report resolution.');
    const { reportId, ...rest } = parsed.data;
    const out = await resolveSafetyReport(actor, reportId, rest);
    return okJson(out);
  } catch (err) {
    return errJson(err);
  }
}
