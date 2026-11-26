import type { Metadata } from 'next';
import './globals.css';
import { getCurrentUser } from '@/lib/auth/session';
import { getConfig } from '@/lib/config';
import { getServerPreferences } from '@/lib/preferences';
import { getDestinations, getLifestyles } from '@/modules/catalog';
import { PreferencesProvider } from '@/components/PreferencesProvider';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { CompareDrawer } from '@/components/CompareDrawer';

export const metadata: Metadata = {
  title: 'VietNomad Stays | Extended Stays for Remote Work in Vietnam',
  description:
    'Verified Wi-Fi speeds, clear weekly and monthly rates, full desks, and kitchens for remote workers across Vietnam.',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [prefs, user, destinations, lifestyles] = await Promise.all([
    getServerPreferences(),
    getCurrentUser(),
    getDestinations(),
    getLifestyles(),
  ]);

  return (
    <html lang={prefs.locale}>
      <body className="min-h-screen flex flex-col antialiased">
        <PreferencesProvider
          initialLocale={prefs.locale}
          initialCurrency={prefs.currency}
        >
          <SiteHeader
            user={user}
            destinations={destinations}
            lifestyles={lifestyles}
          />
          <main className="flex-1">{children}</main>
          <CompareDrawer />
          <SiteFooter destinations={destinations} demoEnabled={getConfig().demoMode} />
        </PreferencesProvider>
      </body>
    </html>
  );
}
