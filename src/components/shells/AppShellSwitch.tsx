'use client';

import { usePathname } from 'next/navigation';
import type { SessionUser } from '@/lib/auth/session';
import type { DestinationSummary, LifestyleItem } from '@/modules/catalog';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';

export function AppShellSwitch({
  user,
  destinations,
  lifestyles,
  demoEnabled,
  children,
}: {
  user: SessionUser | null;
  destinations: DestinationSummary[];
  lifestyles: LifestyleItem[];
  demoEnabled: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? '/';
  const isConsoleRoute =
    pathname === '/host' ||
    pathname.startsWith('/host/') ||
    pathname === '/admin' ||
    pathname.startsWith('/admin/');

  if (isConsoleRoute) {
    return <div className="min-h-screen bg-[#FAF8F3] text-[#17221E]">{children}</div>;
  }

  return (
    <>
      <SiteHeader user={user} destinations={destinations} lifestyles={lifestyles} />
      <main className="flex-1">{children}</main>
      <SiteFooter destinations={destinations} demoEnabled={demoEnabled} />
    </>
  );
}
