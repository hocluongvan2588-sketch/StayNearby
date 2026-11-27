import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { createDraftStay, getHostConsoleData } from '@/modules/host';

export const dynamic = 'force-dynamic';

/**
 * Create listing entry (post Phase 5) — starts a REAL draft stay immediately
 * (Listing ID assigned right away) and drops the host straight into the
 * section-based Listing Editor: the exact same interface used to edit
 * existing listings (no step-by-step wizard).
 *
 * `?stay=<id>` resumes an existing draft by opening its editor.
 * The legacy step wizard stays available at /host/listings/new.
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
  if (sp.stay) {
    const data = await getHostConsoleData(user);
    const stay = data.stays.find((s) => s.id === sp.stay);
    redirect(stay ? `/host/listings/${stay.id}` : '/host/listings');
  }

  let stayId: string;
  try {
    const stay = await createDraftStay(user);
    stayId = stay.id;
  } catch {
    redirect('/host/listings');
  }
  redirect(`/host/listings/${stayId}`);
}
