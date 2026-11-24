import Link from 'next/link';
import { redirect } from 'next/navigation';
import { hasRole } from '@/lib/auth/rbac';
import { getCurrentUser } from '@/lib/auth/session';
import { getAdminOpsSnapshot } from '@/modules/ops';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { AdminSubNav } from '@/components/admin/AdminSubNav';
import { AdminOpsClient } from '@/components/admin/AdminOpsClient';

export const dynamic = 'force-dynamic';

export default async function AdminOpsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login?next=/admin/ops');
  }

  if (!hasRole(user, 'admin')) {
    return (
      <div className="container-stay py-10 max-w-2xl space-y-4">
        <h1 className="page-title">Vận hành & Thông báo</h1>
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

  const snapshot = await getAdminOpsSnapshot(user);

  return (
    <div className="container-stay py-10 md:py-12 space-y-6">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-primary)]">
          Quản trị hệ thống — Giao diện tiếng Việt
        </p>
        <h1 className="page-title">Vận hành & hàng đợi thông báo</h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          Theo dõi tác vụ tự động hết hạn yêu cầu quá 24h, hoàn tất đơn sau ngày trả phòng và xử lý retry outbox.
        </p>
      </div>

      <AdminSubNav />

      <AdminOpsClient initialSnapshot={snapshot} />
    </div>
  );
}
