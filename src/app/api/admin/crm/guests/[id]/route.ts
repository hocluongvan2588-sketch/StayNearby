import { errJson, okJson } from '@/lib/http';
import { requireAdminPermission } from '@/modules/admin-rbac';
import { getGuestDetail360 } from '@/modules/admin-bos';

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireAdminPermission('guest_crm', 'view');
    const { id } = await context.params;
    const data = await getGuestDetail360(actor, id);
    return okJson(data);
  } catch (err) {
    return errJson(err);
  }
}
