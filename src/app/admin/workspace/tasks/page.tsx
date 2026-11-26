import { AdminAccessWall, requireAdminPageAccess } from '@/lib/admin-page-guard';
import { listAdminTasks } from '@/modules/admin-bos';
import { TasksCenterView } from '@/components/admin/bos/WorkspaceClient';

export const dynamic = 'force-dynamic';

export default async function AdminTasksPage() {
  const access = await requireAdminPageAccess('tasks', 'view');
  if (!access.allowed) return <AdminAccessWall reason={access.reason} email={access.email} />;
  const data = await listAdminTasks();
  return <TasksCenterView initialData={data} />;
}
