import { AdminAccessWall, requireAdminPageAccess } from '@/lib/admin-page-guard';
import { listSupportTickets } from '@/modules/admin-bos';
import { SupportTicketsView } from '@/components/admin/bos/OperationsClient';

export const dynamic = 'force-dynamic';

export default async function AdminSupportPage() {
  const access = await requireAdminPageAccess('support', 'view');
  if (!access.allowed) return <AdminAccessWall reason={access.reason} email={access.email} />;
  const tickets = await listSupportTickets(access.actor);
  return <SupportTicketsView initialTickets={tickets} />;
}
