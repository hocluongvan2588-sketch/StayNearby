import type { Metadata } from 'next';
import { headers } from 'next/headers';
import './globals.css';
import { getAppConfig } from '@/lib/config';
import { getCurrentUser } from '@/lib/auth/session';
import { getUserMessages } from '@/lib/i18n/messages';
import { getServerUserPreferences } from '@/lib/i18n/preferences';
import { UserPreferencesProvider } from '@/components/i18n/UserPreferencesProvider';
import { SiteHeader } from '@/components/brand/SiteHeader';
import { SiteFooter } from '@/components/brand/SiteFooter';

export const dynamic = 'force-dynamic';

function isPortalPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return (
    pathname.startsWith('/host') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/crm')
  );
}

export async function generateMetadata(): Promise<Metadata> {
  const [config, prefs, hdrs] = await Promise.all([
    Promise.resolve(getAppConfig()),
    getServerUserPreferences(),
    headers(),
  ]);
  const portalRoute = isPortalPath(hdrs.get('x-pathname'));
  const t = getUserMessages(portalRoute ? 'vi' : prefs.locale);
  return {
    title: `${config.brandName} — ${t.meta.titleSuffix}`,
    description: t.meta.description,
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const config = getAppConfig();
  const [user, preferences, hdrs] = await Promise.all([
    getCurrentUser().catch(() => null),
    getServerUserPreferences(),
    headers(),
  ]);
  const portalRoute = isPortalPath(hdrs.get('x-pathname'));
  const htmlLang = portalRoute ? 'vi' : preferences.locale;

  return (
    <html lang={htmlLang}>
      <body className="min-h-screen flex flex-col bg-[var(--color-bg)] text-[var(--color-text)]">
        <UserPreferencesProvider initialPreferences={preferences}>
          <SiteHeader
            brandName={config.brandName}
            demoMode={config.demoMode}
            user={user}
          />
          <main className="flex-1">{children}</main>
          <SiteFooter brandName={config.brandName} demoMode={config.demoMode} />
        </UserPreferencesProvider>
      </body>
    </html>
  );
}
