import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { getDestinations } from '@/modules/catalog';
import { getHostConsoleData } from '@/modules/host';
import { HostListingEditorClient } from '@/components/host/HostListingEditorClient';

export const dynamic = 'force-dynamic';

export default async function HostListingEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user || (user.role !== 'host' && user.role !== 'admin')) {
    redirect('/login?next=/host/listings');
  }
  const { id } = await params;
  const [data, destinations] = await Promise.all([
    getHostConsoleData(user),
    getDestinations(),
  ]);
  const stay = data.stays.find((s) => s.id === id);
  if (!stay) notFound();

  return <HostListingEditorClient initialStay={stay} destinations={destinations} />;
}
