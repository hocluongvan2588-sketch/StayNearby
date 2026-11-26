import { AdminAccessWall, requireAdminPageAccess } from '@/lib/admin-page-guard';
import { listAdminPlaces } from '@/modules/admin-bos';
import { LocalDiscoveryView } from '@/components/admin/bos/GrowthClient';

export const dynamic = 'force-dynamic';

export default async function AdminDiscoveryPage() {
  const access = await requireAdminPageAccess('discovery', 'view');
  if (!access.allowed) return <AdminAccessWall reason={access.reason} email={access.email} />;
  const data = await listAdminPlaces();
  return <LocalDiscoveryView initialData={data} />;
}
