import { AdminAccessWall, requireAdminPageAccess } from '@/lib/admin-page-guard';
import { listRolesAndPermissions } from '@/modules/admin-bos';
import { RolesPermissionsView } from '@/components/admin/bos/SystemClient';

export const dynamic = 'force-dynamic';

export default async function AdminRolesPage() {
  const access = await requireAdminPageAccess('system_roles', 'view');
  if (!access.allowed) return <AdminAccessWall reason={access.reason} email={access.email} />;
  const data = await listRolesAndPermissions();
  return <RolesPermissionsView initialData={data} />;
}
