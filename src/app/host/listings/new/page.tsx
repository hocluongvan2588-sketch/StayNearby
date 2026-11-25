import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getQuickDemoAccount } from '@/lib/auth/demo-quick-account';
import { hasRole } from '@/lib/auth/rbac';
import { getCurrentUser } from '@/lib/auth/session';
import { listHostFormOptions } from '@/modules/host';
import { PortalSwitchPrompt } from '@/components/auth/PortalSwitchPrompt';
import { HostSubNav } from '@/components/host/HostSubNav';
import { HostListingEditor } from '@/components/host/HostListingEditor';

export const dynamic = 'force-dynamic';

export default async function HostNewListingPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login?next=/host/listings/new');
  }

  if (!hasRole(user, 'host')) {
    return (
      <PortalSwitchPrompt
        title="Đăng chỗ ở mới"
        message="Tài khoản của bạn không có quyền Chủ nhà."
        currentEmail={user.email}
        currentRoles={user.roles}
        targetPath="/host/listings/new"
        targetRoleLabel="Chủ nhà"
        quickDemoAccount={getQuickDemoAccount('host')}
        fallbackHref="/stays"
        fallbackLabel="Quay lại trang tìm kiếm"
        locale="vi"
      />
    );
  }

  const options = await listHostFormOptions();

  return (
    <div className="container-stay py-10 md:py-12 max-w-4xl space-y-6">
      <div>
        <Link
          href="/host"
          className="inline-flex items-center gap-2 min-h-[44px] px-3 -ml-3 rounded-[12px] text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>Quay lại danh sách chỗ ở</span>
        </Link>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-primary)]">
          Cổng Chủ nhà
        </p>
        <h1 className="page-title">Tạo chỗ ở mới</h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          Điền thông tin lưu trú dành cho khách làm việc từ xa, lưu bản nháp, tải lên ít nhất 1 ảnh thật và gửi kiểm duyệt.
        </p>
      </div>

      <HostSubNav />

      <HostListingEditor
        mode="create"
        areas={options.areas}
        amenities={options.amenities}
      />
    </div>
  );
}
