import { NextRequest } from 'next/server';
import { z } from 'zod';
import { AppError } from '@/lib/errors';
import { errJson, okJson } from '@/lib/http';
import { requireAdminPermission } from '@/modules/admin-rbac';
import {
  HOST_LEAD_STAGES,
  convertHostLeadToHost,
  createHostLead,
  listHostLeads,
  updateHostLead,
} from '@/modules/admin-bos';

const createSchema = z.object({
  source: z.string().max(60).optional(),
  businessName: z.string().min(2).max(160),
  contactName: z.string().min(2).max(120),
  email: z.string().email(),
  phone: z.string().max(40).optional(),
  whatsappZalo: z.string().max(60).optional(),
  destinationSlug: z.string().max(60).optional(),
  propertyType: z.string().max(60).optional(),
  estimatedUnits: z.number().int().min(1).max(500).optional(),
  notes: z.string().max(2000).optional(),
});

const patchSchema = z.object({
  action: z.enum(['update', 'convert']).default('update'),
  leadId: z.string().uuid(),
  stage: z.enum(HOST_LEAD_STAGES).optional(),
  lossReason: z.string().max(400).optional(),
  kycStatus: z.enum(['pending', 'submitted', 'verified', 'rejected']).optional(),
  notes: z.string().max(2000).optional(),
  nextFollowUpAt: z.string().nullable().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const actor = await requireAdminPermission('host_acquisition', 'view');
    const leads = await listHostLeads(actor, {
      q: req.nextUrl.searchParams.get('q') ?? undefined,
      stage: req.nextUrl.searchParams.get('stage') ?? undefined,
      destination: req.nextUrl.searchParams.get('destination') ?? undefined,
    });
    return okJson({ leads, stages: HOST_LEAD_STAGES });
  } catch (err) {
    return errJson(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireAdminPermission('host_acquisition', 'create');
    const parsed = createSchema.safeParse(await req.json());
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', 'Invalid host lead payload.');
    const out = await createHostLead(actor, parsed.data);
    return okJson(out, 201);
  } catch (err) {
    return errJson(err);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', 'Invalid host lead update.');

    if (parsed.data.action === 'convert') {
      const actor = await requireAdminPermission('host_acquisition', 'approve');
      const out = await convertHostLeadToHost(actor, parsed.data.leadId);
      return okJson(out);
    }

    const actor = await requireAdminPermission('host_acquisition', 'edit');
    const { leadId, ...rest } = parsed.data;
    delete (rest as { action?: string }).action;
    const out = await updateHostLead(actor, leadId, rest);
    return okJson(out);
  } catch (err) {
    return errJson(err);
  }
}
