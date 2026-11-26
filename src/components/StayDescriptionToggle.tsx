'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { Locale } from '@/lib/i18n';

export function StayDescriptionToggle({
  description,
  locale,
}: {
  description: string;
  locale: Locale;
}) {
  const isVi = locale === 'vi';
  const [expanded, setExpanded] = useState(false);

  const cleanText = description.trim();
  if (!cleanText) return null;

  const isLong = cleanText.length > 260;
  const displayText =
    !isLong || expanded ? cleanText : `${cleanText.slice(0, 260).trimEnd()}...`;

  return (
    <section className="py-8">
      <h2 className="text-[22px] font-semibold tracking-tight text-[#17221E]">
        {isVi ? 'Giới thiệu về chỗ ở này' : 'About this stay'}
      </h2>
      <p className="mt-4 whitespace-pre-line text-[15px] leading-[1.7] text-[#17221E]/90 sm:text-[16px]">
        {displayText}
      </p>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[#17221E] underline underline-offset-4 hover:text-[#164E3F]"
        >
          <span>
            {expanded
              ? isVi
                ? 'Thu gọn'
                : 'Show less'
              : isVi
                ? 'Xem thêm'
                : 'Show more'}
          </span>
          {expanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>
      )}
    </section>
  );
}
