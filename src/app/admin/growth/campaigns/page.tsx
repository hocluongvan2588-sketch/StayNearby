import { AdminAccessWall, requireAdminPageAccess } from '@/lib/admin-page-guard';
import { listCampaignsAndFunnel } from '@/modules/admin-bos';
import { CampaignsFunnelView } from '@/components/admin/bos/GrowthClient';

export const dynamic = 'force-dynamic';

export default async function AdminCampaignsPage() {
  const access = await requireAdminPageAccess('campaigns', 'view');
  if (!access.allowed) return <AdminAccessWall reason={access.reason} email={access.email} />;
  const data = await listCampaignsAndFunnel();
  return <CampaignsFunnelView initialData={data} />;
}
