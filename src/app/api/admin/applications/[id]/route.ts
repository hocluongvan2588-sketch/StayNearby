import { z } from 'zod';
import { AppError } from '@/lib/errors';
import { errJson, okJson } from '@/lib/http';
import { reviewHostApplication } from '@/modules/admin';
import { requireAdminPermission } from '@/modules/admin-rbac';

const schema = z.object({
  decision: z.enum(['approved', 'rejected']),
  reviewNote: z.string().max(240).optional(),
});

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireAdminPermission('listings', 'approve');
    const { id } = await context.params;
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', 'Invalid decision.');
    const out = await reviewHostApplication(
      actor.user,
      id,
      parsed.data.decision,
      parsed.data.reviewNote ?? ''
    );
    return okJson(out);
  } catch (err) {
    return errJson(err);
  }
}
