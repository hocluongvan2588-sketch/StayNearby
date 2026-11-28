'use client';

import { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { StayCardItem } from '@/modules/catalog';
import { usePreferences } from './PreferencesProvider';
import { StayCard } from './StayCard';

/**
 * Horizontal stay rail (Airbnb-style): two full cards plus a sliver of the
 * third on mobile, more per row on wider screens. Native scroll-snap so touch
 * swipe works; edge arrows scroll for mouse users (desktop hover only —
 * mobile swipes, matching the Airbnb app).
 */
export function StayRow({
  stays,
  savedIds,
  isAuthenticated = false,
}: {
  stays: StayCardItem[];
  savedIds?: string[];
  isAuthenticated?: boolean;
}) {
  const { locale } = usePreferences();
  const isVi = locale === 'vi';
  const scrollRef = useRef<HTMLDivElement>(null);
  const savedSet = new Set(savedIds ?? []);

  function scrollByDir(dir: 1 | -1) {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: 'smooth' });
  }

  return (
    <div className="group/row relative">
      <div
        ref={scrollRef}
        className="-mr-4 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-1 pr-4 [scrollbar-width:none] sm:-mr-6 sm:pr-6 lg:-mr-8 lg:pr-8 [&::-webkit-scrollbar]:hidden"
      >
        {stays.map((stay) => (
          <div
            key={stay.id}
            className="w-[43%] shrink-0 snap-start md:w-[31%] lg:w-[23%]"
          >
            <StayCard
              stay={stay}
              initialSaved={savedSet.has(stay.id)}
              isAuthenticated={isAuthenticated}
            />
          </div>
        ))}
      </div>

      <button
        type="button"
        aria-label={isVi ? 'Cuộn sang trái' : 'Scroll left'}
        onClick={() => scrollByDir(-1)}
        className="absolute -left-3 top-[30%] z-10 hidden h-9 w-9 items-center justify-center rounded-full border border-[#E5DFD3] bg-white text-[#17221E] shadow-md opacity-0 transition group-hover/row:opacity-100 focus-visible:opacity-100 md:flex"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <button
        type="button"
        aria-label={isVi ? 'Cuộn sang phải' : 'Scroll right'}
        onClick={() => scrollByDir(1)}
        className="absolute -right-3 top-[30%] z-10 hidden h-9 w-9 items-center justify-center rounded-full border border-[#E5DFD3] bg-white text-[#17221E] shadow-md opacity-0 transition group-hover/row:opacity-100 focus-visible:opacity-100 md:flex"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
