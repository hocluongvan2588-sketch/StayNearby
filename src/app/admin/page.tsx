import { requireAdminPageAccess, AdminAccessWall } from '@/lib/admin-page-guard';
import { getOverviewDashboardData } from '@/modules/admin-bos';
import { OverviewClient } from '@/components/admin/bos/OverviewClient';

export const dynamic = 'force-dynamic';

export default async function AdminOverviewPage() {
  const access = await requireAdminPageAccess('overview', 'view');
  if (!access.allowed) {
    return <AdminAccessWall reason={access.reason} email={access.email} />;
  }

  const data = await getOverviewDashboardData(access.actor, 90);
  return <OverviewClient initialData={data} />;
}
