import { AdminAccessWall, requireAdminPageAccess } from '@/lib/admin-page-guard';
import { listAdminCmsContents, listCmsCategories } from '@/modules/cms-vietnomad';
import { ContentHubClient } from '@/components/cms-admin/ContentHubClient';

export const dynamic = 'force-dynamic';

export default async function AdminContentSeoPage() {
  const access = await requireAdminPageAccess('content', 'view');
  if (!access.allowed) return <AdminAccessWall reason={access.reason} email={access.email} />;

  const [items, categories] = await Promise.all([
    listAdminCmsContents({}),
    listCmsCategories(),
  ]);

  const actions = access.actor.permissions.content?.actions ?? [];
  const canApprove = actions.includes('approve');
  const canDelete = actions.includes('delete');

  return (
    <ContentHubClient
      initialItems={items}
      categories={categories}
      canApprove={canApprove}
      canDelete={canDelete}
    />
  );
}
