'use client';

/**
 * Stay Detail — "Dịch vụ bổ sung" (§5 of the Stay Extras spec).
 * A compact list of services the host offers: "Name · Price/Unit".
 * Shown only when the stay has at least one enabled service. It never
 * appears on search result cards and never changes booking prices —
 * services are requested at checkout and paid to the provider directly.
 */

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, Info } from 'lucide-react';

export interface StayExtraServiceItem {
  id: string;
  nameVi: string;
  nameEn: string;
  priceVnd: number | null;
  priceUnit: string;
  isIncluded: boolean;
  descriptionVi: string;
  descriptionEn: string;
}

const UNIT_LABELS: Record<string, { vi: string; en: string }> = {
  day: { vi: 'ngày', en: 'day' },
  week: { vi: 'tuần', en: 'week' },
  month: { vi: 'tháng', en: 'month' },
  trip: { vi: 'chuyến', en: 'trip' },
  visit: { vi: 'lần', en: 'visit' },
  quote: { vi: 'yêu cầu', en: 'quote' },
};

function priceLine(s: StayExtraServiceItem, isVi: boolean): string {
  if (s.isIncluded) return isVi ? 'Đã bao gồm' : 'Included';
  if (s.priceVnd === null || s.priceVnd === undefined) return isVi ? 'Theo yêu cầu' : 'By quote';
  if (s.priceVnd === 0) return isVi ? 'Miễn phí' : 'Free';
  const unit = UNIT_LABELS[s.priceUnit];
  const unitLabel = unit ? (isVi ? unit.vi : unit.en) : s.priceUnit;
  return `${s.priceVnd.toLocaleString(isVi ? 'vi-VN' : 'en-US')}₫/${unitLabel}`;
}

const COLLAPSE_THRESHOLD = 4;

export function StayExtraServicesSection({
  services,
  guideSlug,
  locale,
}: {
  services: StayExtraServiceItem[];
  guideSlug: string | null;
  locale: string;
}) {
  const isVi = locale !== 'en';
  const [expanded, setExpanded] = useState(false);

  if (!services.length) return null;

  const needsToggle = services.length > COLLAPSE_THRESHOLD;
  const visible =
    needsToggle && !expanded ? services.slice(0, COLLAPSE_THRESHOLD) : services;

  return (
    <section
      id="extra-services"
      className="mb-8 rounded-2xl border border-stone-200 bg-white p-5 sm:p-6"
      aria-labelledby="extra-services-heading"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="extra-services-heading" className="text-lg font-semibold text-stone-800">
          {isVi ? 'Dịch vụ bổ sung' : 'Additional services'}
        </h2>
        <span className="flex items-center gap-1.5 text-xs font-normal text-stone-500">
          <Info className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {isVi
            ? 'Dịch vụ theo yêu cầu. Thanh toán trực tiếp cho bên cung cấp.'
            : 'Services on request. Pay the provider directly.'}
        </span>
      </div>

      <ul className="mt-4 space-y-3">
        {visible.map((s) => (
          <li
            key={s.id}
            className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-stone-100 pb-3 last:border-0 last:pb-0"
          >
            <span className="min-w-0 text-sm font-medium text-stone-700">
              {isVi ? s.nameVi : s.nameEn}
            </span>
            <span className="shrink-0 text-sm text-stone-600">{priceLine(s, isVi)}</span>
            {(isVi ? s.descriptionVi : s.descriptionEn) && (
              <span className="w-full text-xs font-normal leading-relaxed text-stone-500">
                {isVi ? s.descriptionVi : s.descriptionEn}
              </span>
            )}
          </li>
        ))}
      </ul>

      {needsToggle && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-[#FF5A1F] hover:underline"
        >
          {expanded
            ? isVi
              ? 'Thu gọn'
              : 'Show less'
            : isVi
              ? `Xem tất cả (${services.length})`
              : `Show all (${services.length})`}
          <ChevronDown
            className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </button>
      )}

      <p className="mt-4 rounded-xl bg-[#FFF8EE] px-4 py-3 text-xs leading-relaxed text-stone-600">
        {isVi
          ? 'Chủ nhà sẽ xác nhận dịch vụ sau khi bạn đặt chỗ. Thanh toán trực tiếp cho bên cung cấp — VietNomad không thu tiền dịch vụ này.'
          : 'The host confirms services after you book. Pay the provider directly — VietNomad does not collect money for these services.'}
      </p>

      {guideSlug && (
        <p className="mt-3 text-sm">
          <Link
            href={`/guides/${guideSlug}`}
            className="font-medium text-[#FF5A1F] hover:underline"
          >
            {isVi ? 'Tìm hiểu thêm' : 'Learn more'} →
          </Link>
        </p>
      )}
    </section>
  );
}
