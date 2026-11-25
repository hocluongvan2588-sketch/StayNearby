import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getQuickDemoAccount } from '@/lib/auth/demo-quick-account';
import { hasRole } from '@/lib/auth/rbac';
import { getCurrentUser } from '@/lib/auth/session';
import { isAppError, type ErrorCode } from '@/lib/errors';
import { getHostListingDetail, listHostFormOptions } from '@/modules/host';
import { PortalSwitchPrompt } from '@/components/auth/PortalSwitchPrompt';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { HostSubNav } from '@/components/host/HostSubNav';
import { HostListingEditor } from '@/components/host/HostListingEditor';

export const dynamic = 'force-dynamic';

export default async function HostEditListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/host/listings/${id}`)}`);
  }

  if (!hasRole(user, 'host') && !hasRole(user, 'admin')) {
    return (
      <PortalSwitchPrompt
        title="Chỉnh sửa chỗ ở"
        message="Tài khoản hiện tại không có quyền Chủ nhà."
        currentEmail={user.email}
        currentRoles={user.roles}
        targetPath={`/host/listings/${id}`}
        targetRoleLabel="Chủ nhà"
        quickDemoAccount={getQuickDemoAccount('host')}
        fallbackHref="/stays"
        fallbackLabel="Quay lại trang tìm kiếm"
        locale="vi"
      />
    );
  }

  let listing = null;
  let loadError: { code: ErrorCode; message: string } | null = null;
  const options = await listHostFormOptions();

  try {
    listing = await getHostListingDetail(user, id);
  } catch (err) {
    if (isAppError(err)) {
      loadError = { code: err.code, message: err.message };
    } else {
      loadError = { code: 'INTERNAL_ERROR', message: 'Không thể tải thông tin chỗ ở.' };
    }
  }

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
        <h1 className="page-title">
          {listing ? listing.latestRevision.titleEn || 'Chỉnh sửa chỗ ở' : 'Chỉnh sửa chỗ ở'}
        </h1>
      </div>

      <HostSubNav />

      {loadError || !listing ? (
        <ErrorAlert
          code={loadError?.code ?? 'NOT_FOUND'}
          message={loadError?.message ?? 'Không tìm thấy chỗ ở.'}
          locale="vi"
        />
      ) : (
        <HostListingEditor
          mode="edit"
          areas={options.areas}
          amenities={options.amenities}
          initialListing={listing}
        />
      )}
    </div>
  );
}
