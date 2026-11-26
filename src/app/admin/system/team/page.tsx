import { AdminAccessWall, requireAdminPageAccess } from '@/lib/admin-page-guard';
import { listAdminTeamMembers } from '@/modules/admin-bos';
import { TeamManagementView } from '@/components/admin/bos/SystemClient';

export const dynamic = 'force-dynamic';

export default async function AdminTeamPage() {
  const access = await requireAdminPageAccess('system_team', 'view');
  if (!access.allowed) return <AdminAccessWall reason={access.reason} email={access.email} />;
  const data = await listAdminTeamMembers();
  return <TeamManagementView initialData={data} />;
}
