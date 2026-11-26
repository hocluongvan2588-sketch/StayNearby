import { AdminAccessWall, requireAdminPageAccess } from '@/lib/admin-page-guard';
import { loadCmsEditorOptions } from '@/lib/cms-admin-helpers';
import { CmsEditorWorkbench } from '@/components/cms-editor/CmsEditorWorkbench';

export const dynamic = 'force-dynamic';

export default async function AdminNewCmsArticlePage() {
  const access = await requireAdminPageAccess('content', 'create');
  if (!access.allowed) return <AdminAccessWall reason={access.reason} email={access.email} />;

  const opts = await loadCmsEditorOptions();
  const canApprove = (access.actor.permissions.content?.actions ?? []).includes('approve');

  return (
    <CmsEditorWorkbench
      initialDetail={null}
      categories={opts.categories}
      tags={opts.tags}
      destinations={opts.destinations}
      neighborhoods={opts.neighborhoods}
      canApprove={canApprove}
    />
  );
}
