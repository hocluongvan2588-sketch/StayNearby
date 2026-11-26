import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { getHostSettings } from '@/modules/host-console';
import { HostSettingsClient } from '@/components/host/HostSettingsClient';

export const dynamic = 'force-dynamic';

export default async function HostSettingsPage() {
  const user = await getCurrentUser();
  if (!user || (user.role !== 'host' && user.role !== 'admin')) {
    redirect('/login?next=/host/settings');
  }
  const { settings } = await getHostSettings(user);
  return <HostSettingsClient hostEmail={user.email} initialSettings={settings} />;
}
