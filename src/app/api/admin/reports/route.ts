import { NextRequest } from 'next/server';
import { z } from 'zod';
import { AppError } from '@/lib/errors';
import { errJson, okJson } from '@/lib/http';
import { requireAdminPermission } from '@/modules/admin-rbac';
import {
  createManagementReport,
  listManagementReports,
  reviewManagementReport,
} from '@/modules/admin-bos';

const createSchema = z.object({
  department: z.string().min(2).max(120),
  periodLabel: z.string().min(2).max(120),
  resultsSummary: z.string().min(5).max(3000),
  targetComparison: z.string().max(2000).optional(),
  issuesRaised: z.string().max(2000).optional(),
  rootCauseAnalysis: z.string().max(2000).optional(),
  proposedActions: z.string().max(2000).optional(),
  nextPlan: z.string().max(2000).optional(),
  approvalRequest: z.string().max(1500).optional(),
  status: z.enum(['draft', 'submitted']).optional(),
});

const patchSchema = z.object({
  reportId: z.string().uuid(),
  decision: z.enum(['approved', 'changes_requested']),
  executiveComment: z.string().min(1).max(2000),
});

export async function GET() {
  try {
    await requireAdminPermission('reports', 'view');
    const reports = await listManagementReports();
    return okJson({ reports });
  } catch (err) {
    return errJson(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireAdminPermission('reports', 'create');
    const parsed = createSchema.safeParse(await req.json());
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', 'Invalid report submission.');
    const out = await createManagementReport(actor, parsed.data);
    return okJson(out, 201);
  } catch (err) {
    return errJson(err);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const actor = await requireAdminPermission('reports', 'approve');
    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', 'Invalid report review payload.');
    const out = await reviewManagementReport(actor, parsed.data.reportId, {
      decision: parsed.data.decision,
      executiveComment: parsed.data.executiveComment,
    });
    return okJson(out);
  } catch (err) {
    return errJson(err);
  }
}
