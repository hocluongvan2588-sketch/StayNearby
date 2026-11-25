import { redirect } from 'next/navigation';
import { getQuickDemoAccount } from '@/lib/auth/demo-quick-account';
import { hasRole } from '@/lib/auth/rbac';
import { getCurrentUser } from '@/lib/auth/session';
import { getAdminLocalGuidesData } from '@/modules/local-guides';
import { PortalSwitchPrompt } from '@/components/auth/PortalSwitchPrompt';
import { AdminSubNav } from '@/components/admin/AdminSubNav';
import { AdminLocalGuidesClient } from '@/components/admin/AdminLocalGuidesClient';

export const dynamic = 'force-dynamic';

export default async function AdminLocalGuidesPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login?next=/admin/local-guides');
  }

  if (!hasRole(user, 'admin')) {
    return (
      <PortalSwitchPrompt
        title="Cẩm nang địa phương"
        message="Bạn không có quyền Quản trị."
        currentEmail={user.email}
        currentRoles={user.roles}
        targetPath="/admin/local-guides"
        targetRoleLabel="Quản trị viên"
        quickDemoAccount={getQuickDemoAccount('admin')}
        fallbackHref="/"
        fallbackLabel="Về trang chủ"
        locale="vi"
      />
    );
  }

  const initialData = await getAdminLocalGuidesData(user);

  return (
    <div className="container-stay py-10 md:py-12 space-y-6">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-primary)]">
          Quản trị hệ thống — Giao diện tiếng Việt
        </p>
        <h1 className="page-title">Quản trị cẩm nang địa phương & mã QR</h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          Quản lý địa điểm kiểm chứng, tuyến gợi ý theo khu vực, thông tin coworking và tạo mã QR công khai đặt tại chỗ ở.
        </p>
      </div>

      <AdminSubNav />

      <AdminLocalGuidesClient initialData={initialData} />
    </div>
  );
}
