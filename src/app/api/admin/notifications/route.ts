import { errJson, okJson } from '@/lib/http';
import { requireAdminPermission } from '@/modules/admin-rbac';
import { getWorkspaceNotifications } from '@/modules/admin-bos';

export async function GET() {
  try {
    const actor = await requireAdminPermission('notifications', 'view');
    const data = await getWorkspaceNotifications(actor);
    return okJson(data);
  } catch (err) {
    return errJson(err);
  }
}
