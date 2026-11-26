import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { getHostCalendarData } from '@/modules/host-console';
import { HostCalendarClient } from '@/components/host/HostCalendarClient';

export const dynamic = 'force-dynamic';

export default async function HostCalendarPage() {
  const user = await getCurrentUser();
  if (!user || (user.role !== 'host' && user.role !== 'admin')) {
    redirect('/login?next=/host/calendar');
  }
  const data = await getHostCalendarData(user);
  return <HostCalendarClient initialData={data} />;
}
