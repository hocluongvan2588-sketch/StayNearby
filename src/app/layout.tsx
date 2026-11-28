import type { Metadata } from 'next';
import './globals.css';
import { getConfig } from '@/lib/config';
import { getCurrentUser } from '@/lib/auth/session';
import { getServerPreferences } from '@/lib/preferences';
import { getDestinations, getLifestyles } from '@/modules/catalog';
import { getPublishedCmsContents } from '@/modules/cms';
import { getPlatformFeeConfig } from '@/modules/platform-settings';
import { PreferencesProvider } from '@/components/PreferencesProvider';
import { AppShellSwitch } from '@/components/shells/AppShellSwitch';

export const metadata: Metadata = {
  metadataBase: new URL(getConfig().appBaseUrl),
  title: 'VietNomad Stays | Weekly & Monthly Stays in Vietnam',
  description:
    'Book weekly and monthly apartments, villas, and boutique stays across Vietnam. Transparent pricing, local neighborhoods, and workspaces when you need them.',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [prefs, user, destinations, lifestyles, platformConfig, announcements] = await Promise.all([
    getServerPreferences(),
    getCurrentUser(),
    getDestinations(),
    getLifestyles(),
    getPlatformFeeConfig(),
    getPublishedCmsContents({ contentTypes: ['announcement'], limit: 1 }),
  ]);

  return (
    <html lang={prefs.locale}>
      <body className="min-h-screen flex flex-col antialiased">
        <PreferencesProvider
          initialLocale={prefs.locale}
          initialCurrency={prefs.currency}
          platformConfig={platformConfig}
        >
          <AppShellSwitch
            user={user}
            destinations={destinations}
            lifestyles={lifestyles}
            announcement={announcements[0] ?? null}
          >
            {children}
          </AppShellSwitch>
        </PreferencesProvider>
      </body>
    </html>
  );
}
