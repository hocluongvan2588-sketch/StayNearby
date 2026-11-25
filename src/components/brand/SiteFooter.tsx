'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getExchangeRateNote } from '@/lib/i18n/currency';
import { getUserMessages } from '@/lib/i18n/messages';
import { useUserPreferences } from '@/components/i18n/UserPreferencesProvider';

interface SiteFooterProps {
  brandName: string;
  demoMode: boolean;
}

export function SiteFooter({ brandName, demoMode }: SiteFooterProps) {
  const pathname = usePathname();
  const { preferences } = useUserPreferences();

  const isPortalRoute =
    pathname.startsWith('/host') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/crm');
  const activeLocale = isPortalRoute ? 'vi' : preferences.locale;
  const activeCurrency = isPortalRoute ? 'VND' : preferences.currency;
  const t = getUserMessages(activeLocale);

  return (
    <footer className="border-t border-[var(--color-hairline)] bg-[var(--color-surface-ivory)] mt-20">
      <div className="container-stay py-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6 text-[14px] text-[var(--color-text-muted)]">
        <div className="space-y-1.5 max-w-2xl">
          <p className="font-semibold text-[var(--color-text)]">{brandName}</p>
          <p>
            {t.footer.tagline}{' '}
            {!isPortalRoute ? t.footer.currencyNote : ''}
          </p>
          {!isPortalRoute && activeCurrency !== 'VND' && (
            <p className="text-xs font-medium text-[var(--color-text)]">
              {getExchangeRateNote(activeCurrency, activeLocale)}
            </p>
          )}
          {demoMode && (
            <p className="text-xs">
              {t.footer.demoNote}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-5">
          <Link
            href="/stays"
            className="font-medium text-[var(--color-text)] hover:text-[var(--color-primary)] transition-colors"
          >
            {t.footer.exploreStays}
          </Link>
          <Link
            href="/explore"
            className="font-medium text-[var(--color-text)] hover:text-[var(--color-primary)] transition-colors"
          >
            {t.nav.localGuides}
          </Link>
          <Link
            href="/customer"
            className="font-medium text-[var(--color-text)] hover:text-[var(--color-primary)] transition-colors"
          >
            {t.nav.customerPortal}
          </Link>
          <Link
            href="/host"
            className="font-medium text-[var(--color-text)] hover:text-[var(--color-primary)] transition-colors"
          >
            {t.nav.hostPortal}
          </Link>
          <Link
            href="/admin/crm"
            className="font-medium text-[var(--color-text)] hover:text-[var(--color-primary)] transition-colors"
          >
            {t.nav.crmPortal}
          </Link>
          <Link
            href="/login"
            className="font-medium text-[var(--color-text)] hover:text-[var(--color-primary)] transition-colors"
          >
            {t.footer.signIn}
          </Link>
        </div>
      </div>
    </footer>
  );
}
