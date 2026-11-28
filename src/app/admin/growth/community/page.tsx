import { AdminAccessWall, requireAdminPageAccess } from '@/lib/admin-page-guard';
import { listAdminCommunityEvents } from '@/modules/admin-bos/community';
import { getEventTaxonomy } from '@/modules/platform-settings';
import { getDestinations } from '@/modules/catalog';
import { CommunityAdminClient } from '@/components/admin/bos/CommunityAdminClient';

export const dynamic = 'force-dynamic';

export default async function AdminCommunityPage() {
  const access = await requireAdminPageAccess('content', 'view');
  if (!access.allowed) {
    return <AdminAccessWall reason={access.reason} email={access.email} />;
  }

  const [initialEvents, taxonomy, destinations] = await Promise.all([
    listAdminCommunityEvents({ tab: 'pending' }),
    getEventTaxonomy(),
    getDestinations(),
  ]);

  const actions = access.actor.permissions.content?.actions ?? [];

  return (
    <CommunityAdminClient
      initialEvents={initialEvents}
      taxonomy={taxonomy}
      destinations={destinations.map((d) => ({
        id: d.id,
        nameEn: d.nameEn,
        nameVi: d.nameVi,
      }))}
      canEdit={actions.includes('edit')}
      canApprove={actions.includes('approve')}
      canCreate={actions.includes('create')}
    />
  );
}
