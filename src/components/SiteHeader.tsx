'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  ChevronDown,
  Compass,
  Globe,
  Menu,
  Sparkles,
  User,
  X,
  LogOut,
  Building2,
  ShieldCheck,
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
  const { locale, currency, setLocale, setCurrency } = usePreferences();
  const [openMenu, setOpenMenu] = useState<'lifestyles' | 'destinations' | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  const isVi = locale === 'vi';

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.assign('/');
  }

  return (
    <header className="sticky top-0 z-40 border-b border-[#E5DFD3] bg-[#FAF8F3]/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        {/* Brand Logo with Contemporary Vietnamese Conical Hat + Wi-Fi Wave Emblem */}
        <Link
          href="/"
          className="flex items-center gap-2.5 text-[#17221E] transition hover:opacity-85"
          onClick={() => setOpenMenu(null)}
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#164E3F] text-[#FAF8F3] shadow-sm">
            <svg viewBox="0 0 28 28" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9">
              <path d="M4 18.5L14 7l10 11.5H4z" strokeLinejoin="round" />
              <path d="M10.5 21.5a5 5 0 017 0" strokeLinecap="round" />
            </svg>
          </span>
          <div className="leading-tight">
            <span className="font-serif-display block text-lg font-semibold tracking-tight text-[#164E3F]">
              VietNomad
            </span>
            <span className="block text-[10px] font-medium uppercase tracking-[0.18em] text-[#A67C2E]">
              Vietnam Stays
            </span>
          </div>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden items-center gap-1 lg:flex">
          <div className="relative">
            <button
              type="button"
              onClick={() => setOpenMenu(openMenu === 'lifestyles' ? null : 'lifestyles')}
              className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-[#17221E] hover:bg-[#F2EDE3]"
            >
              {isVi ? 'Lối sống' : 'Lifestyles'}
              <ChevronDown className="h-3.5 w-3.5 text-[#53635D]" />
            </button>
            {openMenu === 'lifestyles' && (
              <div
                onMouseLeave={() => setOpenMenu(null)}
                className="absolute left-0 top-full mt-2 grid w-[440px] grid-cols-2 gap-1.5 rounded-2xl border border-[#E5DFD3] bg-white p-3 shadow-xl"
              >
                {lifestyles.map((l) => (
                  <Link
                    key={l.id}
                    href={`/lifestyles/${l.slug}`}
                    onClick={() => setOpenMenu(null)}
                    className="rounded-xl px-3 py-2 text-sm hover:bg-[#FAF8F3]"
                  >
                    <div className="font-medium text-[#164E3F]">
                      {isVi ? l.nameVi : l.nameEn}
                    </div>
                    <div className="line-clamp-1 text-xs text-[#53635D]">
                      {isVi ? l.descriptionVi : l.descriptionEn}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setOpenMenu(openMenu === 'destinations' ? null : 'destinations')}
              className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-[#17221E] hover:bg-[#F2EDE3]"
            >
              {isVi ? 'Điểm đến VN' : 'Destinations'}
              <ChevronDown className="h-3.5 w-3.5 text-[#53635D]" />
            </button>
            {openMenu === 'destinations' && (
              <div
                onMouseLeave={() => setOpenMenu(null)}
                className="absolute left-0 top-full mt-2 grid w-[420px] grid-cols-2 gap-1.5 rounded-2xl border border-[#E5DFD3] bg-white p-3 shadow-xl"
              >
                {destinations.map((d) => (
                  <Link
                    key={d.id}
                    href={`/destinations/${d.slug}`}
                    onClick={() => setOpenMenu(null)}
                    className="flex items-center justify-between rounded-xl px-3 py-2 text-sm hover:bg-[#FAF8F3]"
                  >
                    <div>
                      <div className="font-medium text-[#164E3F]">
                        {isVi ? d.nameVi : d.nameEn}
                      </div>
                      <div className="text-xs text-[#53635D]">
                        ~{d.avgWifiMbps} Mbps · {d.liveStaysCount} {isVi ? 'căn' : 'stays'}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <Link
            href="/stays"
            className="rounded-lg px-3 py-2 text-sm font-medium text-[#17221E] hover:bg-[#F2EDE3]"
          >
            {isVi ? 'Tìm chỗ ở' : 'Find Stays'}
          </Link>

          <Link
            href="/deals"
            className="rounded-lg px-3 py-2 text-sm font-medium text-[#C25E28] hover:bg-[#FAEDE5]"
          >
            {isVi ? 'Ưu đãi tháng' : 'Deals'}
          </Link>

          <Link
            href="/community"
            className="rounded-lg px-3 py-2 text-sm font-medium text-[#17221E] hover:bg-[#F2EDE3]"
          >
            {isVi ? 'Visa & Cộng đồng' : 'Visa & Community'}
          </Link>

          <Link
            href="/membership"
            className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-[#A67C2E] hover:bg-[#F2EDE3]"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {isVi ? 'Nomad Pass' : 'Nomad Pass'}
          </Link>

          <Link
            href="/list-your-stay"
            className="rounded-lg border border-[#164E3F]/25 px-3 py-1.5 text-sm font-semibold text-[#164E3F] hover:bg-[#E7F1EC]"
          >
            {isVi ? 'Đăng chỗ ở +' : 'List Your Stay+'}
          </Link>
        </nav>

        {/* Right Controls: Locale + Currency + Auth */}
        <div className="hidden items-center gap-2 lg:flex">
          {/* Bilingual Switcher */}
          <div className="flex items-center rounded-lg border border-[#E5DFD3] bg-white p-0.5 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setLocale('en')}
              className={`rounded-md px-2 py-1 transition ${
                locale === 'en' ? 'bg-[#164E3F] text-white' : 'text-[#53635D] hover:text-[#17221E]'
              }`}
              aria-label="Switch to English"
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => setLocale('vi')}
              className={`rounded-md px-2 py-1 transition ${
                locale === 'vi' ? 'bg-[#164E3F] text-white' : 'text-[#53635D] hover:text-[#17221E]'
              }`}
              aria-label="Chuyển sang Tiếng Việt"
            >
              VI
            </button>
          </div>

          {/* Currency Selector */}
          <label className="flex items-center gap-1 rounded-lg border border-[#E5DFD3] bg-white px-2 py-1 text-xs font-medium text-[#17221E]">
            <Globe className="h-3.5 w-3.5 text-[#53635D]" />
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
              className="bg-transparent font-semibold outline-none"
              aria-label={isVi ? 'Chọn tiền tệ' : 'Currency'}
            >
              {SUPPORTED_CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} {c.symbol}
                </option>
              ))}
            </select>
          </label>

          {user ? (
            <div className="flex items-center gap-1.5">
              {user.role === 'host' && (
                <Link
                  href="/host"
                  className="flex items-center gap-1 rounded-lg bg-[#E7F1EC] px-2.5 py-1.5 text-xs font-semibold text-[#164E3F] hover:bg-[#d7eae0]"
                >
                  <Building2 className="h-3.5 w-3.5" />
                  {isVi ? 'Cổng Chủ nhà' : 'Host Console'}
                </Link>
              )}
              {user.role === 'admin' && (
                <Link
                  href="/admin"
                  className="flex items-center gap-1 rounded-lg bg-[#FAEDE5] px-2.5 py-1.5 text-xs font-semibold text-[#C25E28] hover:bg-[#f4dfd3]"
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Admin
                </Link>
              )}
              <Link
                href="/dashboard"
                className="flex items-center gap-1.5 rounded-lg bg-[#164E3F] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0F392E]"
              >
                <User className="h-3.5 w-3.5" />
                {user.fullName.split(' ')[0]}
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                title={isVi ? 'Đăng xuất' : 'Sign out'}
                className="rounded-lg border border-[#E5DFD3] bg-white p-1.5 text-[#53635D] hover:text-[#C25E28]"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-[#17221E] hover:bg-[#F2EDE3]"
              >
                {isVi ? 'Đăng nhập' : 'Log In'}
              </Link>
              <Link
                href="/register"
                className="rounded-lg bg-[#164E3F] px-3.5 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-[#0F392E]"
              >
                {isVi ? 'Tham gia' : 'Join Free'}
              </Link>
            </div>
          )}
        </div>

        {/* Mobile Menu Button */}
        <button
          type="button"
          onClick={() => setMobileOpen(!mobileOpen)}
          className="rounded-lg border border-[#E5DFD3] bg-white p-2 text-[#17221E] lg:hidden"
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
              {isVi ? 'Tìm chỗ ở dài ngày' : 'Find Extended Stays'}
            </Link>
            <Link href="/deals" onClick={() => setMobileOpen(false)} className="rounded-lg px-3 py-2 text-[#C25E28] hover:bg-[#FAEDE5]">
              {isVi ? 'Ưu đãi theo tháng' : 'Monthly Deals'}
            </Link>
            <Link href="/community" onClick={() => setMobileOpen(false)} className="rounded-lg px-3 py-2 hover:bg-[#FAF8F3]">
              {isVi ? 'Visa Việt Nam & Cộng đồng' : 'Vietnam Visa & Community'}
            </Link>
            <Link href="/membership" onClick={() => setMobileOpen(false)} className="rounded-lg px-3 py-2 text-[#A67C2E] hover:bg-[#FAF8F3]">
              {isVi ? 'Nomad Pass (Hoàn 4%)' : 'Nomad Pass (4% Credit)'}
            </Link>
            <Link href="/list-your-stay" onClick={() => setMobileOpen(false)} className="rounded-lg px-3 py-2 font-semibold text-[#164E3F] hover:bg-[#E7F1EC]">
              {isVi ? 'Đăng chỗ ở (0% hoa hồng)' : 'List Your Stay+'}
            </Link>
            <div className="my-2 border-t border-[#E5DFD3]" />
            {user ? (
              <>
                <Link href="/dashboard" onClick={() => setMobileOpen(false)} className="rounded-lg bg-[#164E3F] px-3 py-2 text-center font-semibold text-white">
                  {user.fullName} · {isVi ? 'Bảng điều khiển' : 'Dashboard'}
                </Link>
                {user.role === 'host' && (
                  <Link href="/host" onClick={() => setMobileOpen(false)} className="rounded-lg bg-[#E7F1EC] px-3 py-2 text-center font-semibold text-[#164E3F]">
                    {isVi ? 'Quản lý chỗ ở (Host)' : 'Host Console'}
                  </Link>
                )}
                {user.role === 'admin' && (
                  <Link href="/admin" onClick={() => setMobileOpen(false)} className="rounded-lg bg-[#FAEDE5] px-3 py-2 text-center font-semibold text-[#C25E28]">
                    Admin Operations
                  </Link>
                )}
                <button type="button" onClick={handleLogout} className="rounded-lg px-3 py-2 text-left text-[#C25E28]">
                  {isVi ? 'Đăng xuất' : 'Sign Out'}
                </button>
              </>
            ) : (
              <div className="flex gap-2">
                <Link href="/login" onClick={() => setMobileOpen(false)} className="flex-1 rounded-lg border border-[#E5DFD3] px-3 py-2 text-center">
                  {isVi ? 'Đăng nhập' : 'Log In'}
                </Link>
                <Link href="/register" onClick={() => setMobileOpen(false)} className="flex-1 rounded-lg bg-[#164E3F] px-3 py-2 text-center text-white">
                  {isVi ? 'Tham gia' : 'Join Free'}
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
