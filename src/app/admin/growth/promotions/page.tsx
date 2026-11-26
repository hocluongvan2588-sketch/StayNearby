import { AdminAccessWall, requireAdminPageAccess } from '@/lib/admin-page-guard';
import { listPromotions } from '@/modules/admin-bos';
import { PromotionsView } from '@/components/admin/bos/GrowthClient';

export const dynamic = 'force-dynamic';

export default async function AdminPromotionsPage() {
  const access = await requireAdminPageAccess('promotions', 'view');
  if (!access.allowed) return <AdminAccessWall reason={access.reason} email={access.email} />;
  const promos = await listPromotions();
  return <PromotionsView initialPromos={promos} />;
}
