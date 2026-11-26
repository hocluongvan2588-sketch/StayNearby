import { AdminAccessWall, requireAdminPageAccess } from '@/lib/admin-page-guard';
import { listHostLeads } from '@/modules/admin-bos';
import { HostAcquisitionView } from '@/components/admin/bos/CrmClient';

export const dynamic = 'force-dynamic';

export default async function AdminHostAcquisitionPage() {
  const access = await requireAdminPageAccess('host_acquisition', 'view');
  if (!access.allowed) return <AdminAccessWall reason={access.reason} email={access.email} />;
  const leads = await listHostLeads(access.actor);
  return <HostAcquisitionView initialLeads={leads} />;
}
