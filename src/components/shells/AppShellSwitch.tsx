'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Megaphone, X } from 'lucide-react';
import type { SessionUser } from '@/lib/auth/session';
import type { DestinationSummary, LifestyleItem } from '@/modules/catalog';
import type { PublishedCmsItem } from '@/modules/cms';
import { AttributionTracker } from '@/components/AttributionTracker';
import { usePreferences } from '@/components/PreferencesProvider';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';

export function AppShellSwitch({
  user,
  destinations,
  lifestyles,
  announcement,
  children,
}: {
  user: SessionUser | null;
  destinations: DestinationSummary[];
  lifestyles: LifestyleItem[];
  announcement?: PublishedCmsItem | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? '/';
  const { locale } = usePreferences();
  const isVi = locale === 'vi';
  const [bannerDismissed, setBannerDismissed] = useState(false);

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
      <AttributionTracker />
      {announcement && !bannerDismissed && (
        <div className="bg-[#0F392E] px-4 py-2 text-center text-xs font-medium text-[#FAF8F3]">
          <div className="mx-auto flex max-w-7xl items-center justify-center gap-2">
            <Megaphone className="h-3.5 w-3.5 shrink-0 text-[#E6B87A]" />
            <Link
              href={`/guides/${announcement.slug}`}
              className="hover:underline"
            >
              <strong>{isVi ? announcement.titleVi : announcement.titleEn}</strong>
              {(announcement.bodyEn || announcement.bodyVi) && (
                <span className="ml-2 text-[#DCECE5]">
                  {(isVi ? announcement.bodyVi : announcement.bodyEn).slice(0, 110)}
                </span>
              )}
            </Link>
            <button
              type="button"
              onClick={() => setBannerDismissed(true)}
              aria-label="Dismiss announcement"
              className="ml-2 rounded p-0.5 text-[#DCECE5] hover:bg-white/10"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
      <SiteHeader user={user} destinations={destinations} lifestyles={lifestyles} />
      <main className="flex-1">{children}</main>
      <SiteFooter destinations={destinations} />
    </>
  );
}
