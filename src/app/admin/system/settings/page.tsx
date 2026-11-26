import { AdminAccessWall, requireAdminPageAccess } from '@/lib/admin-page-guard';
import {
  listAutomationRules,
  listPlatformSettingsSnapshot,
} from '@/modules/platform-settings';
import { SystemSettingsView } from '@/components/admin/bos/SystemClient';

export const dynamic = 'force-dynamic';

export default async function AdminSystemSettingsPage() {
  const access = await requireAdminPageAccess('system_settings', 'view');
  if (!access.allowed) return <AdminAccessWall reason={access.reason} email={access.email} />;
  const [snapshot, rules] = await Promise.all([
    listPlatformSettingsSnapshot(),
    listAutomationRules(),
  ]);
  return <SystemSettingsView initialSnapshot={snapshot} initialRules={rules} />;
}
