import { redirect } from 'next/navigation';
import { getQuickDemoAccount } from '@/lib/auth/demo-quick-account';
import { hasRole } from '@/lib/auth/rbac';
import { getCurrentUser } from '@/lib/auth/session';
import { getAdminListingQueue } from '@/modules/admin';
import { PortalSwitchPrompt } from '@/components/auth/PortalSwitchPrompt';
import { AdminSubNav } from '@/components/admin/AdminSubNav';
import { AdminListingQueueClient } from '@/components/admin/AdminListingQueueClient';

export const dynamic = 'force-dynamic';

export default async function AdminPortalPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login?next=/admin');
  }

  if (!hasRole(user, 'admin')) {
    return (
      <PortalSwitchPrompt
        title="Quản trị nền tảng"
        message="Bạn không có quyền Quản trị để truy cập danh sách kiểm duyệt này."
        currentEmail={user.email}
        currentRoles={user.roles}
        targetPath="/admin"
        targetRoleLabel="Quản trị viên"
        quickDemoAccount={getQuickDemoAccount('admin')}
        fallbackHref="/"
        fallbackLabel="Về trang chủ"
        locale="vi"
      />
    );
  }

  const queue = await getAdminListingQueue(user);

  return (
    <div className="container-stay py-10 md:py-12 space-y-6">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-primary)]">
          Quản trị hệ thống — Giao diện tiếng Việt
        </p>
        <h1 className="page-title">Danh sách kiểm duyệt chỗ ở</h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          Quản trị viên: {user.displayName}. Duyệt công bố, trả lại kèm lý do hoặc tạm ẩn chỗ ở trên toàn hệ thống.
        </p>
      </div>

      <AdminSubNav />

      <AdminListingQueueClient initialQueue={queue} />
    </div>
  );
}
