import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { getDestinations } from '@/modules/catalog';
import { getHostDrafts } from '@/modules/host-console';
import { HostListingWizardClient } from '@/components/host/HostListingWizardClient';

export const dynamic = 'force-dynamic';

export default async function HostNewListingPage({
  searchParams,
}: {
  searchParams: Promise<{ draft?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user || (user.role !== 'host' && user.role !== 'admin')) {
    redirect('/login?next=/host/listings/new');
  }
  const sp = await searchParams;
  const [drafts, destinations] = await Promise.all([
    getHostDrafts(user),
    getDestinations(),
  ]);
  const existing = sp.draft ? drafts.find((d) => d.id === sp.draft) : undefined;

  return (
    <HostListingWizardClient
      hostName={user.fullName}
      destinations={destinations}
      initialDraftId={existing?.id ?? null}
      initialStep={existing?.currentStep ?? 1}
      initialPayload={existing?.payload ?? {}}
    />
  );
}
