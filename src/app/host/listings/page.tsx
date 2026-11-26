import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { getHostConsoleData } from '@/modules/host';
import { getHostDrafts } from '@/modules/host-console';
import { HostListingsClient } from '@/components/host/HostListingsClient';

export const dynamic = 'force-dynamic';

export default async function HostListingsPage() {
  const user = await getCurrentUser();
  if (!user || (user.role !== 'host' && user.role !== 'admin')) {
    redirect('/login?next=/host/listings');
  }
  const [consoleData, drafts] = await Promise.all([
    getHostConsoleData(user),
    getHostDrafts(user),
  ]);
  return (
    <HostListingsClient
      initialStays={consoleData.stays}
      initialDrafts={drafts.map((d) => ({
        id: d.id,
        currentStep: d.currentStep,
        titlePreview: String(
          d.payload.stayName ?? d.payload.titleEn ?? 'Untitled draft'
        ),
        city: String(d.payload.destinationSlug ?? 'da-nang'),
        updatedAt: d.updatedAt,
      }))}
    />
  );
}
