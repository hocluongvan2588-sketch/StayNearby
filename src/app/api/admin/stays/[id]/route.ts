import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { AppError } from '@/lib/errors';
import { errJson, okJson } from '@/lib/http';
import { updateAdminStayStatus } from '@/modules/admin';

const schema = z.object({
  status: z.enum(['live', 'limited', 'paused']),
});

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireRole('admin');
    const { id } = await context.params;
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', 'Invalid status.');
    const out = await updateAdminStayStatus(admin, id, parsed.data.status);
    return okJson(out);
  } catch (err) {
    return errJson(err);
  }
}
