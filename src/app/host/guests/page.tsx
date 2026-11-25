import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Calendar, Lock, Mail, Phone, Users } from 'lucide-react';
import { getQuickDemoAccount } from '@/lib/auth/demo-quick-account';
import { hasRole } from '@/lib/auth/rbac';
import { getCurrentUser } from '@/lib/auth/session';
import { formatVnd } from '@/lib/format';
import { getHostGuestsCrm } from '@/modules/host';
import { PortalSwitchPrompt } from '@/components/auth/PortalSwitchPrompt';
import { HostSubNav } from '@/components/host/HostSubNav';
import { StatusBadge } from '@/components/ui/StatusBadge';

export const dynamic = 'force-dynamic';

const BOOKING_STATUS_VI: Record<
  string,
  { label: string; tone: 'neutral' | 'success' | 'warning' | 'danger' }
> = {
  pending: { label: 'Chờ phản hồi', tone: 'warning' },
  confirmed: { label: 'Đã xác nhận', tone: 'success' },
  declined: { label: 'Đã từ chối', tone: 'danger' },
  withdrawn: { label: 'Khách rút yêu cầu', tone: 'neutral' },
  expired: { label: 'Quá hạn', tone: 'neutral' },
  cancelled: { label: 'Đã hủy', tone: 'danger' },
  completed: { label: 'Đã hoàn tất', tone: 'neutral' },
};

