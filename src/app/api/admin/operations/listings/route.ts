import { NextRequest } from 'next/server';
import { z } from 'zod';
import { AppError } from '@/lib/errors';
import { errJson, okJson } from '@/lib/http';
import { requireAdminPermission } from '@/modules/admin-rbac';
import { listAdminListings, moderateListing } from '@/modules/admin-bos';

const patchSchema = z.object({
  stayId: z.string().uuid(),
  status: z
    .enum([
      'draft',
      'pending_review',
      'live',
      'limited',
      'paused',
      'rejected',
      'suspended',
      'archived',
    ])
    .optional(),
  isFeatured: z.boolean().optional(),
  featuredRank: z.number().int().min(1).max(999).optional(),
  moderationReason: z.string().max(400).optional(),
  isWifiVerified: z.boolean().optional(),
  isWorkReady: z.boolean().optional(),
  verificationTier: z
    .enum(['SELF_DECLARED', 'HOST_VERIFIED', 'VIETNOMAD_CERTIFIED'])
    .optional(),
});

export async function GET(req: NextRequest) {
  try {
    await requireAdminPermission('listings', 'view');
    const data = await listAdminListings({
      status: req.nextUrl.searchParams.get('status') ?? undefined,
      destination: req.nextUrl.searchParams.get('destination') ?? undefined,
      q: req.nextUrl.searchParams.get('q') ?? undefined,
    });
    return okJson(data);
  } catch (err) {
    return errJson(err);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', 'Invalid listing moderation payload.');

    const action = parsed.data.status ? 'approve' : 'edit';
    const actor = await requireAdminPermission('listings', action);
    const { stayId, ...rest } = parsed.data;
    const out = await moderateListing(actor, stayId, rest);
    return okJson(out);
  } catch (err) {
    return errJson(err);
  }
}
