'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { LogOut, Menu, User, X } from 'lucide-react';
import type { SessionUser } from '@/lib/auth/session';
import { getUserMessages } from '@/lib/i18n/messages';
import { useUserPreferences } from '@/components/i18n/UserPreferencesProvider';
import { LanguageCurrencySwitcher } from '@/components/i18n/LanguageCurrencySwitcher';

interface SiteHeaderProps {
  brandName: string;
  demoMode: boolean;
  user: SessionUser | null;
}

export function SiteHeader({ brandName, demoMode, user }: SiteHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { preferences } = useUserPreferences();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  // Host, Admin & CRM portals stay strictly in Vietnamese + VND
  const isPortalRoute =
    pathname.startsWith('/host') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/crm');
  const activeLocale = isPortalRoute ? 'vi' : preferences.locale;
  const t = getUserMessages(activeLocale);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setMobileOpen(false);
      router.push('/');
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <header className="bg-[var(--color-surface)] border-b border-[var(--color-hairline)]">
      <div className="container-stay flex items-center justify-between min-h-[68px] gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Link
            href="/"
            className="inline-flex items-center min-h-[44px] text-[20px] font-semibold tracking-[-0.03em] text-[var(--color-text)] whitespace-nowrap"
          >
            <span className="text-[var(--color-primary)]">{brandName}</span>
          </Link>
          {demoMode && (
            <span className="hidden sm:inline-flex items-center px-2.5 py-0.5 text-[11px] font-medium rounded-full bg-[var(--color-surface-ivory)] text-[var(--color-text-muted)] border border-[var(--color-border)] whitespace-nowrap">
              {t.nav.demoBadge}
            </span>
          )}
        </div>

        {/* Desktop navigation */}
        <nav
          aria-label="Primary navigation"
          className="hidden lg:flex items-center gap-0.5"
        >
          <Link
            href="/stays"
            className={`inline-flex items-center min-h-[44px] px-3 rounded-[12px] text-[14px] font-medium whitespace-nowrap transition-colors ${
              pathname.startsWith('/stays')
                ? 'text-[var(--color-primary)] bg-[var(--color-primary-soft)]'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            {t.nav.exploreStays}
          </Link>

          <Link
            href="/explore"
            className={`inline-flex items-center min-h-[44px] px-3 rounded-[12px] text-[14px] font-medium whitespace-nowrap transition-colors ${
              pathname.startsWith('/explore')
                ? 'text-[var(--color-primary)] bg-[var(--color-primary-soft)]'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            {t.nav.localGuides}
          </Link>

          <Link
            href={user ? '/trips' : '/customer'}
            className={`inline-flex items-center min-h-[44px] px-3 rounded-[12px] text-[14px] font-medium whitespace-nowrap transition-colors ${
              pathname.startsWith('/customer') || pathname.startsWith('/trips')
                ? 'text-[var(--color-primary)] bg-[var(--color-primary-soft)]'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            {user ? t.nav.trips : t.nav.customerPortal}
          </Link>

          {user && (
            <Link
              href="/customer"
              className={`inline-flex items-center min-h-[44px] px-3 rounded-[12px] text-[14px] font-medium whitespace-nowrap transition-colors ${
                pathname.startsWith('/customer')
                  ? 'text-[var(--color-primary)] bg-[var(--color-primary-soft)]'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
              }`}
            >
              {t.nav.customerPortal}
            </Link>
          )}

          <Link
            href="/host"
            className={`inline-flex items-center min-h-[44px] px-3 rounded-[12px] text-[14px] font-medium whitespace-nowrap transition-colors ${
              pathname.startsWith('/host')
                ? 'text-[var(--color-primary)] bg-[var(--color-primary-soft)]'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            {t.nav.hostPortal}
          </Link>

          <Link
            href="/admin/crm"
            className={`inline-flex items-center min-h-[44px] px-3 rounded-[12px] text-[14px] font-medium whitespace-nowrap transition-colors ${
              pathname.startsWith('/admin') || pathname.startsWith('/crm')
                ? 'text-[var(--color-primary)] bg-[var(--color-primary-soft)]'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            {t.nav.crmPortal}
          </Link>

          {!isPortalRoute && (
            <div className="pl-1">
              <LanguageCurrencySwitcher />
            </div>
          )}

          {user ? (
            <div className="flex items-center gap-2 pl-2.5 ml-1.5 border-l border-[var(--color-hairline)]">
              <span className="inline-flex items-center gap-1.5 px-1.5 py-1.5 text-sm text-[var(--color-text-muted)]">
                <User className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span className="max-w-[120px] truncate font-medium text-[var(--color-text)]">
                  {user.displayName}
                </span>
              </span>
              <button
                type="button"
                onClick={handleSignOut}
                disabled={signingOut}
                className="inline-flex items-center gap-1.5 min-h-[44px] px-3 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] text-[13px] font-medium text-[var(--color-text)] hover:bg-[var(--color-surface-muted)] disabled:opacity-60 whitespace-nowrap"
              >
                <LogOut className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{signingOut ? t.nav.signingOut : t.nav.signOut}</span>
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="ml-1.5 inline-flex items-center min-h-[44px] px-4 rounded-[12px] bg-[var(--color-primary)] text-white text-[14px] font-medium hover:bg-[var(--color-primary-hover)] transition-colors whitespace-nowrap"
            >
              {t.nav.signIn}
            </Link>
          )}
        </nav>

        {/* Mobile / Tablet menu trigger */}
        <button
          type="button"
          onClick={() => setMobileOpen((prev) => !prev)}
          aria-expanded={mobileOpen}
          aria-label={mobileOpen ? t.nav.closeMenu : t.nav.openMenu}
          className="lg:hidden inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)]"
        >
          {mobileOpen ? (
            <X className="w-6 h-6" aria-hidden="true" />
          ) : (
            <Menu className="w-6 h-6" aria-hidden="true" />
          )}
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="lg:hidden border-t border-[var(--color-hairline)] bg-[var(--color-surface)]">
          <nav
            aria-label="Mobile navigation"
            className="container-stay py-3 flex flex-col gap-1"
          >
            <Link
              href="/stays"
              onClick={() => setMobileOpen(false)}
              className="inline-flex items-center min-h-[44px] px-3 rounded-[12px] text-[15px] font-medium text-[var(--color-text)] hover:bg-[var(--color-surface-muted)]"
            >
              {t.nav.exploreStays}
            </Link>
            <Link
              href="/explore"
              onClick={() => setMobileOpen(false)}
              className="inline-flex items-center min-h-[44px] px-3 rounded-[12px] text-[15px] font-medium text-[var(--color-text)] hover:bg-[var(--color-surface-muted)]"
            >
              {t.nav.localGuides}
            </Link>
            <Link
              href="/customer"
              onClick={() => setMobileOpen(false)}
              className="inline-flex items-center min-h-[44px] px-3 rounded-[12px] text-[15px] font-medium text-[var(--color-text)] hover:bg-[var(--color-surface-muted)]"
            >
              {t.nav.customerPortal}
            </Link>
            {user && (
              <Link
                href="/trips"
                onClick={() => setMobileOpen(false)}
                className="inline-flex items-center min-h-[44px] px-3 rounded-[12px] text-[15px] font-medium text-[var(--color-text)] hover:bg-[var(--color-surface-muted)]"
              >
                {t.nav.trips}
              </Link>
            )}
            <Link
              href="/host"
              onClick={() => setMobileOpen(false)}
              className="inline-flex items-center min-h-[44px] px-3 rounded-[12px] text-[15px] font-medium text-[var(--color-text)] hover:bg-[var(--color-surface-muted)]"
            >
              {t.nav.hostPortal}
            </Link>
            <Link
              href="/admin/crm"
              onClick={() => setMobileOpen(false)}
              className="inline-flex items-center min-h-[44px] px-3 rounded-[12px] text-[15px] font-medium text-[var(--color-text)] hover:bg-[var(--color-surface-muted)]"
            >
              {t.nav.crmPortal}
            </Link>

            {!isPortalRoute && (
              <div className="pt-2 mt-1">
                <LanguageCurrencySwitcher compact />
              </div>
            )}

            {user ? (
              <div className="pt-2 mt-2 border-t border-[var(--color-hairline)] flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-[var(--color-text)] truncate">
                  {user.displayName}
                </span>
                <button
                  type="button"
                  onClick={handleSignOut}
                  disabled={signingOut}
                  className="inline-flex items-center gap-1.5 min-h-[44px] px-4 rounded-[12px] border border-[var(--color-border)] text-sm font-medium text-[var(--color-text)]"
                >
                  <LogOut className="w-5 h-5" aria-hidden="true" />
                  <span>{t.nav.signOut}</span>
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                onClick={() => setMobileOpen(false)}
                className="mt-2 inline-flex items-center justify-center min-h-[44px] px-4 rounded-[12px] bg-[var(--color-primary)] text-white text-[15px] font-medium"
              >
                {t.nav.signIn}
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
