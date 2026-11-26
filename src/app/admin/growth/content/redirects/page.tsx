import { AdminAccessWall, requireAdminPageAccess } from '@/lib/admin-page-guard';
import { listCmsRedirects } from '@/modules/cms-vietnomad';
import { RedirectsClient } from '@/components/cms-admin/RedirectsClient';

export const dynamic = 'force-dynamic';

export default async function AdminCmsRedirectsPage() {
  const access = await requireAdminPageAccess('content', 'view');
  if (!access.allowed) return <AdminAccessWall reason={access.reason} email={access.email} />;

  const redirects = await listCmsRedirects();
  const canDelete = (access.actor.permissions.content?.actions ?? []).includes('delete');

  return <RedirectsClient initialRedirects={redirects} canDelete={canDelete} />;
}
