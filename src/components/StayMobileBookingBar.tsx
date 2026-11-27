'use client';

import { formatVndExact, type Locale } from '@/lib/i18n';

type Props = {
  locale: Locale;
  stayTitle: string;
  weekTotalVnd: number;
  isInstantBook: boolean;
};

/**
 * Compact fixed bar for mobile listing detail (spec5: mobile booking CTA).
 * Scrolls to the full widget — never books directly.
 */
export default function StayMobileBookingBar({
  locale,
  stayTitle,
  weekTotalVnd,
  isInstantBook,
}: Props) {
  const isVi = locale === 'vi';
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#E5DFD3] bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[15px] font-semibold text-[#17221E]">
            {formatVndExact(weekTotalVnd)}{' '}
            <span className="text-[12px] font-normal text-[#53635D]">
              {isVi ? '/ 7 đêm' : '/ 7 nights'}
            </span>
          </div>
          <div className="truncate text-[11px] text-[#53635D]">{stayTitle}</div>
        </div>
        <a
          href="#booking-widget"
          className="inline-flex min-h-[44px] shrink-0 items-center rounded-xl bg-[#164E3F] px-5 text-sm font-semibold text-white hover:bg-[#0F392E]"
        >
          {isInstantBook
            ? isVi
              ? 'Đặt chỗ'
              : 'Reserve'
            : isVi
              ? 'Gửi yêu cầu đặt chỗ'
              : 'Request to book'}
        </a>
      </div>
    </div>
  );
}
