'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import {
  BarChart3,
  Bell,
  Building2,
  CalendarCheck2,
  CalendarRange,
  Check,
  ChevronDown,
  Compass,
  Globe,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Settings,
  ShieldCheck,
  Star,
  User,
  Wallet,
  X,
} from 'lucide-react';
import type { SessionUser } from '@/lib/auth/session';
import { SUPPORTED_CURRENCIES, type CurrencyCode } from '@/lib/i18n';
import type { HostShellContext } from '@/modules/host-console';
import { usePreferences } from '@/components/PreferencesProvider';

interface NavItem {
  key: string;
  href: string;
  labelEn: string;
  labelVi: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  badge?: number;
}

export function HostShell({
  user,
  context,
  children,
}: {
  user: SessionUser;
  context: HostShellContext;
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? '/host';
  const { locale, currency, setLocale, setCurrency, hostCommissionPct } = usePreferences();
  const isVi = locale === 'vi';

  const [collapsed, setCollapsed] = useState(false);
  const [openMenu, setOpenMenu] = useState<'notifications' | 'locale' | 'account' | null>(
    null
  );
  const [moreOpen, setMoreOpen] = useState(false);
  const [markedRead, setMarkedRead] = useState(false);
  const headerRef = useRef<HTMLElement>(null);

  const unreadNotifs = markedRead ? 0 : context.unreadNotificationsCount;
  const notifs = markedRead
    ? context.notifications.map((n) => ({ ...n, isRead: true }))
    : context.notifications;

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpenMenu(null);
        setMoreOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, []);

  const navItems: NavItem[] = [
    {
      key: 'overview',
      href: '/host',
      labelEn: 'Overview',
      labelVi: 'Tổng quan',
      icon: LayoutDashboard,
    },
    {
      key: 'calendar',
      href: '/host/calendar',
      labelEn: 'Calendar',
      labelVi: 'Lịch & Giá phòng',
      icon: CalendarRange,
    },
    {
      key: 'reservations',
      href: '/host/reservations',
      labelEn: 'Reservations',
      labelVi: 'Đặt phòng',
      icon: CalendarCheck2,
      badge: context.pendingReservationsCount,
    },
    {
      key: 'listings',
      href: '/host/listings',
      labelEn: 'Listings',
      labelVi: 'Cơ sở lưu trú',
      icon: Building2,
    },
    {
      key: 'messages',
      href: '/host/messages',
      labelEn: 'Messages',
      labelVi: 'Tin nhắn',
      icon: MessageSquare,
      badge: context.unreadMessagesCount,
    },
    {
      key: 'earnings',
      href: '/host/earnings',
      labelEn: 'Earnings',
      labelVi: 'Doanh thu',
      icon: Wallet,
    },
    {
      key: 'reviews',
      href: '/host/reviews',
      labelEn: 'Reviews',
      labelVi: 'Đánh giá',
      icon: Star,
    },
    {
      key: 'insights',
      href: '/host/insights',
      labelEn: 'Insights',
      labelVi: 'Hiệu quả',
      icon: BarChart3,
    },
    {
      key: 'settings',
      href: '/host/settings',
      labelEn: 'Settings',
      labelVi: 'Cài đặt',
      icon: Settings,
    },
    {
      key: 'help',
      href: '/host/help',
      labelEn: 'Help Center',
      labelVi: 'Hỗ trợ',
      icon: HelpCircle,
    },
  ];

  const isActive = (href: string) => {
    if (href === '/host') return pathname === '/host';
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const activeNav = navItems.find((item) => isActive(item.href)) ?? navItems[0]!;

  async function handleMarkNotificationsRead() {
    setMarkedRead(true);
    await fetch('/api/host/notifications/read', { method: 'POST' });
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.assign('/');
  }

  return (
    <div className="min-h-screen bg-[#FAF8F3] text-[#17221E] lg:flex">
      {/* Desktop Left Collapsible Sidebar */}
      <aside
        className={`hidden shrink-0 border-r border-[#E5DFD3] bg-white lg:flex lg:flex-col lg:sticky lg:top-0 lg:h-screen transition-[width] duration-200 ${
          collapsed ? 'lg:w-[72px]' : 'lg:w-60'
        }`}
      >
        {/* Brand Row */}
        <div className="flex h-16 items-center justify-between border-b border-[#E5DFD3] px-4">
          <Link href="/host" className="flex items-center gap-2.5 overflow-hidden">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#164E3F] text-white">
              <svg viewBox="0 0 28 28" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 18.5L14 7l10 11.5H4z" strokeLinejoin="round" />
                <path d="M10.5 21.5a5 5 0 017 0" strokeLinecap="round" />
              </svg>
            </span>
            {!collapsed && (
              <div className="min-w-0 leading-tight">
                <div className="font-serif-display truncate text-base font-semibold text-[#164E3F]">
                  VietNomad
                </div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#53635D]">
                  Host Console
                </div>
              </div>
            )}
          </Link>
          {!collapsed && (
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              className="rounded-lg p-1.5 text-[#53635D] hover:bg-[#FAF8F3] hover:text-[#17221E]"
              title={isVi ? 'Thu gọn thanh bên' : 'Collapse sidebar'}
            >
              <PanelLeftClose className="h-4 w-4" strokeWidth={1.75} />
            </button>
          )}
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2.5 py-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.key}
                href={item.href}
                title={collapsed ? (isVi ? item.labelVi : item.labelEn) : undefined}
                className={`group flex items-center justify-between rounded-lg px-3 py-2 text-[13px] font-medium transition-colors ${
                  active
                    ? 'bg-[#E7F1EC] font-semibold text-[#164E3F]'
                    : 'text-[#53635D] hover:bg-[#FAF8F3] hover:text-[#17221E]'
                }`}
              >
                <span className="flex items-center gap-3 min-w-0">
                  <Icon
                    className={`h-[18px] w-[18px] shrink-0 ${
                      active ? 'text-[#164E3F]' : 'text-[#53635D] group-hover:text-[#17221E]'
                    }`}
                    strokeWidth={1.75}
                  />
                  {!collapsed && (
                    <span className="truncate">{isVi ? item.labelVi : item.labelEn}</span>
                  )}
                </span>
                {!collapsed && typeof item.badge === 'number' && item.badge > 0 && (
                  <span className="ml-2 rounded-full bg-[#164E3F] px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bottom Utility */}
        <div className="border-t border-[#E5DFD3] p-2.5 space-y-1">
          {collapsed && (
            <button
              type="button"
              onClick={() => setCollapsed(false)}
              className="flex w-full items-center justify-center rounded-lg p-2 text-[#53635D] hover:bg-[#FAF8F3] hover:text-[#17221E]"
              title={isVi ? 'Mở rộng thanh bên' : 'Expand sidebar'}
            >
              <PanelLeftOpen className="h-4 w-4" strokeWidth={1.75} />
            </button>
          )}
          <Link
            href="/"
            title={collapsed ? (isVi ? 'Giao diện khách hàng' : 'Switch to Guest View') : undefined}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium text-[#53635D] hover:bg-[#FAF8F3] hover:text-[#17221E]"
          >
            <Compass className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
            {!collapsed && (
              <span className="truncate">
                {isVi ? 'Giao diện khách hàng' : 'Switch to Guest View'}
              </span>
            )}
          </Link>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col pb-20 lg:pb-0">
        {/* Top Header */}
        <header
          ref={headerRef}
          className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-[#E5DFD3] bg-white px-4 sm:px-6 lg:px-8"
        >
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/host"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#164E3F] text-white lg:hidden"
            >
              <svg viewBox="0 0 28 28" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 18.5L14 7l10 11.5H4z" strokeLinejoin="round" />
                <path d="M10.5 21.5a5 5 0 017 0" strokeLinecap="round" />
              </svg>
            </Link>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-[#17221E] sm:text-base">
                {isVi ? activeNav.labelVi : activeNav.labelEn}
              </div>
              <div className="hidden text-[11px] text-[#53635D] sm:block">
                {isVi
                  ? `Kênh chủ nhà · ${hostCommissionPct}% hoa hồng`
                  : `Host Console · ${hostCommissionPct}% host commission`}
              </div>
            </div>
          </div>

          {/* Header Right Controls */}
          <div className="flex items-center gap-2">
            <Link
              href="/host/listings/create"
              className="hidden items-center gap-1.5 rounded-lg bg-[#164E3F] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#0F392E] sm:inline-flex"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2} />
              {isVi ? 'Đăng chỗ ở' : 'Add listing'}
            </Link>

            <Link
              href="/"
              className="hidden items-center gap-1.5 rounded-lg border border-[#E5DFD3] bg-white px-3 py-1.5 text-xs font-medium text-[#17221E] hover:bg-[#FAF8F3] md:inline-flex"
            >
              <Compass className="h-3.5 w-3.5 text-[#53635D]" strokeWidth={1.75} />
              {isVi ? 'Chế độ khách' : 'Guest view'}
            </Link>

            {/* Notifications */}
            <div className="relative">
              <button
                type="button"
                onClick={() =>
                  setOpenMenu(openMenu === 'notifications' ? null : 'notifications')
                }
                aria-label={isVi ? 'Thông báo' : 'Notifications'}
                className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-[#E5DFD3] bg-white text-[#53635D] hover:bg-[#FAF8F3] hover:text-[#17221E]"
              >
                <Bell className="h-4 w-4" strokeWidth={1.75} />
                {unreadNotifs > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#C25E28] px-1 text-[10px] font-bold text-white">
                    {unreadNotifs}
                  </span>
                )}
              </button>

              {openMenu === 'notifications' && (
                <div className="absolute right-0 top-full z-40 mt-2 w-80 rounded-xl border border-[#E5DFD3] bg-white p-3 shadow-lg">
                  <div className="flex items-center justify-between border-b border-[#E5DFD3] pb-2">
                    <span className="text-xs font-semibold text-[#17221E]">
                      {isVi ? 'Thông báo vận hành' : 'Notifications'}
                    </span>
                    {unreadNotifs > 0 && (
                      <button
                        type="button"
                        onClick={handleMarkNotificationsRead}
                        className="text-[11px] font-medium text-[#164E3F] hover:underline"
                      >
                        {isVi ? 'Đánh dấu đã đọc' : 'Mark all read'}
                      </button>
                    )}
                  </div>
                  <div className="mt-2 max-h-64 space-y-1.5 overflow-y-auto">
                    {notifs.length === 0 ? (
                      <p className="py-4 text-center text-xs text-[#53635D]">
                        {isVi ? 'Chưa có thông báo mới.' : 'No notifications yet.'}
                      </p>
                    ) : (
                      notifs.map((n) => (
                        <Link
                          key={n.id}
                          href="/host/reservations"
                          onClick={() => setOpenMenu(null)}
                          className={`block rounded-lg p-2.5 text-xs transition hover:bg-[#FAF8F3] ${
                            n.isRead ? 'text-[#53635D]' : 'bg-[#FAF8F3] font-medium text-[#17221E]'
                          }`}
                        >
                          <div className="line-clamp-2">{n.subject}</div>
                          <div className="mt-1 text-[10px] text-[#53635D]">
                            {n.bookingCode} · {n.createdAt.slice(0, 16).replace('T', ' ')}
                          </div>
                        </Link>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <Link
              href="/host/help"
              aria-label={isVi ? 'Trung tâm hỗ trợ' : 'Help Center'}
              className="hidden h-9 w-9 items-center justify-center rounded-lg border border-[#E5DFD3] bg-white text-[#53635D] hover:bg-[#FAF8F3] hover:text-[#17221E] sm:flex"
            >
              <HelpCircle className="h-4 w-4" strokeWidth={1.75} />
            </Link>

            {/* Locale & Currency */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenMenu(openMenu === 'locale' ? null : 'locale')}
                className="flex h-9 items-center gap-1.5 rounded-lg border border-[#E5DFD3] bg-white px-2.5 text-xs font-semibold text-[#17221E] hover:bg-[#FAF8F3]"
              >
                <Globe className="h-3.5 w-3.5 text-[#53635D]" strokeWidth={1.75} />
                <span>{locale.toUpperCase()}</span>
                <span className="text-[#D4CEC2]">|</span>
                <span className="hidden sm:inline">{currency}</span>
              </button>

              {openMenu === 'locale' && (
                <div className="absolute right-0 top-full z-40 mt-2 w-64 space-y-3 rounded-xl border border-[#E5DFD3] bg-white p-3.5 shadow-lg">
                  <div>
                    <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#53635D]">
                      {isVi ? 'Ngôn ngữ' : 'Language'}
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setLocale('en');
                          setOpenMenu(null);
                        }}
                        className={`flex items-center justify-between rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${
                          locale === 'en'
                            ? 'border-[#164E3F] bg-[#E7F1EC] text-[#164E3F]'
                            : 'border-[#E5DFD3]'
                        }`}
                      >
                        English
                        {locale === 'en' && <Check className="h-3 w-3" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setLocale('vi');
                          setOpenMenu(null);
                        }}
                        className={`flex items-center justify-between rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${
                          locale === 'vi'
                            ? 'border-[#164E3F] bg-[#E7F1EC] text-[#164E3F]'
                            : 'border-[#E5DFD3]'
                        }`}
                      >
                        Tiếng Việt
                        {locale === 'vi' && <Check className="h-3 w-3" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#53635D]">
                      {isVi ? 'Tiền tệ' : 'Currency'}
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      {SUPPORTED_CURRENCIES.map((c) => (
                        <button
                          key={c.code}
                          type="button"
                          onClick={() => {
                            setCurrency(c.code as CurrencyCode);
                            setOpenMenu(null);
                          }}
                          className={`rounded-md border px-2 py-1 text-[11px] font-semibold ${
                            currency === c.code
                              ? 'border-[#164E3F] bg-[#164E3F] text-white'
                              : 'border-[#E5DFD3] hover:bg-[#FAF8F3]'
                          }`}
                        >
                          {c.code}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Account */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenMenu(openMenu === 'account' ? null : 'account')}
                className="flex h-9 items-center gap-2 rounded-lg border border-[#E5DFD3] bg-white px-2.5 text-xs font-semibold text-[#17221E] hover:bg-[#FAF8F3]"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#164E3F] text-[11px] font-bold text-white">
                  {user.fullName.slice(0, 1).toUpperCase()}
                </span>
                <span className="hidden max-w-[110px] truncate sm:inline">
                  {user.fullName}
                </span>
                <ChevronDown className="h-3.5 w-3.5 text-[#53635D]" strokeWidth={1.75} />
              </button>

              {openMenu === 'account' && (
                <div className="absolute right-0 top-full z-40 mt-2 w-60 rounded-xl border border-[#E5DFD3] bg-white p-2 shadow-lg text-xs">
                  <div className="border-b border-[#E5DFD3] px-2.5 py-2">
                    <div className="font-semibold text-[#17221E]">{user.fullName}</div>
                    <div className="truncate text-[#53635D]">{user.email}</div>
                  </div>
                  <div className="py-1 space-y-0.5">
                    <Link
                      href="/host/settings"
                      onClick={() => setOpenMenu(null)}
                      className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-[#17221E] hover:bg-[#FAF8F3]"
                    >
                      <Settings className="h-3.5 w-3.5 text-[#53635D]" strokeWidth={1.75} />
                      {isVi ? 'Cài đặt tài khoản Host' : 'Host settings'}
                    </Link>
                    <Link
                      href="/dashboard"
                      onClick={() => setOpenMenu(null)}
                      className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-[#17221E] hover:bg-[#FAF8F3]"
                    >
                      <User className="h-3.5 w-3.5 text-[#53635D]" strokeWidth={1.75} />
                      {isVi ? 'Tài khoản khách (Member)' : 'Guest dashboard'}
                    </Link>
                    <Link
                      href="/"
                      onClick={() => setOpenMenu(null)}
                      className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-[#17221E] hover:bg-[#FAF8F3]"
                    >
                      <Compass className="h-3.5 w-3.5 text-[#53635D]" strokeWidth={1.75} />
                      {isVi ? 'Giao diện khách hàng' : 'Switch to Guest View'}
                    </Link>
                    {user.role === 'admin' && (
                      <Link
                        href="/admin"
                        onClick={() => setOpenMenu(null)}
                        className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-[#C25E28] hover:bg-[#FAEDE5]"
                      >
                        <ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.75} />
                        Admin Console
                      </Link>
                    )}
                  </div>
                  <div className="border-t border-[#E5DFD3] pt-1">
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left font-medium text-[#C25E28] hover:bg-[#FAEDE5]"
                    >
                      <LogOut className="h-3.5 w-3.5" strokeWidth={1.75} />
                      {isVi ? 'Đăng xuất' : 'Sign out'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main Workspace */}
        <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>

      {/* Mobile 5-Tab Bottom Navigation */}
      <nav
        aria-label="Host Mobile Navigation"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-[#E5DFD3] bg-white lg:hidden"
      >
        <Link
          href="/host"
          className={`flex flex-col items-center justify-center py-2 text-[11px] font-medium ${
            pathname === '/host' ? 'text-[#164E3F] font-semibold' : 'text-[#53635D]'
          }`}
        >
          <LayoutDashboard className="mb-0.5 h-5 w-5" strokeWidth={1.75} />
          <span>{isVi ? 'Hôm nay' : 'Today'}</span>
        </Link>
        <Link
          href="/host/calendar"
          className={`flex flex-col items-center justify-center py-2 text-[11px] font-medium ${
            isActive('/host/calendar') ? 'text-[#164E3F] font-semibold' : 'text-[#53635D]'
          }`}
        >
          <CalendarRange className="mb-0.5 h-5 w-5" strokeWidth={1.75} />
          <span>{isVi ? 'Lịch' : 'Calendar'}</span>
        </Link>
        <Link
          href="/host/listings"
          className={`flex flex-col items-center justify-center py-2 text-[11px] font-medium ${
            isActive('/host/listings') ? 'text-[#164E3F] font-semibold' : 'text-[#53635D]'
          }`}
        >
          <Building2 className="mb-0.5 h-5 w-5" strokeWidth={1.75} />
          <span>{isVi ? 'Chỗ ở' : 'Listings'}</span>
        </Link>
        <Link
          href="/host/messages"
          className={`relative flex flex-col items-center justify-center py-2 text-[11px] font-medium ${
            isActive('/host/messages') ? 'text-[#164E3F] font-semibold' : 'text-[#53635D]'
          }`}
        >
          <MessageSquare className="mb-0.5 h-5 w-5" strokeWidth={1.75} />
          {context.unreadMessagesCount > 0 && (
            <span className="absolute right-4 top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#C25E28] px-1 text-[9px] font-bold text-white">
              {context.unreadMessagesCount}
            </span>
          )}
          <span>{isVi ? 'Hộp thư' : 'Inbox'}</span>
        </Link>
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className={`flex flex-col items-center justify-center py-2 text-[11px] font-medium ${
            moreOpen ? 'text-[#164E3F] font-semibold' : 'text-[#53635D]'
          }`}
        >
          <Menu className="mb-0.5 h-5 w-5" strokeWidth={1.75} />
          <span>{isVi ? 'Thêm' : 'More'}</span>
        </button>
      </nav>

      {/* Mobile "More" Bottom Sheet */}
      {moreOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/40 lg:hidden"
          onClick={() => setMoreOpen(false)}
        >
          <div
            className="w-full rounded-t-2xl border-t border-[#E5DFD3] bg-white p-5 pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="text-sm font-semibold text-[#17221E]">
                {isVi ? 'Tất cả công cụ Host' : 'All Host Tools'}
              </div>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="rounded-lg p-1.5 text-[#53635D] hover:bg-[#FAF8F3]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                { href: '/host/reservations', labelEn: 'Reservations', labelVi: 'Đặt phòng', icon: CalendarCheck2, badge: context.pendingReservationsCount },
                { href: '/host/earnings', labelEn: 'Earnings', labelVi: 'Doanh thu', icon: Wallet },
                { href: '/host/reviews', labelEn: 'Reviews', labelVi: 'Đánh giá', icon: Star },
                { href: '/host/insights', labelEn: 'Insights', labelVi: 'Hiệu quả', icon: BarChart3 },
                { href: '/host/settings', labelEn: 'Settings', labelVi: 'Cài đặt', icon: Settings },
                { href: '/host/help', labelEn: 'Help Center', labelVi: 'Hỗ trợ', icon: HelpCircle },
                { href: '/host/listings/create', labelEn: 'Add listing', labelVi: 'Đăng chỗ ở', icon: Plus },
                { href: '/', labelEn: 'Guest view', labelVi: 'Giao diện khách', icon: Compass },
              ].map((m) => {
                const Icon = m.icon;
                return (
                  <Link
                    key={m.href}
                    href={m.href}
                    onClick={() => setMoreOpen(false)}
                    className="flex items-center justify-between rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2.5 font-medium text-[#17221E]"
                  >
                    <span className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-[#164E3F]" strokeWidth={1.75} />
                      {isVi ? m.labelVi : m.labelEn}
                    </span>
                    {typeof m.badge === 'number' && m.badge > 0 && (
                      <span className="rounded-full bg-[#164E3F] px-1.5 py-0.5 text-[10px] font-bold text-white">
                        {m.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
