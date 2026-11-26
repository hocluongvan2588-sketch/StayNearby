import { AdminAccessWall, requireAdminPageAccess } from '@/lib/admin-page-guard';
import { listCmsCategories, listCmsTags } from '@/modules/cms-vietnomad';
import { TaxonomiesClient } from '@/components/cms-admin/TaxonomiesClient';

export const dynamic = 'force-dynamic';

export default async function AdminCmsTaxonomiesPage() {
  const access = await requireAdminPageAccess('content', 'view');
  if (!access.allowed) return <AdminAccessWall reason={access.reason} email={access.email} />;

  const [categories, tags] = await Promise.all([listCmsCategories(), listCmsTags()]);
  const canDelete = (access.actor.permissions.content?.actions ?? []).includes('delete');

  return (
    <TaxonomiesClient
      initialCategories={categories}
      initialTags={tags}
      canDelete={canDelete}
    />
  );
}
