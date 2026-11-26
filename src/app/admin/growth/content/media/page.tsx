import { AdminAccessWall, requireAdminPageAccess } from '@/lib/admin-page-guard';
import { listCmsMedia } from '@/modules/cms-vietnomad';
import { MediaManagerClient } from '@/components/cms-admin/MediaManagerClient';

export const dynamic = 'force-dynamic';

export default async function AdminCmsMediaPage() {
  const access = await requireAdminPageAccess('content', 'view');
  if (!access.allowed) return <AdminAccessWall reason={access.reason} email={access.email} />;

  const items = await listCmsMedia({});
  const canDelete = (access.actor.permissions.content?.actions ?? []).includes('delete');

  return <MediaManagerClient initialItems={items} canDelete={canDelete} />;
}
