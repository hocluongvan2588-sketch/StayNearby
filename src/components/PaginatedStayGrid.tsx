'use client';

import { useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { StayCardItem } from '@/modules/catalog';
import { usePreferences } from './PreferencesProvider';
import { StayCard } from './StayCard';

interface PaginatedStayGridProps {
  stays: StayCardItem[];
  savedIds?: string[];
  isAuthenticated?: boolean;
  gapClass?: string;
  perPage?: number;
}

export function PaginatedStayGrid(props: PaginatedStayGridProps) {
  const staysKey = props.stays.map((s) => s.id).join('|');
  return <PaginatedStayGridInner key={staysKey} {...props} />;
}

function PaginatedStayGridInner({
  stays,
  savedIds = [],
  isAuthenticated = false,
  gapClass = 'gap-6',
  perPage = 9,
}: PaginatedStayGridProps) {
  const { locale } = usePreferences();
  const isVi = locale === 'vi';
  const [page, setPage] = useState(1);
  const topRef = useRef<HTMLDivElement>(null);

  const savedSet = useMemo(() => new Set(savedIds), [savedIds]);
  const totalPages = Math.max(1, Math.ceil(stays.length / perPage));
  const currentPage = Math.min(page, totalPages);
  const startIdx = (currentPage - 1) * perPage;
  const visibleStays = stays.slice(startIdx, startIdx + perPage);

  function goToPage(nextPage: number) {
    const clamped = Math.max(1, Math.min(nextPage, totalPages));
    if (clamped === currentPage) return;
    setPage(clamped);
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div ref={topRef} className="scroll-mt-24">
      <div className={`grid ${gapClass} md:grid-cols-2 lg:grid-cols-3`}>
        {visibleStays.map((stay) => (
          <StayCard
            key={stay.id}
            stay={stay}
            initialSaved={savedSet.has(stay.id)}
            isAuthenticated={isAuthenticated}
          />
        ))}
      </div>

      {totalPages > 1 && (
        <nav
          aria-label={isVi ? 'Phân trang danh sách chỗ ở' : 'Stays pagination'}
          className="mt-8 flex items-center justify-center"
        >
          <div className="inline-flex items-center gap-1 rounded-full border border-[#E5DFD3] bg-white px-2 py-1.5 shadow-sm">
            <button
              type="button"
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage <= 1}
              aria-label={isVi ? 'Trang trước' : 'Previous page'}
              className="flex h-8 w-8 items-center justify-center rounded-full text-[#164E3F] transition hover:bg-[#E7F1EC] disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[54px] text-center text-sm font-semibold tabular-nums text-[#17221E]">
              <span className="text-[#164E3F]">{currentPage}</span>
              <span className="mx-1 text-[#53635D]">/</span>
              <span>{totalPages}</span>
            </span>
            <button
              type="button"
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage >= totalPages}
              aria-label={isVi ? 'Trang tiếp theo' : 'Next page'}
              className="flex h-8 w-8 items-center justify-center rounded-full text-[#164E3F] transition hover:bg-[#E7F1EC] disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </nav>
      )}
    </div>
  );
}
