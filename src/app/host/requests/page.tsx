import { redirect } from 'next/navigation';
import { hasRole } from '@/lib/auth/rbac';
import { getCurrentUser } from '@/lib/auth/session';
import { getHostBookingRequests } from '@/modules/bookings';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { HostSubNav } from '@/components/host/HostSubNav';
import { HostRequestsManager } from '@/components/host/HostRequestsManager';

export const dynamic = 'force-dynamic';

export default async function HostRequestsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login?next=/host/requests');
  }

  if (!hasRole(user, 'host')) {
    return (
      <div className="container-stay py-10 max-w-2xl space-y-4">
        <h1 className="page-title">Yêu cầu đặt phòng</h1>
        <ErrorAlert
          code="FORBIDDEN"
          message="Tài khoản hiện tại không có quyền Chủ nhà."
          locale="vi"
        />
      </div>
    );
  }

  const bookings = await getHostBookingRequests(user);

  return (
    <div className="container-stay py-10 md:py-12 space-y-6">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-primary)]">
          Cổng Chủ nhà
        </p>
        <h1 className="page-title">Yêu cầu đặt phòng</h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          Xác nhận yêu cầu trong thời hạn phản hồi để khóa lịch trống vào PostgreSQL và mở hướng dẫn nhận phòng cho khách.
        </p>
      </div>

      <HostSubNav />

      <HostRequestsManager initialBookings={bookings} />
    </div>
  );
}
