import Link from 'next/link';
import { redirect } from 'next/navigation';
import { hasRole } from '@/lib/auth/rbac';
import { getCurrentUser } from '@/lib/auth/session';
import { getAllAdminBookings } from '@/modules/bookings';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { AdminSubNav } from '@/components/admin/AdminSubNav';
import { AdminBookingsClient } from '@/components/admin/AdminBookingsClient';

export const dynamic = 'force-dynamic';

export default async function AdminBookingsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login?next=/admin/bookings');
  }

  if (!hasRole(user, 'admin')) {
    return (
      <div className="container-stay py-10 max-w-2xl space-y-4">
        <h1 className="page-title">Quản lý đơn đặt phòng</h1>
        <ErrorAlert
          code="FORBIDDEN"
          message="Bạn không có quyền Quản trị."
          locale="vi"
        />
        <Link
          href="/"
          className="inline-flex items-center min-h-[44px] px-5 rounded-[12px] bg-[var(--color-primary)] text-white text-sm font-medium"
        >
          Về trang chủ
        </Link>
      </div>
    );
  }

  const bookings = await getAllAdminBookings(user);

  return (
    <div className="container-stay py-10 md:py-12 space-y-6">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-primary)]">
          Quản trị hệ thống — Giao diện tiếng Việt
        </p>
        <h1 className="page-title">Tra cứu đơn & hỗ trợ xử lý</h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          Xem toàn bộ đơn đặt phòng, lịch sử chuyển trạng thái và hỗ trợ hủy đơn có ghi nhận lý do.
        </p>
      </div>

      <AdminSubNav />

      <AdminBookingsClient initialBookings={bookings} />
    </div>
  );
}
