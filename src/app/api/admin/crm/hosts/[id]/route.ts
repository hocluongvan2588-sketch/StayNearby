import { errJson, okJson } from '@/lib/http';
import { requireAdminPermission } from '@/modules/admin-rbac';
import { getHostDetail360 } from '@/modules/admin-bos';

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireAdminPermission('host_crm', 'view');
    const { id } = await context.params;
    const data = await getHostDetail360(actor, id);
    return okJson(data);
  } catch (err) {
    return errJson(err);
  }
}
