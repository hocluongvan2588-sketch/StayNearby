import Link from 'next/link';
import { redirect } from 'next/navigation';
import { hasRole } from '@/lib/auth/rbac';
import { getCurrentUser } from '@/lib/auth/session';
import { getAdminListingQueue } from '@/modules/admin';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
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
      <div className="container-stay py-10 max-w-2xl space-y-4">
        <h1 className="page-title">Quản trị nền tảng</h1>
        <ErrorAlert
          code="FORBIDDEN"
          message="Bạn không có quyền Quản trị để truy cập danh sách kiểm duyệt này."
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
