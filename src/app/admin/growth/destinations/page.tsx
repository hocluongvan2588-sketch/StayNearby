import { AdminAccessWall, requireAdminPageAccess } from '@/lib/admin-page-guard';
import { listAdminDestinations } from '@/modules/admin-bos';
import { DestinationsView } from '@/components/admin/bos/GrowthClient';

export const dynamic = 'force-dynamic';

export default async function AdminDestinationsPage() {
  const access = await requireAdminPageAccess('destinations', 'view');
  if (!access.allowed) return <AdminAccessWall reason={access.reason} email={access.email} />;
  const data = await listAdminDestinations();
  return <DestinationsView initialData={data} />;
}
