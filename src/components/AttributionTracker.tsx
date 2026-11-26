'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { captureClientAttribution, trackClientEvent } from '@/lib/attribution';

export function AttributionTracker() {
  const pathname = usePathname() || '/';
  const lastTrackedRef = useRef('');

  useEffect(() => {
    if (pathname.startsWith('/admin') || pathname.startsWith('/host')) return;
    const ctx = captureClientAttribution();
    const dedupeKey = `pv:${ctx.sessionKey}:${pathname}`;
    if (lastTrackedRef.current === dedupeKey) return;
    lastTrackedRef.current = dedupeKey;

    void trackClientEvent({
      eventName: 'page_view',
      landingPath: pathname,
      dedupeKey,
    });
  }, [pathname]);

  return null;
}
