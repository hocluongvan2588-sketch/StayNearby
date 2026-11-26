import { AdminAccessWall, requireAdminPageAccess } from '@/lib/admin-page-guard';
import { listCmsContents } from '@/modules/admin-bos';
import { ContentSeoView } from '@/components/admin/bos/GrowthClient';

export const dynamic = 'force-dynamic';

export default async function AdminContentSeoPage() {
  const access = await requireAdminPageAccess('content', 'view');
  if (!access.allowed) return <AdminAccessWall reason={access.reason} email={access.email} />;
  const contents = await listCmsContents();
  return <ContentSeoView initialContents={contents} />;
}
