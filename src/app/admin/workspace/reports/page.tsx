import { AdminAccessWall, requireAdminPageAccess } from '@/lib/admin-page-guard';
import { listManagementReports } from '@/modules/admin-bos';
import { ManagementReportsView } from '@/components/admin/bos/WorkspaceClient';

export const dynamic = 'force-dynamic';

export default async function AdminReportsPage() {
  const access = await requireAdminPageAccess('reports', 'view');
  if (!access.allowed) return <AdminAccessWall reason={access.reason} email={access.email} />;
  const reports = await listManagementReports();
  const canApprove =
    access.actor.permissions.reports?.actions.includes('approve') ?? false;
  return <ManagementReportsView initialReports={reports} canApprove={canApprove} />;
}
