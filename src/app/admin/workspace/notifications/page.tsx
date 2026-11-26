import { AdminAccessWall, requireAdminPageAccess } from '@/lib/admin-page-guard';
import { getWorkspaceNotifications } from '@/modules/admin-bos';
import { NotificationsCenterView } from '@/components/admin/bos/WorkspaceClient';

export const dynamic = 'force-dynamic';

export default async function AdminNotificationsPage() {
  const access = await requireAdminPageAccess('notifications', 'view');
  if (!access.allowed) return <AdminAccessWall reason={access.reason} email={access.email} />;
  const data = await getWorkspaceNotifications(access.actor);
  return <NotificationsCenterView initialData={data} />;
}
