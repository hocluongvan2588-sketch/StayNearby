import { AdminAccessWall, requireAdminPageAccess } from '@/lib/admin-page-guard';
import { listLocalPartners } from '@/modules/admin-bos';
import { LocalPartnersView } from '@/components/admin/bos/CrmClient';

export const dynamic = 'force-dynamic';

export default async function AdminLocalPartnersPage() {
  const access = await requireAdminPageAccess('local_partners', 'view');
  if (!access.allowed) return <AdminAccessWall reason={access.reason} email={access.email} />;
  const data = await listLocalPartners();
  return <LocalPartnersView initialData={data} />;
}
