import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getQuickDemoAccount } from '@/lib/auth/demo-quick-account';
import { hasRole } from '@/lib/auth/rbac';
import { getCurrentUser } from '@/lib/auth/session';
import { getHostCalendarData, getHostDashboardListings } from '@/modules/host';
import { PortalSwitchPrompt } from '@/components/auth/PortalSwitchPrompt';
import { HostSubNav } from '@/components/host/HostSubNav';
import { HostCalendarManager } from '@/components/host/HostCalendarManager';

export const dynamic = 'force-dynamic';

export default async function HostCalendarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login?next=/host/calendar');
  }

  if (!hasRole(user, 'host')) {
    return (
      <PortalSwitchPrompt
        title="Lịch & Giá theo ngày"
        message="Tài khoản hiện tại không có quyền Chủ nhà."
        currentEmail={user.email}
        currentRoles={user.roles}
        targetPath="/host/calendar"
        targetRoleLabel="Chủ nhà"
        quickDemoAccount={getQuickDemoAccount('host')}
        fallbackHref="/stays"
        fallbackLabel="Quay lại trang tìm kiếm"
        locale="vi"
      />
    );
  }

  const sp = await searchParams;
  const listings = await getHostDashboardListings(user);
  const requestedId = Array.isArray(sp.listing) ? sp.listing[0] : sp.listing;
  const selected =
    listings.find((l) => l.id === requestedId) ?? listings[0] ?? null;

  const calendar = selected
    ? await getHostCalendarData(user, selected.id)
    : null;

  return (
    <div className="container-stay py-10 md:py-12 space-y-6">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-primary)]">
          Cổng Chủ nhà
        </p>
        <h1 className="page-title">Quản lý lịch trống & giá theo đêm</h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          Khóa ngày không nhận khách và điều chỉnh giá theo từng đêm bằng số nguyên VND.
        </p>
      </div>

      <HostSubNav />

      {!selected || !calendar ? (
        <div className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface-ivory)] p-8 text-center space-y-3">
          <p className="text-sm text-[var(--color-text-muted)]">
            Bạn chưa có chỗ ở nào để quản lý lịch.
          </p>
          <Link
            href="/host/listings/new"
            className="inline-flex items-center min-h-[44px] px-5 rounded-[12px] bg-[var(--color-primary)] text-white text-sm font-medium"
          >
            Đăng chỗ ở đầu tiên
          </Link>
        </div>
      ) : (
        <HostCalendarManager
          listings={listings}
          selectedListingId={selected.id}
          initialCalendar={calendar}
        />
      )}
    </div>
  );
}
