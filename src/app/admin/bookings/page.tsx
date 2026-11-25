import { redirect } from 'next/navigation';
import { getQuickDemoAccount } from '@/lib/auth/demo-quick-account';
import { hasRole } from '@/lib/auth/rbac';
import { getCurrentUser } from '@/lib/auth/session';
import { getAllAdminBookings } from '@/modules/bookings';
import { PortalSwitchPrompt } from '@/components/auth/PortalSwitchPrompt';
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
      <PortalSwitchPrompt
        title="Quản lý đơn đặt phòng"
        message="Bạn không có quyền Quản trị."
        currentEmail={user.email}
        currentRoles={user.roles}
        targetPath="/admin/bookings"
        targetRoleLabel="Quản trị viên"
        quickDemoAccount={getQuickDemoAccount('admin')}
        fallbackHref="/"
        fallbackLabel="Về trang chủ"
        locale="vi"
      />
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
