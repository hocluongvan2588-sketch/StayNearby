import { AdminAccessWall, requireAdminPageAccess } from '@/lib/admin-page-guard';
import { listInvoices, listReconciliationRecords } from '@/modules/admin-bos';
import { ReconciliationInvoicesView } from '@/components/admin/bos/FinanceClient';

export const dynamic = 'force-dynamic';

export default async function AdminFinanceReconPage() {
  const access = await requireAdminPageAccess('finance_reconciliation', 'view');
  if (!access.allowed) return <AdminAccessWall reason={access.reason} email={access.email} />;
  const [records, invoices] = await Promise.all([listReconciliationRecords(), listInvoices()]);
  return <ReconciliationInvoicesView initialRecords={records} initialInvoices={invoices} />;
}
