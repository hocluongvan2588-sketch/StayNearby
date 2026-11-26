import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { getHostInsightsData } from '@/modules/host-console';
import { HostInsightsClient } from '@/components/host/HostInsightsClient';

export const dynamic = 'force-dynamic';

export default async function HostInsightsPage() {
  const user = await getCurrentUser();
  if (!user || (user.role !== 'host' && user.role !== 'admin')) {
    redirect('/login?next=/host/insights');
  }
  const data = await getHostInsightsData(user, { range: '30d' });
  return <HostInsightsClient initialData={data} />;
}
