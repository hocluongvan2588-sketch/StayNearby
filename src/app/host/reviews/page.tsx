import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { getHostReviewsData } from '@/modules/host-console';
import { HostReviewsClient } from '@/components/host/HostReviewsClient';

export const dynamic = 'force-dynamic';

export default async function HostReviewsPage() {
  const user = await getCurrentUser();
  if (!user || (user.role !== 'host' && user.role !== 'admin')) {
    redirect('/login?next=/host/reviews');
  }
  const data = await getHostReviewsData(user);
  return <HostReviewsClient initialData={data} />;
}
