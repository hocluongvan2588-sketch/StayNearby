import Link from 'next/link';
import {
  ArrowRight,
  Calendar,
  Compass,
  LogIn,
  MapPin,
  Search,
  User,
} from 'lucide-react';
import { getQuickDemoAccount } from '@/lib/auth/demo-quick-account';
import { getCurrentUser } from '@/lib/auth/session';
import { formatMoneyFromVnd } from '@/lib/i18n/currency';
import { getUserMessages } from '@/lib/i18n/messages';
import { getServerUserPreferences } from '@/lib/i18n/preferences';
import { getGuestTrips } from '@/modules/bookings';
import { DemoCustomerLoginButton } from '@/components/auth/DemoCustomerLoginButton';
import { StatusBadge } from '@/components/ui/StatusBadge';

export const dynamic = 'force-dynamic';

export default async function CustomerPortalPage() {
  const [user, prefs] = await Promise.all([
    getCurrentUser(),
    getServerUserPreferences(),
  ]);

  const locale = prefs.locale;
  const currency = prefs.currency;
  const isVi = locale === 'vi';
  const t = getUserMessages(locale);
  const guestDemo = getQuickDemoAccount('guest');

  if (!user) {
    return (
      <div className="container-stay py-10 md:py-14 max-w-4xl space-y-8">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-primary)]">
            {isVi ? 'Cổng Khách hàng' : 'Customer Portal'}
          </p>
          <h1 className="page-title">
            {isVi
              ? 'Không gian Khách hàng & Chuyến đi của bạn'
              : 'Your Customer Portal & Stays'}
          </h1>
          <p className="text-sm md:text-base text-[var(--color-text-muted)] max-w-2xl">
            {isVi
              ? 'Theo dõi yêu cầu đặt phòng, mở khóa địa chỉ & hướng dẫn nhận phòng sau khi xác nhận, xem lịch sử chi tiêu bằng tiền tệ bạn chọn và khám phá cẩm nang địa phương.'
              : 'Track booking requests, unlock exact check-in instructions once confirmed, review locked VND totals in your preferred currency, and browse neighborhood guides.'}
          </p>
        </div>

        <div className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 space-y-5 shadow-apple-subtle">
          <div className="space-y-1.5">
            <h2 className="text-lg font-semibold text-[var(--color-text)]">
              {isVi
                ? 'Đăng nhập để quản lý hồ sơ & chuyến đi'
                : 'Sign in to view your customer profile & trips'}
            </h2>
            <p className="text-sm text-[var(--color-text-muted)]">
              {isVi
                ? 'Bạn có thể đăng nhập bằng tài khoản của mình hoặc trải nghiệm ngay với tài khoản Khách hàng mẫu.'
                : 'Sign in with your account or jump right in using the seeded demo customer account.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {guestDemo && (
              <DemoCustomerLoginButton
                email={guestDemo.email}
                password={guestDemo.password}
                label={
                  isVi
                    ? `Trải nghiệm ngay (${guestDemo.displayName})`
                    : `Try as ${guestDemo.displayName} (Demo Guest)`
                }
                loadingLabel={isVi ? 'Đang đăng nhập...' : 'Signing in...'}
                targetPath="/customer"
              />
            )}

            <Link
              href="/login?next=/customer"
              className="inline-flex items-center gap-2 min-h-[44px] px-5 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] text-sm font-medium text-[var(--color-text)] hover:border-[var(--color-primary)]"
            >
              <LogIn className="w-4 h-4" aria-hidden="true" />
              <span>{isVi ? 'Đăng nhập tài khoản' : 'Sign in'}</span>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link
            href="/stays"
            className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface-ivory)] p-5 space-y-2 hover:border-[var(--color-primary)] transition-colors"
          >
            <Search className="w-5 h-5 text-[var(--color-primary)]" aria-hidden="true" />
            <h3 className="text-base font-semibold text-[var(--color-text)]">
              {isVi ? 'Tìm chỗ ở làm việc từ xa' : 'Browse remote-work stays'}
            </h3>
            <p className="text-xs text-[var(--color-text-muted)]">
              {isVi
                ? 'Lọc theo khu vực, bếp đầy đủ, máy giặt, bàn làm việc và nhận phòng muộn.'
                : 'Filter across Vietnam neighborhoods by kitchen, washer, desk, and late check-in.'}
            </p>
          </Link>

          <Link
            href="/explore"
            className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface-ivory)] p-5 space-y-2 hover:border-[var(--color-primary)] transition-colors"
          >
            <Compass className="w-5 h-5 text-[var(--color-primary)]" aria-hidden="true" />
            <h3 className="text-base font-semibold text-[var(--color-text)]">
              {isVi ? 'Khám phá địa phương & Coworking' : 'Explore neighborhood guides'}
            </h3>
            <p className="text-xs text-[var(--color-text-muted)]">
              {isVi
                ? 'Lịch trình ngắn 1–2 giờ, quán ăn bản địa và không gian làm việc gần chỗ ở.'
                : 'Curated 1–2 hour routes, local dining, and coworking spots nearby.'}
            </p>
          </Link>
        </div>
      </div>
    );
  }

  const trips = await getGuestTrips(user);
  const pendingCount = trips.filter(
    (tr) => tr.status === 'pending' && !tr.isExpired
  ).length;
  const confirmedCount = trips.filter((tr) => tr.status === 'confirmed').length;
  const completedCount = trips.filter((tr) => tr.status === 'completed').length;

  return (
    <div className="container-stay py-10 md:py-12 space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-primary)]">
            {isVi ? 'Cổng Khách hàng' : 'Customer Portal'}
          </p>
          <h1 className="page-title">
            {isVi ? `Xin chào, ${user.displayName}` : `Welcome, ${user.displayName}`}
          </h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            {isVi
              ? 'Quản lý thông tin tài khoản, theo dõi đơn đặt phòng và lịch trình lưu trú của bạn.'
              : 'Manage your guest profile, active booking requests, and upcoming stays.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/trips"
            className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-[12px] bg-[var(--color-primary)] text-white text-sm font-medium hover:bg-[var(--color-primary-hover)]"
          >
            <span>{isVi ? 'Tất cả chuyến đi' : 'View all trips'}</span>
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>
          <Link
            href="/stays"
            className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] text-sm font-medium text-[var(--color-text)] hover:border-[var(--color-primary)]"
          >
            <Search className="w-4 h-4" aria-hidden="true" />
            <span>{isVi ? 'Đặt chỗ ở mới' : 'Find a stay'}</span>
          </Link>
        </div>
      </div>

      {/* Customer Summary + Profile */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-1.5 shadow-apple-subtle md:col-span-2">
          <p className="text-xs font-medium text-[var(--color-text-muted)] flex items-center gap-1.5">
            <User className="w-4 h-4 text-[var(--color-primary)]" aria-hidden="true" />
            <span>{isVi ? 'Hồ sơ Khách hàng' : 'Customer profile'}</span>
          </p>
          <p className="text-base font-semibold text-[var(--color-text)]">
            {user.displayName}
          </p>
          <p className="text-xs text-[var(--color-text-muted)]">{user.email}</p>
          <p className="text-xs text-[var(--color-text-muted)] pt-1">
            {isVi ? 'Ngôn ngữ & tiền tệ hiển thị: ' : 'Display preference: '}
            <strong className="text-[var(--color-text)]">
              {locale.toUpperCase()} · {currency}
            </strong>
          </p>
        </div>

        <div className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-1 shadow-apple-subtle">
          <p className="text-xs text-[var(--color-text-muted)]">
            {isVi ? 'Chờ chủ nhà duyệt' : 'Pending requests'}
          </p>
          <p className="text-2xl font-semibold text-[var(--color-text)] tabular-nums">
            {pendingCount}
          </p>
          <p className="text-xs text-[var(--color-text-muted)]">
            {isVi ? 'Trong khung 24h phản hồi' : 'Within 24h host window'}
          </p>
        </div>

        <div className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-1 shadow-apple-subtle">
          <p className="text-xs text-[var(--color-text-muted)]">
            {isVi ? 'Đã xác nhận / Hoàn tất' : 'Confirmed / Completed'}
          </p>
          <p className="text-2xl font-semibold text-[var(--color-primary)] tabular-nums">
            {confirmedCount} / {completedCount}
          </p>
          <p className="text-xs text-[var(--color-text-muted)]">
            {isVi ? `Tổng ${trips.length} chuyến đi` : `${trips.length} total trips`}
          </p>
        </div>
      </div>

      {/* Recent Trips */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="section-title">
            {isVi ? 'Chuyến đi gần đây' : 'Recent bookings & stays'}
          </h2>
          <Link
            href="/trips"
            className="text-sm font-medium text-[var(--color-primary)] hover:underline"
          >
            {isVi ? 'Mở danh sách đầy đủ →' : 'Open full trips list →'}
          </Link>
        </div>

        {trips.length === 0 ? (
          <div className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface-ivory)] p-8 text-center space-y-3">
            <p className="text-sm text-[var(--color-text-muted)]">
              {t.trips.emptyBody}
            </p>
            <Link
              href="/stays"
              className="inline-flex items-center min-h-[44px] px-5 rounded-[12px] bg-[var(--color-primary)] text-white text-sm font-medium"
            >
              {t.trips.exploreStays}
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {trips.slice(0, 4).map((trip) => {
              const meta =
                trip.status === 'pending' && trip.isExpired
                  ? { label: t.trips.responseWindowPassed, tone: 'neutral' as const }
                  : t.bookingStatuses[trip.status];
              const listingTitle =
                locale === 'vi' ? trip.listingTitleVi : trip.listingTitle;
              const areaName =
                locale === 'vi' ? trip.areaNameVi : trip.areaNameEn;
              const cityName = locale === 'vi' ? trip.cityVi : trip.cityEn;

              return (
                <Link
                  key={trip.id}
                  href={`/trips/${trip.id}`}
                  className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-3 shadow-apple-subtle hover:border-[var(--color-primary)] transition-colors block"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                      {trip.bookingCode}
                    </span>
                    <StatusBadge label={meta.label} tone={meta.tone} withIcon />
                  </div>
                  <h3 className="text-base font-semibold text-[var(--color-text)]">
                    {listingTitle}
                  </h3>
                  <div className="flex flex-wrap gap-3 text-xs text-[var(--color-text-muted)]">
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-[var(--color-primary)]" aria-hidden="true" />
                      <span>
                        {areaName}, {cityName}
                      </span>
                    </span>
                    <span className="inline-flex items-center gap-1 tabular-nums">
                      <Calendar className="w-3.5 h-3.5 text-[var(--color-primary)]" aria-hidden="true" />
                      <span>
                        {trip.checkIn} – {trip.checkOut}
                      </span>
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-[var(--color-text)] tabular-nums">
                    {formatMoneyFromVnd(trip.totalVnd, currency, locale)}
                  </p>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
