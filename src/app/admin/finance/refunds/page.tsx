import { AdminAccessWall, requireAdminPageAccess } from '@/lib/admin-page-guard';
import { listRefundRequests } from '@/modules/admin-bos';
import { RefundsView } from '@/components/admin/bos/FinanceClient';

export const dynamic = 'force-dynamic';

export default async function AdminFinanceRefundsPage() {
  const access = await requireAdminPageAccess('finance_refunds', 'view');
  if (!access.allowed) return <AdminAccessWall reason={access.reason} email={access.email} />;
  const refunds = await listRefundRequests();
  return <RefundsView initialRefunds={refunds} />;
}
