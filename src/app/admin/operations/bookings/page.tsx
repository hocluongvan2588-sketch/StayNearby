import { AdminAccessWall, requireAdminPageAccess } from '@/lib/admin-page-guard';
import { listAdminBookings } from '@/modules/admin-bos';
import { BookingsOperationsView } from '@/components/admin/bos/OperationsClient';

export const dynamic = 'force-dynamic';

export default async function AdminBookingsPage() {
  const access = await requireAdminPageAccess('bookings', 'view');
  if (!access.allowed) return <AdminAccessWall reason={access.reason} email={access.email} />;
  const bookings = await listAdminBookings(access.actor);
  return <BookingsOperationsView initialBookings={bookings} />;
}
