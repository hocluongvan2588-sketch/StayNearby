import { z } from 'zod';
import { AppError } from '@/lib/errors';
import { errJson, okJson } from '@/lib/http';
import { updateAdminCrmUser } from '@/modules/admin';
import { requireAdminPermission } from '@/modules/admin-rbac';

const schema = z.object({
  crmStage: z.enum(['lead', 'active', 'vip', 'follow_up', 'paused']),
  crmNote: z.string().max(400),
});

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireAdminPermission('guest_crm', 'edit');
    const { id } = await context.params;
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', 'Invalid CRM update payload.');
    const out = await updateAdminCrmUser(actor.user, id, parsed.data);
    return okJson(out);
  } catch (err) {
    return errJson(err);
  }
}
