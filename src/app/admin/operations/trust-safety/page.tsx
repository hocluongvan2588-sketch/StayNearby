import { AdminAccessWall, requireAdminPageAccess } from '@/lib/admin-page-guard';
import { listSafetyReports } from '@/modules/admin-bos';
import { TrustSafetyView } from '@/components/admin/bos/OperationsClient';

export const dynamic = 'force-dynamic';

export default async function AdminTrustSafetyPage() {
  const access = await requireAdminPageAccess('safety', 'view');
  if (!access.allowed) return <AdminAccessWall reason={access.reason} email={access.email} />;
  const reports = await listSafetyReports();
  return <TrustSafetyView initialReports={reports} />;
}
