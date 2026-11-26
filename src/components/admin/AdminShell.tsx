'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import {
  Bell,
  Building2,
  CalendarCheck2,
  Check,
  ChevronDown,
  ClipboardCheck,
  Compass,
  Globe,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import type { SessionUser } from '@/lib/auth/session';
import { SUPPORTED_CURRENCIES, type CurrencyCode } from '@/lib/i18n';
import { usePreferences } from '@/components/PreferencesProvider';

export function AdminShell({
  user,
  pendingApplicationsCount,
  alertsCount,
  children,
}: {
  user: SessionUser;
  pendingApplicationsCount: number;
  alertsCount: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? '/admin';
  const { locale, currency, setLocale, setCurrency } = usePreferences();
  const isVi = locale === 'vi';

  const [collapsed, setCollapsed] = useState(false);
  const [openMenu, setOpenMenu] = useState<'locale' | 'account' | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const navItems = [
    {
      href: '/admin',
      labelEn: 'Operations',
      labelVi: 'Tổng quan vận hành',
      icon: LayoutDashboard,
      active: pathname === '/admin',
    },
    {
      href: '/admin#applications',
      labelEn: 'Applications',
      labelVi: 'Duyệt hồ sơ',
      icon: ClipboardCheck,
      badge: pendingApplicationsCount,
      active: false,
    },
    {
      href: '/admin#stays',
      labelEn: 'Listings & Badges',
      labelVi: 'Cơ sở & Huy hiệu',
      icon: Building2,
      active: false,
    },
    {
      href: '/admin#bookings',
      labelEn: 'Bookings & Refunds',
      labelVi: 'Đơn đặt & Hoàn phí',
      icon: CalendarCheck2,
      active: false,
    },
    {
      href: '/admin#alerts',
      labelEn: 'Zalo SLA Alerts',
      labelVi: 'Cảnh báo Zalo SLA',
      icon: Bell,
      badge: alertsCount,
      active: false,
    },
    {
      href: '/admin#crm',
      labelEn: 'Customer CRM',
      labelVi: 'Khách hàng (CRM)',
      icon: Users,
      active: false,
    },
  ];

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.assign('/');
  }

  return (
    <div className="min-h-screen bg-[#FAF8F3] text-[#17221E] lg:flex">
      {/* Desktop Collapsible Sidebar */}
      <aside
        className={`hidden shrink-0 border-r border-[#E5DFD3] bg-white lg:flex lg:flex-col lg:sticky lg:top-0 lg:h-screen transition-[width] duration-200 ${
          collapsed ? 'lg:w-[72px]' : 'lg:w-60'
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-[#E5DFD3] px-4">
          <Link href="/admin" className="flex items-center gap-2.5 overflow-hidden">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#17221E] text-white">
              <ShieldCheck className="h-4 w-4" strokeWidth={1.75} />
            </span>
            {!collapsed && (
              <div className="min-w-0 leading-tight">
                <div className="font-serif-display truncate text-base font-semibold text-[#17221E]">
                  VietNomad
                </div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#C25E28]">
                  Admin Console
                </div>
              </div>
            )}
          </Link>
          {!collapsed && (
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              className="rounded-lg p-1.5 text-[#53635D] hover:bg-[#FAF8F3] hover:text-[#17221E]"
            >
              <PanelLeftClose className="h-4 w-4" strokeWidth={1.75} />
            </button>
          )}
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2.5 py-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? (isVi ? item.labelVi : item.labelEn) : undefined}
                className={`flex items-center justify-between rounded-lg px-3 py-2 text-[13px] font-medium transition-colors ${
                  item.active
                    ? 'bg-[#FAEDE5] font-semibold text-[#C25E28]'
                    : 'text-[#53635D] hover:bg-[#FAF8F3] hover:text-[#17221E]'
                }`}
              >
                <span className="flex items-center gap-3 min-w-0">
                  <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
                  {!collapsed && (
                    <span className="truncate">{isVi ? item.labelVi : item.labelEn}</span>
                  )}
                </span>
                {!collapsed && typeof item.badge === 'number' && item.badge > 0 && (
                  <span className="ml-2 rounded-full bg-[#C25E28] px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-[#E5DFD3] p-2.5 space-y-1">
          {collapsed && (
            <button
              type="button"
              onClick={() => setCollapsed(false)}
              className="flex w-full items-center justify-center rounded-lg p-2 text-[#53635D] hover:bg-[#FAF8F3]"
            >
              <PanelLeftOpen className="h-4 w-4" strokeWidth={1.75} />
            </button>
          )}
          <Link
            href="/host"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium text-[#53635D] hover:bg-[#FAF8F3] hover:text-[#17221E]"
          >
            <Building2 className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
            {!collapsed && <span className="truncate">Host Console</span>}
          </Link>
          <Link
            href="/"
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

      <div className="flex min-w-0 flex-1 flex-col">
        <header
          ref={headerRef}
          className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-[#E5DFD3] bg-white px-4 sm:px-6 lg:px-8"
        >
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="rounded-lg border border-[#E5DFD3] p-2 text-[#53635D] lg:hidden"
              aria-label="Open admin menu"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div>
              <div className="text-sm font-semibold text-[#17221E] sm:text-base">
                {isVi ? 'Trung tâm kiểm duyệt & vận hành' : 'Moderation & Operations'}
              </div>
              <div className="hidden text-[11px] text-[#53635D] sm:block">
                {isVi
                  ? 'Quản lý hồ sơ đăng tin, huy hiệu kiểm định và hỗ trợ xử lý đơn'
                  : 'Listing approvals, optional trust badges, bookings & CRM'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="hidden items-center gap-1.5 rounded-lg border border-[#E5DFD3] bg-white px-3 py-1.5 text-xs font-medium text-[#17221E] hover:bg-[#FAF8F3] sm:inline-flex"
            >
              <Compass className="h-3.5 w-3.5 text-[#53635D]" strokeWidth={1.75} />
              {isVi ? 'Chế độ khách' : 'Guest view'}
            </Link>

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
                <div className="absolute right-0 top-full z-40 mt-2 w-60 space-y-3 rounded-xl border border-[#E5DFD3] bg-white p-3.5 shadow-lg">
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setLocale('en');
                        setOpenMenu(null);
                      }}
                      className={`flex items-center justify-between rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${
                        locale === 'en' ? 'border-[#164E3F] bg-[#E7F1EC] text-[#164E3F]' : 'border-[#E5DFD3]'
                      }`}
                    >
                      English {locale === 'en' && <Check className="h-3 w-3" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setLocale('vi');
                        setOpenMenu(null);
                      }}
                      className={`flex items-center justify-between rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${
                        locale === 'vi' ? 'border-[#164E3F] bg-[#E7F1EC] text-[#164E3F]' : 'border-[#E5DFD3]'
                      }`}
                    >
                      Tiếng Việt {locale === 'vi' && <Check className="h-3 w-3" />}
                    </button>
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
              )}
            </div>

            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenMenu(openMenu === 'account' ? null : 'account')}
                className="flex h-9 items-center gap-2 rounded-lg border border-[#E5DFD3] bg-white px-2.5 text-xs font-semibold text-[#17221E] hover:bg-[#FAF8F3]"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#C25E28] text-[11px] font-bold text-white">
                  A
                </span>
                <span className="hidden max-w-[100px] truncate sm:inline">{user.fullName}</span>
                <ChevronDown className="h-3.5 w-3.5 text-[#53635D]" strokeWidth={1.75} />
              </button>

              {openMenu === 'account' && (
                <div className="absolute right-0 top-full z-40 mt-2 w-56 rounded-xl border border-[#E5DFD3] bg-white p-2 shadow-lg text-xs">
                  <div className="border-b border-[#E5DFD3] px-2.5 py-2">
                    <div className="font-semibold text-[#17221E]">{user.fullName}</div>
                    <div className="truncate text-[#53635D]">{user.email}</div>
                  </div>
                  <div className="py-1 space-y-0.5">
                    <Link
                      href="/host"
                      onClick={() => setOpenMenu(null)}
                      className="flex items-center gap-2 rounded-lg px-2.5 py-2 hover:bg-[#FAF8F3]"
                    >
                      <Building2 className="h-3.5 w-3.5 text-[#53635D]" />
                      Host Console
                    </Link>
                    <Link
                      href="/"
                      onClick={() => setOpenMenu(null)}
                      className="flex items-center gap-2 rounded-lg px-2.5 py-2 hover:bg-[#FAF8F3]"
                    >
                      <Compass className="h-3.5 w-3.5 text-[#53635D]" />
                      {isVi ? 'Giao diện khách hàng' : 'Guest view'}
                    </Link>
                  </div>
                  <div className="border-t border-[#E5DFD3] pt-1">
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left font-medium text-[#C25E28] hover:bg-[#FAEDE5]"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      {isVi ? 'Đăng xuất' : 'Sign out'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 flex bg-black/40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            className="w-72 bg-white p-4 h-full border-r border-[#E5DFD3]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between border-b border-[#E5DFD3] pb-3">
              <span className="font-serif-display text-base font-semibold text-[#17221E]">
                VietNomad Admin
              </span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg p-1.5 text-[#53635D]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium text-[#17221E] hover:bg-[#FAF8F3]"
                  >
                    <span className="flex items-center gap-2.5">
                      <Icon className="h-4 w-4 text-[#53635D]" />
                      {isVi ? item.labelVi : item.labelEn}
                    </span>
                    {typeof item.badge === 'number' && item.badge > 0 && (
                      <span className="rounded-full bg-[#C25E28] px-1.5 py-0.5 text-[10px] font-bold text-white">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
              <div className="my-2 border-t border-[#E5DFD3]" />
              <Link
                href="/host"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-[#164E3F] hover:bg-[#E7F1EC]"
              >
                <Building2 className="h-4 w-4" />
                Host Console
              </Link>
              <Link
                href="/"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-[#53635D] hover:bg-[#FAF8F3]"
              >
                <Compass className="h-4 w-4" />
                {isVi ? 'Giao diện khách hàng' : 'Guest view'}
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
