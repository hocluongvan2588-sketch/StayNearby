import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { getHostReservationsData } from '@/modules/host-console';
import { HostReservationsClient } from '@/components/host/HostReservationsClient';

export const dynamic = 'force-dynamic';

export default async function HostReservationsPage() {
  const user = await getCurrentUser();
  if (!user || (user.role !== 'host' && user.role !== 'admin')) {
    redirect('/login?next=/host/reservations');
  }
  const data = await getHostReservationsData(user, { status: 'all' });
  return <HostReservationsClient initialData={data} />;
}
