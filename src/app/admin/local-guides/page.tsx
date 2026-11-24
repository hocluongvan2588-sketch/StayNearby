import Link from 'next/link';
import { redirect } from 'next/navigation';
import { hasRole } from '@/lib/auth/rbac';
import { getCurrentUser } from '@/lib/auth/session';
import { getAdminLocalGuidesData } from '@/modules/local-guides';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
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
      <div className="container-stay py-10 max-w-2xl space-y-4">
        <h1 className="page-title">Cẩm nang địa phương</h1>
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
