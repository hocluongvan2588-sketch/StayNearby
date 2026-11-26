import { AdminAccessWall, requireAdminPageAccess } from '@/lib/admin-page-guard';
import { listHostPayouts } from '@/modules/admin-bos';
import { HostPayoutsView } from '@/components/admin/bos/FinanceClient';

export const dynamic = 'force-dynamic';

export default async function AdminFinancePayoutsPage() {
  const access = await requireAdminPageAccess('finance_payouts', 'view');
  if (!access.allowed) return <AdminAccessWall reason={access.reason} email={access.email} />;
  const payouts = await listHostPayouts();
  return <HostPayoutsView initialPayouts={payouts} />;
}
