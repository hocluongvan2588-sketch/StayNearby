import { AdminAccessWall, requireAdminPageAccess } from '@/lib/admin-page-guard';
import { getCmsSettings } from '@/modules/cms-vietnomad';
import { getAiGatewayStatus, listAiUsageLogs } from '@/modules/ai-gateway';
import { CmsSettingsClient } from '@/components/cms-admin/CmsSettingsClient';

export const dynamic = 'force-dynamic';

export default async function AdminCmsSettingsPage() {
  const access = await requireAdminPageAccess('content', 'view');
  if (!access.allowed) return <AdminAccessWall reason={access.reason} email={access.email} />;

  const [settings, aiStatus, logs] = await Promise.all([
    getCmsSettings(),
    getAiGatewayStatus(),
    listAiUsageLogs(30),
  ]);

  return (
    <CmsSettingsClient
      initialSettings={settings}
      initialAiStatus={aiStatus}
      initialLogs={logs}
    />
  );
}
