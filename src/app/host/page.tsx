import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Calendar, Edit3, ExternalLink, Plus } from 'lucide-react';
import { hasRole } from '@/lib/auth/rbac';
import { getCurrentUser } from '@/lib/auth/session';
import { formatVnd } from '@/lib/format';
import { getHostDashboardListings } from '@/modules/host';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { FallbackImage } from '@/components/ui/FallbackImage';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { HostSubNav } from '@/components/host/HostSubNav';

export const dynamic = 'force-dynamic';

const HOST_STATUS_VI: Record<
  string,
  { label: string; tone: 'neutral' | 'success' | 'warning' | 'danger' }
> = {
  published: { label: 'Đã công bố', tone: 'success' },
  pending_review: { label: 'Chờ duyệt', tone: 'warning' },
  changes_requested: { label: 'Cần chỉnh sửa', tone: 'danger' },
  draft: { label: 'Bản nháp', tone: 'neutral' },
  suspended: { label: 'Đang tạm ẩn', tone: 'danger' },
};

export default async function HostPortalPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login?next=/host');
  }

  if (!hasRole(user, 'host')) {
    return (
      <div className="container-stay py-10 max-w-2xl space-y-4">
        <h1 className="page-title">Cổng thông tin Chủ nhà</h1>
        <ErrorAlert
          code="FORBIDDEN"
          message="Tài khoản hiện tại không có quyền Chủ nhà. Vui lòng đăng nhập bằng tài khoản Chủ nhà để quản lý chỗ ở."
          locale="vi"
        />
        <Link
          href="/stays"
          className="inline-flex items-center min-h-[44px] px-5 rounded-[12px] bg-[var(--color-primary)] text-white text-sm font-medium"
        >
          Quay lại trang tìm kiếm
        </Link>
      </div>
    );
  }

  const listings = await getHostDashboardListings(user);

  return (
    <div className="container-stay py-10 md:py-12 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-primary)]">
            Cổng Chủ nhà — Giao diện tiếng Việt
          </p>
          <h1 className="page-title">Chỗ ở thuộc quyền quản lý</h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            Xin chào {user.displayName}. Quản lý nội dung, ảnh, giá theo đêm, lịch khóa và yêu cầu đặt phòng cho các căn thuộc tài khoản của bạn.
          </p>
        </div>
        <Link
          href="/host/listings/new"
          className="inline-flex items-center gap-2 min-h-[44px] px-5 rounded-[12px] bg-[var(--color-primary)] text-white text-sm font-semibold hover:bg-[var(--color-primary-hover)]"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          <span>Đăng chỗ ở mới</span>
        </Link>
      </div>

      <HostSubNav />

      {listings.length === 0 ? (
        <div className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface-ivory)] p-10 text-center space-y-3">
          <h2 className="text-lg font-semibold text-[var(--color-text)]">
            Bạn chưa có chỗ ở nào
          </h2>
          <p className="text-sm text-[var(--color-text-muted)]">
            Bắt đầu tạo bản nháp chỗ ở đầu tiên, tải ảnh thật và gửi quản trị viên kiểm duyệt.
          </p>
          <div className="pt-2">
            <Link
              href="/host/listings/new"
              className="inline-flex items-center gap-2 min-h-[44px] px-5 rounded-[12px] bg-[var(--color-primary)] text-white text-sm font-medium"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>Tạo chỗ ở ngay</span>
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {listings.map((item) => {
            const badge = HOST_STATUS_VI[item.status] ?? {
              label: item.status,
              tone: 'neutral' as const,
            };
            return (
              <article
                key={item.id}
                className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-apple-subtle p-4 md:p-5 grid grid-cols-1 md:grid-cols-12 gap-5 items-center"
              >
                <div className="md:col-span-3">
                  <FallbackImage
                    src={item.coverPhotoUrl}
                    alt={item.titleEn}
                    fallbackLabel="Chưa có ảnh chỗ ở"
                  />
                </div>

                <div className="md:col-span-9 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge label={badge.label} tone={badge.tone} withIcon />
                      {item.hasPendingRevision && item.status === 'published' && (
                        <StatusBadge label="Có bản sửa chờ duyệt" tone="warning" />
                      )}
                      {item.isDemo && <StatusBadge label="Dữ liệu mẫu" tone="neutral" />}
                    </div>
                    <span className="text-xs text-[var(--color-text-muted)]">
                      {item.photoCount} ảnh
                    </span>
                  </div>

                  <h2 className="text-lg font-semibold text-[var(--color-text)]">
                    {item.titleEn}
                  </h2>

                  <p className="text-sm text-[var(--color-text-muted)]">
                    Khu vực: {item.areaNameVi}, {item.cityVi} — Tối đa {item.maxGuests} khách
                  </p>

                  <p className="text-sm text-[var(--color-text)]">
                    <span className="text-[var(--color-text-muted)]">Địa chỉ chi tiết (riêng tư): </span>
                    {item.exactAddress}
                  </p>

                  {item.reviewNote && (
                    <div className="rounded-[12px] border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] px-3.5 py-2.5 text-xs text-[var(--color-warning-text)]">
                      <strong>Ghi chú kiểm duyệt:</strong> {item.reviewNote}
                    </div>
                  )}

                  <div className="pt-3 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-hairline)]">
                    <p className="text-sm font-semibold tabular-nums text-[var(--color-text)]">
                      Giá mặc định: {formatVnd(item.baseNightlyRateVnd, 'vi')} / đêm
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/host/listings/${item.id}`}
                        className="inline-flex items-center gap-1.5 min-h-[44px] px-4 rounded-[12px] bg-[var(--color-primary)] text-white text-sm font-medium hover:bg-[var(--color-primary-hover)]"
                      >
                        <Edit3 className="w-4 h-4" aria-hidden="true" />
                        <span>Chỉnh sửa & Gửi duyệt</span>
                      </Link>
                      <Link
                        href={`/host/calendar?listing=${item.id}`}
                        className="inline-flex items-center gap-1.5 min-h-[44px] px-4 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] text-sm font-medium text-[var(--color-text)] hover:border-[var(--color-primary)]"
                      >
                        <Calendar className="w-4 h-4" aria-hidden="true" />
                        <span>Lịch & Giá</span>
                      </Link>
                      {item.status === 'published' && (
                        <Link
                          href={`/stays/${item.slug}`}
                          className="inline-flex items-center gap-1.5 min-h-[44px] px-4 rounded-[12px] border border-[var(--color-border)] text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                        >
                          <ExternalLink className="w-4 h-4" aria-hidden="true" />
                          <span>Trang công khai</span>
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
