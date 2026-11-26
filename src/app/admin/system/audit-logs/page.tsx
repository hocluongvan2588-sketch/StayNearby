import { AdminAccessWall, requireAdminPageAccess } from '@/lib/admin-page-guard';
import { listAdminAuditLogs } from '@/modules/admin-bos';
import { AuditLogsView } from '@/components/admin/bos/SystemClient';

export const dynamic = 'force-dynamic';

export default async function AdminAuditLogsPage() {
  const access = await requireAdminPageAccess('system_audit', 'view');
  if (!access.allowed) return <AdminAccessWall reason={access.reason} email={access.email} />;
  const logs = await listAdminAuditLogs();
  return <AuditLogsView initialLogs={logs} />;
}
