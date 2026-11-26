import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { getHostOverviewData } from '@/modules/host-console';
import { HostOverviewClient } from '@/components/host/HostOverviewClient';

export const dynamic = 'force-dynamic';

export default async function HostOverviewPage() {
  const user = await getCurrentUser();
  if (!user || (user.role !== 'host' && user.role !== 'admin')) {
    redirect('/login?next=/host');
  }
  const data = await getHostOverviewData(user, { range: '30d' });
  return <HostOverviewClient hostName={user.fullName} initialData={data} />;
}
