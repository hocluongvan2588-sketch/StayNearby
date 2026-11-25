import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { AppError } from '@/lib/errors';
import { errJson, okJson } from '@/lib/http';
import { updateAdminCrmUser } from '@/modules/admin';

const schema = z.object({
  crmStage: z.enum(['lead', 'active', 'vip', 'follow_up', 'paused']),
  crmNote: z.string().max(400),
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
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', 'Invalid CRM update payload.');
    const out = await updateAdminCrmUser(admin, id, parsed.data);
    return okJson(out);
  } catch (err) {
    return errJson(err);
  }
}