export default async function HostGuestsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login?next=/host/guests');
  }

  if (!hasRole(user, 'host')) {
    return (
      <PortalSwitchPrompt
        title="Khách hàng của Chủ nhà"
        message="Tài khoản hiện tại không có quyền Chủ nhà để xem danh sách khách đặt phòng."
        currentEmail={user.email}
        currentRoles={user.roles}
        targetPath="/host/guests"
        targetRoleLabel="Chủ nhà"
        quickDemoAccount={getQuickDemoAccount('host')}
        fallbackHref="/stays"
        fallbackLabel="Quay lại trang tìm kiếm"
        locale="vi"
      />
    );
  }

  const guests = await getHostGuestsCrm(user);
  const totalRevenue = guests.reduce((s, g) => s + g.totalRevenueVnd, 0);
  const activePending = guests.reduce((s, g) => s + g.pendingCount, 0);

  return (
    <div className="container-stay py-10 md:py-12 space-y-6">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-primary)]">
          Cổng Chủ nhà — Giao diện tiếng Việt
        </p>
        <h1 className="page-title">Khách hàng đặt chỗ của bạn</h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          Danh sách khách hàng đã gửi yêu cầu hoặc lưu trú tại các căn thuộc quyền quản lý của {user.displayName}. Email và số điện thoại chỉ mở sau khi đơn được xác nhận.
        </p>
      </div>

      <HostSubNav />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-1 shadow-apple-subtle">
          <p className="text-xs text-[var(--color-text-muted)] flex items-center gap-1.5">
            <Users className="w-4 h-4 text-[var(--color-primary)]" aria-hidden="true" />
            <span>Tổng khách từng đặt</span>
          </p>
          <p className="text-2xl font-semibold text-[var(--color-text)] tabular-nums">
            {guests.length}
          </p>
        </div>

        <div className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-1 shadow-apple-subtle">
          <p className="text-xs text-[var(--color-text-muted)]">
            Yêu cầu đang chờ phản hồi
          </p>
          <p className="text-2xl font-semibold text-[var(--color-text)] tabular-nums">
            {activePending}
          </p>
        </div>

        <div className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-1 shadow-apple-subtle">
          <p className="text-xs text-[var(--color-text-muted)]">
            Doanh thu từ khách đã xác nhận
          </p>
          <p className="text-2xl font-semibold text-[var(--color-primary)] tabular-nums">
            {formatVnd(totalRevenue, 'vi')}
          </p>
        </div>
      </div>

      {guests.length === 0 ? (
        <div className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface-ivory)] p-10 text-center space-y-3">
          <h2 className="text-lg font-semibold text-[var(--color-text)]">
            Chưa có khách đặt phòng nào
          </h2>
          <p className="text-sm text-[var(--color-text-muted)]">
            Khi khách gửi yêu cầu hoặc hoàn tất lưu trú tại chỗ ở của bạn, hồ sơ khách sẽ hiển thị tại đây.
          </p>
          <Link
            href="/host/requests"
            className="inline-flex items-center min-h-[44px] px-5 rounded-[12px] bg-[var(--color-primary)] text-white text-sm font-medium"
          >
            Xem yêu cầu đặt phòng
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {guests.map((g) => {
            const statusMeta = BOOKING_STATUS_VI[g.latestBookingStatus] ?? {
              label: g.latestBookingStatus,
              tone: 'neutral' as const,
            };
            return (
              <article
                key={g.guestId}
                className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-apple-subtle p-5 space-y-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold text-[var(--color-text)]">
                        {g.displayName}
                      </h2>
                      <StatusBadge
                        label={statusMeta.label}
                        tone={statusMeta.tone}
                        withIcon
                      />
                    </div>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      Ngôn ngữ khách dùng:{' '}
                      <strong>
                        {g.preferredLocale === 'vi' ? 'Tiếng Việt' : 'Tiếng Anh'}
                      </strong>{' '}
                      · Chỗ ở gần nhất: <strong>{g.latestStayTitle}</strong>
                    </p>
                  </div>

                  <Link
                    href="/host/requests"
                    className="inline-flex items-center min-h-[40px] px-3.5 rounded-[12px] border border-[var(--color-border)] text-xs font-medium text-[var(--color-text)] hover:border-[var(--color-primary)]"
                  >
                    Xử lý yêu cầu ({g.latestBookingCode})
                  </Link>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div className="rounded-[12px] bg-[var(--color-surface-ivory)] p-3 space-y-1">
                    <p className="text-[var(--color-text-muted)]">Số lượt đặt / Xác nhận</p>
                    <p className="text-sm font-semibold text-[var(--color-text)] tabular-nums">
                      {g.bookingsCount} lượt · {g.confirmedOrCompletedCount} đã xác nhận
                    </p>
                  </div>

                  <div className="rounded-[12px] bg-[var(--color-surface-ivory)] p-3 space-y-1">
                    <p className="text-[var(--color-text-muted)]">Tổng giá trị xác nhận</p>
                    <p className="text-sm font-semibold text-[var(--color-primary)] tabular-nums">
                      {formatVnd(g.totalRevenueVnd, 'vi')}
                    </p>
                  </div>

                  <div className="rounded-[12px] bg-[var(--color-surface-ivory)] p-3 space-y-1">
                    <p className="text-[var(--color-text-muted)] flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Kỳ lưu trú gần nhất</span>
                    </p>
                    <p className="text-sm font-medium text-[var(--color-text)] tabular-nums">
                      {g.latestCheckIn} → {g.latestCheckOut}
                    </p>
                  </div>
                </div>

                {g.email ? (
                  <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--color-text)] pt-1">
                    <span className="inline-flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-[var(--color-primary)]" aria-hidden="true" />
                      <span>{g.email}</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-[var(--color-primary)]" aria-hidden="true" />
                      <span>{g.phone || 'Khách chưa cập nhật SĐT'}</span>
                    </span>
                  </div>
                ) : (
                  <p className="text-xs text-[var(--color-text-muted)] inline-flex items-center gap-1.5 pt-1">
                    <Lock className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>
                      Thông tin email & số điện thoại của khách sẽ hiển thị sau khi đơn được xác nhận.
                    </span>
                  </p>
                )}

                {g.latestGuestNote && (
                  <p className="text-xs text-[var(--color-text-muted)] border-t border-[var(--color-hairline)] pt-2">
                    <strong>Lời nhắn gần nhất:</strong> {g.latestGuestNote}
                  </p>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
