import { AdminAccessWall, requireAdminPageAccess } from '@/lib/admin-page-guard';
import { getFinanceOverview, listOperatingExpenses } from '@/modules/admin-bos';
import { FinancialReportsView } from '@/components/admin/bos/FinanceClient';

export const dynamic = 'force-dynamic';

export default async function AdminFinanceReportsPage() {
  const access = await requireAdminPageAccess('finance_reports', 'view');
  if (!access.allowed) return <AdminAccessWall reason={access.reason} email={access.email} />;
  const [overview, expenses] = await Promise.all([getFinanceOverview(), listOperatingExpenses()]);
  return <FinancialReportsView overview={overview} initialExpenses={expenses} />;
}
