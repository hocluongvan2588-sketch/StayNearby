import { NextRequest } from 'next/server';
import { z } from 'zod';
import { AppError } from '@/lib/errors';
import { errJson, okJson } from '@/lib/http';
import { requireAdminPermission } from '@/modules/admin-rbac';
import { deleteAdminReview, listAdminReviews } from '@/modules/admin-bos';

const delSchema = z.object({
  reviewId: z.string().uuid(),
  reason: z.string().min(3).max(400),
});

export async function GET(req: NextRequest) {
  try {
    await requireAdminPermission('reviews', 'view');
    const ratingMaxParam = req.nextUrl.searchParams.get('ratingMax');
    const reviews = await listAdminReviews({
      q: req.nextUrl.searchParams.get('q') ?? undefined,
      ratingMax: ratingMaxParam ? Number(ratingMaxParam) : undefined,
    });
    return okJson({ reviews });
  } catch (err) {
    return errJson(err);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const actor = await requireAdminPermission('reviews', 'delete');
    const parsed = delSchema.safeParse(await req.json());
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', 'Review ID and reason required.');
    const out = await deleteAdminReview(actor, parsed.data.reviewId, parsed.data.reason);
    return okJson(out);
  } catch (err) {
    return errJson(err);
  }
}
