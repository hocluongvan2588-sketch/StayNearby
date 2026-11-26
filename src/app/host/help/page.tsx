import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { HostHelpClient } from '@/components/host/HostHelpClient';

export const dynamic = 'force-dynamic';

export default async function HostHelpPage() {
  const user = await getCurrentUser();
  if (!user || (user.role !== 'host' && user.role !== 'admin')) {
    redirect('/login?next=/host/help');
  }
  return <HostHelpClient />;
}
