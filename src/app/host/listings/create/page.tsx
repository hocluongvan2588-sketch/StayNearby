import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { getDestinations } from '@/modules/catalog';
import { getHostConsoleData } from '@/modules/host';
import { HostListingWizardCreateClient } from '@/components/host/HostListingWizardCreateClient';

export const dynamic = 'force-dynamic';

/**
 * New listing wizard (Phase 3) — onboarding on real draft stays.
 * `?stay=<id>` resumes an existing draft stay (autosaved step + data).
 * The legacy wizard at /host/listings/new stays untouched until Phase 5.
 */
export default async function HostCreateListingPage({
  searchParams,
}: {
  searchParams: Promise<{ stay?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user || (user.role !== 'host' && user.role !== 'admin')) {
    redirect('/login?next=/host/listings/create');
  }
  const sp = await searchParams;
  const [destinations, data] = await Promise.all([
    getDestinations(),
    getHostConsoleData(user),
  ]);
  const stay = sp.stay ? (data.stays.find((s) => s.id === sp.stay) ?? null) : null;
  if (sp.stay && !stay) {
    redirect('/host/listings');
  }

  return (
    <HostListingWizardCreateClient
      destinations={destinations}
      initialStay={stay}
      hostName={user.fullName}
    />
  );
}
