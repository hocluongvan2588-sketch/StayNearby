import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { getHostEarningsData } from '@/modules/host-console';
import { HostEarningsClient } from '@/components/host/HostEarningsClient';

export const dynamic = 'force-dynamic';

export default async function HostEarningsPage() {
  const user = await getCurrentUser();
  if (!user || (user.role !== 'host' && user.role !== 'admin')) {
    redirect('/login?next=/host/earnings');
  }
  const data = await getHostEarningsData(user);
  return <HostEarningsClient initialData={data} />;
}
