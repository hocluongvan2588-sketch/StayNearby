import { redirect } from 'next/navigation';
import { getQuickDemoAccount } from '@/lib/auth/demo-quick-account';
import { hasRole } from '@/lib/auth/rbac';
import { getCurrentUser } from '@/lib/auth/session';
import { getAdminCrmDashboard } from '@/modules/crm';
import { AdminSubNav } from '@/components/admin/AdminSubNav';
import { AdminCrmClient } from '@/components/admin/AdminCrmClient';
import { PortalSwitchPrompt } from '@/components/auth/PortalSwitchPrompt';

export const dynamic = 'force-dynamic';

export default async function AdminCrmPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login?next=/admin/crm');
  }

  if (!hasRole(user, 'admin')) {
    return (
      <PortalSwitchPrompt
        title="CRM Quản trị & Khách hàng"
        message="Bạn cần đăng nhập bằng tài khoản Quản trị viên để xem và cập nhật dữ liệu CRM toàn hệ thống."
        currentEmail={user.email}
        currentRoles={user.roles}
        targetPath="/admin/crm"
        targetRoleLabel="Quản trị viên"
        quickDemoAccount={getQuickDemoAccount('admin')}
        fallbackHref="/"
        fallbackLabel="Về trang chủ"
        locale="vi"
      />
    );
  }

  const dashboard = await getAdminCrmDashboard(user);

  return (
    <div className="container-stay py-10 md:py-12 space-y-6">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-primary)]">
          Quản trị hệ thống — Giao diện tiếng Việt
        </p>
        <h1 className="page-title">CRM Quản trị & Chăm sóc khách hàng</h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          Theo dõi hồ sơ Khách hàng, Chủ nhà, lịch sử đặt phòng, tổng chi tiêu và ghi chú chăm sóc tập trung.
        </p>
      </div>

      <AdminSubNav />

      <AdminCrmClient initialDashboard={dashboard} />
    </div>
  );
}
