import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { getMemberDashboard } from '@/modules/bookings';
import { MemberDashboardClient } from '@/components/MemberDashboardClient';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login?next=/dashboard');
  }
  const data = await getMemberDashboard(user.id);
  return <MemberDashboardClient user={user} data={data} />;
}
