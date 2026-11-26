import { notFound } from 'next/navigation';
import { AdminAccessWall, requireAdminPageAccess } from '@/lib/admin-page-guard';
import { getAdminCmsContentDetail } from '@/modules/cms-vietnomad';
import { loadCmsEditorOptions } from '@/lib/cms-admin-helpers';
import { CmsEditorWorkbench } from '@/components/cms-editor/CmsEditorWorkbench';

export const dynamic = 'force-dynamic';

export default async function AdminEditCmsArticlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const access = await requireAdminPageAccess('content', 'edit');
  if (!access.allowed) return <AdminAccessWall reason={access.reason} email={access.email} />;

  const { id } = await params;
  const [detail, opts] = await Promise.all([
    getAdminCmsContentDetail(id).catch(() => null),
    loadCmsEditorOptions(),
  ]);

  if (!detail) notFound();

  const canApprove = (access.actor.permissions.content?.actions ?? []).includes('approve');

  return (
    <CmsEditorWorkbench
      initialDetail={detail}
      categories={opts.categories}
      tags={opts.tags}
      destinations={opts.destinations}
      neighborhoods={opts.neighborhoods}
      canApprove={canApprove}
    />
  );
}
