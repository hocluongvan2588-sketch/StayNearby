import { AdminAccessWall, requireAdminPageAccess } from '@/lib/admin-page-guard';
import { listAdminListings } from '@/modules/admin-bos';
import { ListingsModerationView } from '@/components/admin/bos/OperationsClient';

export const dynamic = 'force-dynamic';

export default async function AdminListingsPage() {
  const access = await requireAdminPageAccess('listings', 'view');
  if (!access.allowed) return <AdminAccessWall reason={access.reason} email={access.email} />;
  const data = await listAdminListings();
  return <ListingsModerationView initialData={data} />;
}
