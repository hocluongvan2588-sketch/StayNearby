import { AdminAccessWall, requireAdminPageAccess } from '@/lib/admin-page-guard';
import { listGuestsCrm } from '@/modules/admin-bos';
import { GuestCrmView } from '@/components/admin/bos/CrmClient';

export const dynamic = 'force-dynamic';

export default async function AdminGuestsCrmPage() {
  const access = await requireAdminPageAccess('guest_crm', 'view');
  if (!access.allowed) return <AdminAccessWall reason={access.reason} email={access.email} />;
  const guests = await listGuestsCrm(access.actor);
  return <GuestCrmView initialGuests={guests} hasPiiAccess={access.actor.hasPiiAccess} />;
}
