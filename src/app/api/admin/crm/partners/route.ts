import { NextRequest } from 'next/server';
import { z } from 'zod';
import { AppError } from '@/lib/errors';
import { errJson, okJson } from '@/lib/http';
import { requireAdminPermission } from '@/modules/admin-rbac';
import {
  createLocalPartner,
  listLocalPartners,
  updateLocalPartner,
} from '@/modules/admin-bos';

const createSchema = z.object({
  businessName: z.string().min(2).max(160),
  category: z.enum([
    'restaurant',
    'cafe',
    'coworking',
    'gym_yoga',
    'transport',
    'experience',
    'essential',
  ]),
  destinationId: z.string().nullable().optional(),
  contactName: z.string().max(120).optional(),
  contactEmail: z.string().max(160).optional(),
  contactPhone: z.string().max(40).optional(),
  partnershipStatus: z
    .enum(['prospect', 'in_discussion', 'active', 'paused', 'ended'])
    .optional(),
  contractRef: z.string().max(80).optional(),
  perkOffer: z.string().max(400).optional(),
  commissionTerms: z.string().max(400).optional(),
  notes: z.string().max(1500).optional(),
});

const patchSchema = z.object({
  partnerId: z.string().uuid(),
  partnershipStatus: z
    .enum(['prospect', 'in_discussion', 'active', 'paused', 'ended'])
    .optional(),
  perkOffer: z.string().max(400).optional(),
  commissionTerms: z.string().max(400).optional(),
  contractRef: z.string().max(80).optional(),
  notes: z.string().max(1500).optional(),
});

export async function GET(req: NextRequest) {
  try {
    await requireAdminPermission('local_partners', 'view');
    const data = await listLocalPartners({
      status: req.nextUrl.searchParams.get('status') ?? undefined,
      category: req.nextUrl.searchParams.get('category') ?? undefined,
      q: req.nextUrl.searchParams.get('q') ?? undefined,
    });
    return okJson(data);
  } catch (err) {
    return errJson(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireAdminPermission('local_partners', 'create');
    const parsed = createSchema.safeParse(await req.json());
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', 'Invalid partner payload.');
    const out = await createLocalPartner(actor, parsed.data);
    return okJson(out, 201);
  } catch (err) {
    return errJson(err);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const actor = await requireAdminPermission('local_partners', 'edit');
    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', 'Invalid partner update.');
    const { partnerId, ...rest } = parsed.data;
    const out = await updateLocalPartner(actor, partnerId, rest);
    return okJson(out);
  } catch (err) {
    return errJson(err);
  }
}
