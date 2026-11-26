import { AdminAccessWall, requireAdminPageAccess } from '@/lib/admin-page-guard';
import { getFinanceOverview } from '@/modules/admin-bos';
import { FinanceTransactionsView } from '@/components/admin/bos/FinanceClient';

export const dynamic = 'force-dynamic';

export default async function AdminFinanceOverviewPage() {
  const access = await requireAdminPageAccess('finance_transactions', 'view');
  if (!access.allowed) return <AdminAccessWall reason={access.reason} email={access.email} />;
  const data = await getFinanceOverview();
  return <FinanceTransactionsView initialData={data} />;
}
