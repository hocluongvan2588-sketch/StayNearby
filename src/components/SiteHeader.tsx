'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import {
  Building2,
  Check,
  ChevronDown,
  Compass,
  Globe,
  LogOut,
  MapPin,
  Menu,
  ShieldCheck,
  Sparkles,
  User,
  X,
} from 'lucide-react';
import type { SessionUser } from '@/lib/auth/session';
import { SUPPORTED_CURRENCIES, type CurrencyCode } from '@/lib/i18n';
import type { DestinationSummary, LifestyleItem } from '@/modules/catalog';
import { usePreferences } from './PreferencesProvider';

export function SiteHeader({
  user,
  destinations,
  lifestyles,
}: {
  user: SessionUser | null;
  destinations: DestinationSummary[];
  lifestyles: LifestyleItem[];
}) {
  const {
    locale,
    currency,
    setLocale,
    setCurrency,
    premiumRewardPct,
    hostCommissionPct,
  } = usePreferences();
  const [openMenu, setOpenMenu] = useState<'explore' | 'locale' | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isVi = locale === 'vi';

  function openHoverMenu(menu: 'explore' | 'locale') {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setOpenMenu(menu);
  }

  function scheduleCloseMenu() {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => {
      setOpenMenu(null);
      closeTimerRef.current = null;
    }, 120);
  }

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpenMenu(null);
        setMobileOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleKey);
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.assign('/');
  }

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-40 border-b border-[#E5DFD3] bg-[#FAF8F3]/95 backdrop-blur-md"
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        {/* Brand */}
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2.5 text-[#17221E] transition hover:opacity-85"
          onClick={() => setOpenMenu(null)}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#164E3F] text-[#FAF8F3] shadow-sm">
            <svg viewBox="0 0 28 28" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9">
              <path d="M4 18.5L14 7l10 11.5H4z" strokeLinejoin="round" />
              <path d="M10.5 21.5a5 5 0 017 0" strokeLinecap="round" />
            </svg>
          </span>
          <div className="leading-tight whitespace-nowrap">
            <span className="font-serif-display block text-lg font-semibold tracking-tight text-[#164E3F]">
              VietNomad
            </span>
            <span className="block text-[9px] font-semibold uppercase tracking-[0.18em] text-[#A67C2E]">
              Vietnam Stays
            </span>
          </div>
        </Link>

        {/* Primary Desktop Navigation */}
        <nav className="hidden shrink-0 items-center gap-0.5 lg:flex xl:gap-1">
          <div
            className="relative"
            onMouseEnter={() => openHoverMenu('explore')}
            onMouseLeave={scheduleCloseMenu}
          >
            <button
              type="button"
              onClick={() => setOpenMenu(openMenu === 'explore' ? null : 'explore')}
              aria-expanded={openMenu === 'explore'}
              className={`flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#164E3F]/30 xl:px-3.5 ${
                openMenu === 'explore'
                  ? 'bg-[#EFECE4] text-[#164E3F]'
                  : 'text-[#17221E] hover:bg-[#EFECE4]/70'
              }`}
            >
              {isVi ? 'Khám phá' : 'Explore'}
              <ChevronDown
                className={`h-3.5 w-3.5 text-[#53635D] transition-transform duration-150 ${
                  openMenu === 'explore' ? 'rotate-180' : ''
                }`}
              />
            </button>

            {openMenu === 'explore' && (
              <div className="absolute left-0 top-full w-[600px] pt-2.5">
                <div className="grid grid-cols-12 gap-5 rounded-2xl border border-[#E5DFD3] bg-white p-5 shadow-2xl">
                  <div className="col-span-6 space-y-2 border-r border-[#E5DFD3] pr-4">
                    <div className="px-2 text-[11px] font-semibold uppercase tracking-wider text-[#53635D]">
                      {isVi ? 'Thành phố nổi bật' : 'Top cities'}
                    </div>
                    <div className="space-y-1">
                      {destinations.map((d) => (
                        <Link
                          key={d.id}
                          href={`/destinations/${d.slug}`}
                          onClick={() => setOpenMenu(null)}
                          className="flex items-center justify-between rounded-xl px-2.5 py-2 text-sm transition hover:bg-[#FAF8F3]"
                        >
                          <span className="flex items-center gap-2 font-medium text-[#17221E]">
                            <MapPin className="h-3.5 w-3.5 text-[#C25E28]" />
                            {isVi ? d.nameVi : d.nameEn}
                          </span>
                          <span className="text-xs text-[#53635D]">
                            {d.avgWifiMbps} Mbps
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>

                  <div className="col-span-6 space-y-2">
                    <div className="px-2 text-[11px] font-semibold uppercase tracking-wider text-[#53635D]">
                      {isVi ? 'Phong cách ở' : 'Lifestyles'}
                    </div>
                    <div className="grid grid-cols-1 gap-1">
                      {lifestyles.map((l) => (
                        <Link
                          key={l.id}
                          href={`/lifestyles/${l.slug}`}
                          onClick={() => setOpenMenu(null)}
                          className="rounded-xl px-2.5 py-1.5 text-sm transition hover:bg-[#FAF8F3]"
                        >
                          <div className="font-medium text-[#164E3F]">
                            {isVi ? l.nameVi : l.nameEn}
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <Link
            href="/stays"
            onClick={() => setOpenMenu(null)}
            className="whitespace-nowrap rounded-full px-2.5 py-2 text-sm font-medium text-[#17221E] transition hover:bg-[#EFECE4]/70 xl:px-3.5"
          >
            {isVi ? 'Chỗ ở' : 'Stays'}
          </Link>

          <Link
            href="/deals"
            onClick={() => setOpenMenu(null)}
            className="whitespace-nowrap rounded-full px-2.5 py-2 text-sm font-medium text-[#C25E28] transition hover:bg-[#FAEDE5] xl:px-3.5"
          >
            {isVi ? 'Ưu đãi' : 'Deals'}
          </Link>

          <Link
            href="/community"
            onClick={() => setOpenMenu(null)}
            className="whitespace-nowrap rounded-full px-2.5 py-2 text-sm font-medium text-[#17221E] transition hover:bg-[#EFECE4]/70 xl:px-3.5"
          >
            {isVi ? 'Cộng đồng' : 'Community'}
          </Link>

          <Link
            href="/membership"
            onClick={() => setOpenMenu(null)}
            className="flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-2 text-sm font-medium text-[#A67C2E] transition hover:bg-[#EFECE4]/70 xl:px-3.5"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {isVi ? 'Hội viên' : 'Membership'}
          </Link>
        </nav>

        {/* Right Utility & Account Cluster */}
        <div className="hidden shrink-0 items-center gap-2 lg:flex">
          <Link
            href="/list-your-stay"
            onClick={() => setOpenMenu(null)}
            className="whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-semibold text-[#164E3F] transition hover:bg-[#E7F1EC]"
          >
            {isVi ? 'Cho thuê nhà' : 'List a property'}
          </Link>

          {/* Compact Language + Currency Popover */}
          <div
            className="relative"
            onMouseEnter={() => openHoverMenu('locale')}
            onMouseLeave={scheduleCloseMenu}
          >
            <button
              type="button"
              onClick={() => setOpenMenu(openMenu === 'locale' ? null : 'locale')}
              aria-expanded={openMenu === 'locale'}
              aria-label={isVi ? 'Ngôn ngữ và tiền tệ' : 'Language and currency'}
              className="flex items-center gap-1.5 whitespace-nowrap rounded-full border border-[#E5DFD3] bg-white px-3 py-1.5 text-xs font-semibold text-[#17221E] transition hover:border-[#164E3F]/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#164E3F]/30"
            >
              <Globe className="h-3.5 w-3.5 text-[#164E3F]" />
              <span>{locale.toUpperCase()}</span>
              <span className="text-[#D4CEC2]">|</span>
              <span>{currency}</span>
              <ChevronDown
                className={`h-3 w-3 text-[#53635D] transition-transform duration-150 ${
                  openMenu === 'locale' ? 'rotate-180' : ''
                }`}
              />
            </button>

            {openMenu === 'locale' && (
              <div className="absolute right-0 top-full w-72 pt-2.5">
                <div className="space-y-4 rounded-2xl border border-[#E5DFD3] bg-white p-4 shadow-2xl">
                  <div>
                    <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#53635D]">
                      {isVi ? 'Ngôn ngữ' : 'Language'}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setLocale('en');
                          setOpenMenu(null);
                        }}
                        className={`flex items-center justify-between rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                          locale === 'en'
                            ? 'border-[#164E3F] bg-[#E7F1EC] text-[#164E3F]'
                            : 'border-[#E5DFD3] text-[#17221E] hover:bg-[#FAF8F3]'
                        }`}
                      >
                        <span>English</span>
                        {locale === 'en' && <Check className="h-3.5 w-3.5" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setLocale('vi');
                          setOpenMenu(null);
                        }}
                        className={`flex items-center justify-between rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                          locale === 'vi'
                            ? 'border-[#164E3F] bg-[#E7F1EC] text-[#164E3F]'
                            : 'border-[#E5DFD3] text-[#17221E] hover:bg-[#FAF8F3]'
                        }`}
                      >
                        <span>Tiếng Việt</span>
                        {locale === 'vi' && <Check className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#53635D]">
                      {isVi ? 'Tiền tệ hiển thị' : 'Currency'}
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {SUPPORTED_CURRENCIES.map((c) => (
                        <button
                          key={c.code}
                          type="button"
                          onClick={() => {
                            setCurrency(c.code as CurrencyCode);
                            setOpenMenu(null);
                          }}
                          className={`rounded-lg border px-2 py-1.5 text-center text-xs font-semibold transition ${
                            currency === c.code
                              ? 'border-[#164E3F] bg-[#164E3F] text-white'
                              : 'border-[#E5DFD3] text-[#17221E] hover:bg-[#FAF8F3]'
                          }`}
                        >
                          {c.code} {c.symbol}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {user ? (
            <div className="flex items-center gap-1.5">
              {user.role === 'host' && (
                <Link
                  href="/host"
                  className="flex items-center gap-1 whitespace-nowrap rounded-full bg-[#E7F1EC] px-3 py-1.5 text-xs font-semibold text-[#164E3F] hover:bg-[#d7eae0]"
                >
                  <Building2 className="h-3.5 w-3.5" />
                  {isVi ? 'Kênh chủ nhà' : 'Host Console'}
                </Link>
              )}
              {user.role === 'admin' && (
                <Link
                  href="/admin"
                  className="flex items-center gap-1 whitespace-nowrap rounded-full bg-[#FAEDE5] px-3 py-1.5 text-xs font-semibold text-[#C25E28] hover:bg-[#f4dfd3]"
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {isVi ? 'Quản trị' : 'Admin'}
                </Link>
              )}
              <Link
                href="/dashboard"
                className="flex items-center gap-1.5 whitespace-nowrap rounded-full bg-[#164E3F] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#0F392E]"
              >
                <User className="h-3.5 w-3.5" />
                {user.fullName.split(' ')[0]}
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                title={isVi ? 'Đăng xuất' : 'Sign out'}
                className="rounded-full border border-[#E5DFD3] bg-white p-1.5 text-[#53635D] hover:text-[#C25E28]"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <Link
                href="/login"
                className="whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium text-[#17221E] transition hover:bg-[#EFECE4]"
              >
                {isVi ? 'Đăng nhập' : 'Log in'}
              </Link>
              <Link
                href="/register"
                className="whitespace-nowrap rounded-full bg-[#164E3F] px-4 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0F392E]"
              >
                {isVi ? 'Đăng ký' : 'Sign up'}
              </Link>
            </div>
          )}
        </div>

        {/* Mobile Toggle */}
        <button
          type="button"
          onClick={() => setMobileOpen(!mobileOpen)}
          className="rounded-xl border border-[#E5DFD3] bg-white p-2 text-[#17221E] lg:hidden"
          aria-label="Toggle Menu"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="border-t border-[#E5DFD3] bg-white px-4 py-4 lg:hidden">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center rounded-lg border border-[#E5DFD3] p-0.5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setLocale('en')}
                className={`rounded-md px-2.5 py-1 ${locale === 'en' ? 'bg-[#164E3F] text-white' : ''}`}
              >
                English
              </button>
              <button
                type="button"
                onClick={() => setLocale('vi')}
                className={`rounded-md px-2.5 py-1 ${locale === 'vi' ? 'bg-[#164E3F] text-white' : ''}`}
              >
                Tiếng Việt
              </button>
            </div>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
              className="rounded-lg border border-[#E5DFD3] px-2.5 py-1.5 text-xs font-semibold"
            >
              {SUPPORTED_CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} {c.symbol}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-1 text-sm font-medium">
            <Link href="/stays" onClick={() => setMobileOpen(false)} className="rounded-lg px-3 py-2 hover:bg-[#FAF8F3]">
              <Compass className="mr-2 inline h-4 w-4 text-[#164E3F]" />
              {isVi ? 'Tìm chỗ ở' : 'Browse stays'}
            </Link>
            <Link href="/deals" onClick={() => setMobileOpen(false)} className="rounded-lg px-3 py-2 text-[#C25E28] hover:bg-[#FAEDE5]">
              {isVi ? 'Ưu đãi theo tháng' : 'Monthly deals'}
            </Link>
            <Link href="/guides" onClick={() => setMobileOpen(false)} className="rounded-lg px-3 py-2 hover:bg-[#FAF8F3]">
              {isVi ? 'Cẩm nang địa phương' : 'Guides'}
            </Link>
            <Link href="/community" onClick={() => setMobileOpen(false)} className="rounded-lg px-3 py-2 hover:bg-[#FAF8F3]">
              {isVi ? 'Visa & Cộng đồng' : 'Visa & Community'}
            </Link>
            <Link href="/membership" onClick={() => setMobileOpen(false)} className="rounded-lg px-3 py-2 text-[#A67C2E] hover:bg-[#FAF8F3]">
              {isVi ? `Thẻ hội viên (Hoàn ${premiumRewardPct}%)` : `Membership (${premiumRewardPct}% credit)`}
            </Link>
            <Link href="/list-your-stay" onClick={() => setMobileOpen(false)} className="rounded-lg px-3 py-2 font-semibold text-[#164E3F] hover:bg-[#E7F1EC]">
              {isVi ? `Cho thuê nhà (${hostCommissionPct}% hoa hồng)` : `List a property (${hostCommissionPct}% commission)`}
            </Link>
            <div className="my-2 border-t border-[#E5DFD3]" />
            {user ? (
              <>
                <Link href="/dashboard" onClick={() => setMobileOpen(false)} className="rounded-lg bg-[#164E3F] px-3 py-2 text-center font-semibold text-white">
                  {user.fullName} ({isVi ? 'Tài khoản' : 'Dashboard'})
                </Link>
                {user.role === 'host' && (
                  <Link href="/host" onClick={() => setMobileOpen(false)} className="rounded-lg bg-[#E7F1EC] px-3 py-2 text-center font-semibold text-[#164E3F]">
                    {isVi ? 'Kênh chủ nhà' : 'Host Console'}
                  </Link>
                )}
                {user.role === 'admin' && (
                  <Link href="/admin" onClick={() => setMobileOpen(false)} className="rounded-lg bg-[#FAEDE5] px-3 py-2 text-center font-semibold text-[#C25E28]">
                    {isVi ? 'Quản trị' : 'Admin'}
                  </Link>
                )}
                <button type="button" onClick={handleLogout} className="rounded-lg px-3 py-2 text-left text-[#C25E28]">
                  {isVi ? 'Đăng xuất' : 'Sign out'}
                </button>
              </>
            ) : (
              <div className="flex gap-2">
                <Link href="/login" onClick={() => setMobileOpen(false)} className="flex-1 rounded-lg border border-[#E5DFD3] px-3 py-2 text-center">
                  {isVi ? 'Đăng nhập' : 'Log in'}
                </Link>
                <Link href="/register" onClick={() => setMobileOpen(false)} className="flex-1 rounded-lg bg-[#164E3F] px-3 py-2 text-center text-white">
                  {isVi ? 'Đăng ký' : 'Sign up'}
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
