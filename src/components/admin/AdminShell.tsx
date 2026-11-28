'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import {
  Activity,
  BadgePercent,
  Bell,
  Building2,
  CalendarCheck2,
  CalendarDays,
  Check,
  CheckSquare,
  ChevronDown,
  Compass,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  Globe,
  Handshake,
  Headphones,
  KeyRound,
  Landmark,
  LayoutDashboard,
  LogOut,
  MapPin,
  Megaphone,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCcw,
  Scale,
  Search,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Star,
  UserCheck,
  UserPlus,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import type { SessionUser } from '@/lib/auth/session';
import { SUPPORTED_CURRENCIES } from '@/lib/i18n';
import { usePreferences } from '@/components/PreferencesProvider';
import type { AdminModuleKey } from '@/modules/admin-rbac';

interface NavGroup {
  groupLabelEn: string;
  groupLabelVi: string;
  items: Array<{
    moduleKey: AdminModuleKey;
    href: string;
    labelEn: string;
    labelVi: string;
    icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
    badge?: number;
  }>;
}

export function AdminShell({
  user,
  roleName,
  allowedModules,
  badges,
  children,
}: {
  user: SessionUser;
  roleName: string;
  allowedModules: AdminModuleKey[];
  badges: {
    attentionCount: number;
    openTicketsCount: number;
    pendingTasksCount: number;
  };
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? '/admin';
  const router = useRouter();
  const { locale, currency, setLocale, setCurrency } = usePreferences();
  const isVi = locale === 'vi';

  const [collapsed, setCollapsed] = useState(false);
  const [openMenu, setOpenMenu] = useState<'locale' | 'account' | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Global Command Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<
    Array<{ type: string; id: string; title: string; subtitle: string; href: string }>
  >([]);
  const [searching, setSearching] = useState(false);

  const headerRef = useRef<HTMLElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
        setSearchOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        setSearchOpen(true);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, []);

  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/admin/search?q=${encodeURIComponent(searchQuery.trim())}`);
        if (res.ok) {
          const data = (await res.json()) as {
            results: Array<{ type: string; id: string; title: string; subtitle: string; href: string }>;
          };
          setSearchResults(data.results ?? []);
        }
      } finally {
        setSearching(false);
      }
    }, 220);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const allowedSet = new Set<string>(allowedModules);

  const navGroups: NavGroup[] = [
    {
      groupLabelEn: 'WORKSPACE',
      groupLabelVi: 'KHÔNG GIAN LÀM VIỆC',
      items: [
        {
          moduleKey: 'overview',
          href: '/admin',
          labelEn: 'Overview',
          labelVi: 'Tổng quan điều hành',
          icon: LayoutDashboard,
          badge: badges.attentionCount,
        },
        {
          moduleKey: 'tasks',
          href: '/admin/workspace/tasks',
          labelEn: 'Task Center',
          labelVi: 'Trung tâm công việc',
          icon: CheckSquare,
          badge: badges.pendingTasksCount,
        },
        {
          moduleKey: 'notifications',
          href: '/admin/workspace/notifications',
          labelEn: 'Notifications',
          labelVi: 'Thông báo vận hành',
          icon: Bell,
        },
        {
          moduleKey: 'reports',
          href: '/admin/workspace/reports',
          labelEn: 'Management Reports',
          labelVi: 'Báo cáo điều hành',
          icon: FileCheck2,
        },
      ],
    },
    {
      groupLabelEn: 'CRM',
      groupLabelVi: 'KHÁCH HÀNG & ĐỐI TÁC',
      items: [
        {
          moduleKey: 'host_crm',
          href: '/admin/crm/hosts',
          labelEn: 'Host CRM',
          labelVi: 'Quản lý Chủ nhà',
          icon: UserCheck,
        },
        {
          moduleKey: 'guest_crm',
          href: '/admin/crm/guests',
          labelEn: 'Guest CRM',
          labelVi: 'Khách lưu trú 360',
          icon: Users,
        },
        {
          moduleKey: 'host_acquisition',
          href: '/admin/crm/acquisition',
          labelEn: 'Host Acquisition',
          labelVi: 'Phát triển Chủ nhà',
          icon: UserPlus,
        },
        {
          moduleKey: 'local_partners',
          href: '/admin/crm/partners',
          labelEn: 'Local Partners',
          labelVi: 'Đối tác địa phương',
          icon: Handshake,
        },
      ],
    },
    {
      groupLabelEn: 'OPERATIONS',
      groupLabelVi: 'VẬN HÀNH',
      items: [
        {
          moduleKey: 'listings',
          href: '/admin/operations/listings',
          labelEn: 'Listings',
          labelVi: 'Quản lý Chỗ ở',
          icon: Building2,
        },
        {
          moduleKey: 'bookings',
          href: '/admin/operations/bookings',
          labelEn: 'Bookings',
          labelVi: 'Quản lý Đặt phòng',
          icon: CalendarCheck2,
        },
        {
          moduleKey: 'reviews',
          href: '/admin/operations/reviews',
          labelEn: 'Reviews',
          labelVi: 'Đánh giá khách hàng',
          icon: Star,
        },
        {
          moduleKey: 'support',
          href: '/admin/operations/support',
          labelEn: 'Customer Support',
          labelVi: 'Hỗ trợ & Khiếu nại',
          icon: Headphones,
          badge: badges.openTicketsCount,
        },
        {
          moduleKey: 'safety',
          href: '/admin/operations/trust-safety',
          labelEn: 'Trust & Safety',
          labelVi: 'An toàn & Tranh chấp',
          icon: ShieldAlert,
        },
      ],
    },
    {
      groupLabelEn: 'GROWTH & CONTENT',
      groupLabelVi: 'TĂNG TRƯỞNG & NỘI DUNG',
      items: [
        {
          moduleKey: 'destinations',
          href: '/admin/growth/destinations',
          labelEn: 'Destinations',
          labelVi: 'Điểm đến & Khu vực',
          icon: Compass,
        },
        {
          moduleKey: 'discovery',
          href: '/admin/growth/discovery',
          labelEn: 'Local Discovery',
          labelVi: 'Địa điểm xung quanh',
          icon: MapPin,
        },
        {
          moduleKey: 'content',
          href: '/admin/growth/content',
          labelEn: 'Content & SEO',
          labelVi: 'Nội dung & SEO',
          icon: FileText,
        },
        {
          moduleKey: 'content',
          href: '/admin/growth/community',
          labelEn: 'Community & Events',
          labelVi: 'Cộng đồng & Sự kiện',
          icon: CalendarDays,
        },
        {
          moduleKey: 'campaigns',
          href: '/admin/growth/campaigns',
          labelEn: 'Campaigns & Funnel',
          labelVi: 'Chiến dịch & Funnel',
          icon: Megaphone,
        },
        {
          moduleKey: 'promotions',
          href: '/admin/growth/promotions',
          labelEn: 'Promotions',
          labelVi: 'Mã giảm giá & Ưu đãi',
          icon: BadgePercent,
        },
      ],
    },
    {
      groupLabelEn: 'FINANCE',
      groupLabelVi: 'TÀI CHÍNH & KẾ TOÁN',
      items: [
        {
          moduleKey: 'finance_transactions',
          href: '/admin/finance',
          labelEn: 'Transactions & Revenue',
          labelVi: 'Giao dịch & Doanh thu',
          icon: Landmark,
        },
        {
          moduleKey: 'finance_payouts',
          href: '/admin/finance/payouts',
          labelEn: 'Host Payouts',
          labelVi: 'Chi trả Chủ nhà',
          icon: Wallet,
        },
        {
          moduleKey: 'finance_refunds',
          href: '/admin/finance/refunds',
          labelEn: 'Refunds',
          labelVi: 'Hoàn tiền',
          icon: RefreshCcw,
        },
        {
          moduleKey: 'finance_reconciliation',
          href: '/admin/finance/reconciliation',
          labelEn: 'Reconciliation & Invoices',
          labelVi: 'Đối soát & Hóa đơn',
          icon: Scale,
        },
        {
          moduleKey: 'finance_reports',
          href: '/admin/finance/reports',
          labelEn: 'P&L & Financial Reports',
          labelVi: 'Báo cáo Tài chính',
          icon: FileSpreadsheet,
        },
      ],
    },
    {
      groupLabelEn: 'SYSTEM',
      groupLabelVi: 'HỆ THỐNG',
      items: [
        {
          moduleKey: 'system_team',
          href: '/admin/system/team',
          labelEn: 'Team Management',
          labelVi: 'Nhân sự nội bộ',
          icon: Users,
        },
        {
          moduleKey: 'system_roles',
          href: '/admin/system/roles',
          labelEn: 'Roles & Permissions',
          labelVi: 'Vai trò & Phân quyền',
          icon: KeyRound,
        },
        {
          moduleKey: 'system_audit',
          href: '/admin/system/audit-logs',
          labelEn: 'Audit Logs',
          labelVi: 'Nhật ký hệ thống',
          icon: Activity,
        },
        {
          moduleKey: 'system_settings',
          href: '/admin/system/settings',
          labelEn: 'System Settings',
          labelVi: 'Cài đặt nền tảng',
          icon: Settings,
        },
      ],
    },
  ];

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.assign('/');
  }

  function isItemActive(href: string) {
    if (href === '/admin') return pathname === '/admin';
    if (href === '/admin/finance') return pathname === '/admin/finance';
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <div className="min-h-screen bg-[#FAF8F3] text-[#17221E] lg:flex">
      {/* Desktop Collapsible BOS Sidebar */}
      <aside
        className={`hidden shrink-0 border-r border-[#E5DFD3] bg-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col transition-[width] duration-200 ${
          collapsed ? 'lg:w-[68px]' : 'lg:w-64'
        }`}
      >
        <div className="flex h-14 items-center justify-between border-b border-[#E5DFD3] px-3.5">
          <Link href="/admin" className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#164E3F] text-white">
              <ShieldCheck className="h-4 w-4" strokeWidth={1.75} />
            </span>
            {!collapsed && (
              <div className="min-w-0 leading-tight">
                <div className="truncate text-sm font-semibold text-[#17221E]">VietNomad BOS</div>
                <div className="truncate text-[10px] font-medium uppercase tracking-wider text-[#C25E28]">
                  {roleName}
                </div>
              </div>
            )}
          </Link>
          {!collapsed && (
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              aria-label="Collapse sidebar"
              className="rounded-md p-1 text-[#53635D] hover:bg-[#FAF8F3] hover:text-[#17221E]"
            >
              <PanelLeftClose className="h-4 w-4" strokeWidth={1.75} />
            </button>
          )}
        </div>

        <nav className="flex-1 space-y-4 overflow-y-auto px-2.5 py-3">
          {navGroups.map((group) => {
            const visibleItems = group.items.filter((it) => allowedSet.has(it.moduleKey));
            if (visibleItems.length === 0) return null;
            return (
              <div key={group.groupLabelEn}>
                {!collapsed && (
                  <div className="mb-1 px-2.5 text-[10px] font-semibold tracking-[0.08em] text-[#53635D]">
                    {isVi ? group.groupLabelVi : group.groupLabelEn}
                  </div>
                )}
                <div className="space-y-0.5">
                  {visibleItems.map((item) => {
                    const Icon = item.icon;
                    const active = isItemActive(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        title={collapsed ? (isVi ? item.labelVi : item.labelEn) : undefined}
                        className={`flex items-center justify-between rounded-md px-2.5 py-1.5 text-[13px] transition-colors ${
                          active
                            ? 'bg-[#E7F1EC] font-semibold text-[#164E3F]'
                            : 'font-medium text-[#53635D] hover:bg-[#FAF8F3] hover:text-[#17221E]'
                        }`}
                      >
                        <span className="flex min-w-0 items-center gap-2.5">
                          <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                          {!collapsed && (
                            <span className="truncate">{isVi ? item.labelVi : item.labelEn}</span>
                          )}
                        </span>
                        {!collapsed && typeof item.badge === 'number' && item.badge > 0 && (
                          <span className="ml-2 rounded bg-[#FAEDE5] px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-[#C25E28]">
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="border-t border-[#E5DFD3] p-2.5 space-y-1">
          {collapsed && (
            <button
              type="button"
              onClick={() => setCollapsed(false)}
              aria-label="Expand sidebar"
              className="flex w-full items-center justify-center rounded-md p-2 text-[#53635D] hover:bg-[#FAF8F3]"
            >
              <PanelLeftOpen className="h-4 w-4" strokeWidth={1.75} />
            </button>
          )}
          <Link
            href="/"
            className={`flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-[#53635D] hover:bg-[#FAF8F3] hover:text-[#17221E] ${
              collapsed ? 'justify-center' : ''
            }`}
          >
            <Compass className="h-4 w-4 shrink-0" strokeWidth={1.75} />
            {!collapsed && <span>{isVi ? 'Xem trang khách' : 'Guest Platform'}</span>}
          </Link>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Utility Header with Global Search */}
        <header
          ref={headerRef}
          className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-[#E5DFD3] bg-white px-4 lg:px-6"
        >
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open menu"
              className="rounded-md border border-[#E5DFD3] p-1.5 text-[#17221E] lg:hidden"
            >
              <Menu className="h-4 w-4" strokeWidth={1.75} />
            </button>

            {/* Global Search Bar */}
            <div className="relative w-full max-w-md">
              <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-[#53635D]" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onFocus={() => setSearchOpen(true)}
                onChange={(e) => {
                  const val = e.target.value;
                  setSearchQuery(val);
                  if (val.trim().length < 2) setSearchResults([]);
                  setSearchOpen(true);
                }}
                placeholder={
                  isVi
                    ? 'Tìm nhanh booking, chủ nhà, khách, chỗ ở, ticket (Ctrl+K)...'
                    : 'Search bookings, hosts, guests, listings, tickets (Ctrl+K)...'
                }
                className="h-8 w-full rounded-md border border-[#E5DFD3] bg-[#FAF8F3] pl-8 pr-3 text-xs text-[#17221E] outline-none focus:border-[#164E3F] focus:bg-white"
              />
              {searchOpen && searchQuery.trim().length >= 2 && (
                <div className="absolute left-0 right-0 top-9 z-50 max-h-80 overflow-y-auto rounded-lg border border-[#E5DFD3] bg-white p-1.5 shadow-lg">
                  {searching ? (
                    <div className="px-3 py-2 text-xs text-[#53635D]">Searching...</div>
                  ) : searchResults.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-[#53635D]">
                      No matching entities found.
                    </div>
                  ) : (
                    searchResults.map((r) => (
                      <button
                        key={`${r.type}-${r.id}`}
                        type="button"
                        onClick={() => {
                          setSearchOpen(false);
                          setSearchQuery('');
                          router.push(r.href);
                        }}
                        className="flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left hover:bg-[#FAF8F3]"
                      >
                        <div className="min-w-0 pr-3">
                          <div className="truncate text-xs font-semibold text-[#17221E]">
                            {r.title}
                          </div>
                          <div className="truncate text-[11px] text-[#53635D]">{r.subtitle}</div>
                        </div>
                        <span className="shrink-0 rounded border border-[#E5DFD3] bg-[#FAF8F3] px-1.5 py-0.5 text-[10px] font-medium text-[#53635D]">
                          {r.type}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Locale / Currency */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenMenu((m) => (m === 'locale' ? null : 'locale'))}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#E5DFD3] bg-white px-2.5 text-xs font-medium text-[#17221E] hover:bg-[#FAF8F3]"
              >
                <Globe className="h-3.5 w-3.5 text-[#53635D]" strokeWidth={1.75} />
                <span>{locale.toUpperCase()}</span>
                <span className="text-[#E5DFD3]">|</span>
                <span>{currency}</span>
              </button>

              {openMenu === 'locale' && (
                <div className="absolute right-0 top-10 z-50 w-56 rounded-lg border border-[#E5DFD3] bg-white p-3 shadow-md">
                  <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#53635D]">
                    Language
                  </div>
                  <div className="mb-3 grid grid-cols-2 gap-1.5">
                    {(['en', 'vi'] as const).map((l) => (
                      <button
                        key={l}
                        type="button"
                        onClick={() => setLocale(l)}
                        className={`rounded px-2.5 py-1 text-xs font-medium ${
                          locale === l
                            ? 'bg-[#164E3F] text-white'
                            : 'border border-[#E5DFD3] text-[#17221E] hover:bg-[#FAF8F3]'
                        }`}
                      >
                        {l === 'en' ? 'English' : 'Tiếng Việt'}
                      </button>
                    ))}
                  </div>
                  <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#53635D]">
                    Display Currency
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    {SUPPORTED_CURRENCIES.map((c) => (
                      <button
                        key={c.code}
                        type="button"
                        onClick={() => setCurrency(c.code)}
                        className={`flex items-center justify-center gap-1 rounded px-2 py-1 text-xs ${
                          currency === c.code
                            ? 'bg-[#164E3F] font-semibold text-white'
                            : 'border border-[#E5DFD3] text-[#17221E] hover:bg-[#FAF8F3]'
                        }`}
                      >
                        {currency === c.code && <Check className="h-3 w-3" />}
                        {c.code}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Staff Account Menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenMenu((m) => (m === 'account' ? null : 'account'))}
                className="flex h-8 items-center gap-2 rounded-md border border-[#E5DFD3] bg-white px-2.5 text-xs font-medium text-[#17221E] hover:bg-[#FAF8F3]"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded bg-[#164E3F] text-[10px] font-semibold text-white">
                  {user.fullName.charAt(0).toUpperCase()}
                </span>
                <span className="hidden max-w-[120px] truncate sm:inline">{user.fullName}</span>
                <ChevronDown className="h-3.5 w-3.5 text-[#53635D]" strokeWidth={1.75} />
              </button>

              {openMenu === 'account' && (
                <div className="absolute right-0 top-10 z-50 w-56 rounded-lg border border-[#E5DFD3] bg-white p-1.5 shadow-md">
                  <div className="border-b border-[#E5DFD3] px-2.5 py-2">
                    <div className="truncate text-xs font-semibold text-[#17221E]">
                      {user.fullName}
                    </div>
                    <div className="truncate text-[11px] text-[#53635D]">{user.email}</div>
                    <div className="mt-1 inline-block rounded bg-[#E7F1EC] px-1.5 py-0.5 text-[10px] font-semibold text-[#164E3F]">
                      {roleName}
                    </div>
                  </div>
                  <Link
                    href="/"
                    onClick={() => setOpenMenu(null)}
                    className="mt-1 flex items-center gap-2 rounded px-2.5 py-1.5 text-xs text-[#17221E] hover:bg-[#FAF8F3]"
                  >
                    <Compass className="h-3.5 w-3.5 text-[#53635D]" />
                    {isVi ? 'Xem trang khách' : 'Guest Platform'}
                  </Link>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-xs font-medium text-[#B42318] hover:bg-[#FDF1F0]"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    {isVi ? 'Đăng xuất' : 'Sign out'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Mobile Drawer Navigation */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 flex lg:hidden">
            <div className="flex w-72 flex-col border-r border-[#E5DFD3] bg-white">
              <div className="flex h-14 items-center justify-between border-b border-[#E5DFD3] px-4">
                <span className="text-sm font-semibold text-[#17221E]">VietNomad BOS</span>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-md p-1 text-[#53635D]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
                {navGroups.map((group) => {
                  const visibleItems = group.items.filter((it) => allowedSet.has(it.moduleKey));
                  if (visibleItems.length === 0) return null;
                  return (
                    <div key={group.groupLabelEn}>
                      <div className="mb-1 px-2 text-[10px] font-semibold tracking-wider text-[#53635D]">
                        {isVi ? group.groupLabelVi : group.groupLabelEn}
                      </div>
                      <div className="space-y-0.5">
                        {visibleItems.map((item) => {
                          const Icon = item.icon;
                          const active = isItemActive(item.href);
                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              onClick={() => setMobileMenuOpen(false)}
                              className={`flex items-center justify-between rounded-md px-2.5 py-2 text-xs font-medium ${
                                active
                                  ? 'bg-[#E7F1EC] font-semibold text-[#164E3F]'
                                  : 'text-[#53635D] hover:bg-[#FAF8F3]'
                              }`}
                            >
                              <span className="flex items-center gap-2.5">
                                <Icon className="h-4 w-4" strokeWidth={1.75} />
                                {isVi ? item.labelVi : item.labelEn}
                              </span>
                              {typeof item.badge === 'number' && item.badge > 0 && (
                                <span className="rounded bg-[#FAEDE5] px-1.5 py-0.5 text-[10px] font-semibold text-[#C25E28]">
                                  {item.badge}
                                </span>
                              )}
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </nav>
            </div>
            <div
              className="flex-1 bg-[#17221E]/35"
              onClick={() => setMobileMenuOpen(false)}
            />
          </div>
        )}

        <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-5 lg:px-7">
          {children}
        </main>
      </div>
    </div>
  );
}
