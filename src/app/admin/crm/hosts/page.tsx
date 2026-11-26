import { AdminAccessWall, requireAdminPageAccess } from '@/lib/admin-page-guard';
import { listHostsCrm } from '@/modules/admin-bos';
import { HostCrmView } from '@/components/admin/bos/CrmClient';

export const dynamic = 'force-dynamic';

export default async function AdminHostsCrmPage() {
  const access = await requireAdminPageAccess('host_crm', 'view');
  if (!access.allowed) return <AdminAccessWall reason={access.reason} email={access.email} />;
  const hosts = await listHostsCrm(access.actor);
  return <HostCrmView initialHosts={hosts} hasPiiAccess={access.actor.hasPiiAccess} />;
}
