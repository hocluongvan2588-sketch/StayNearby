'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Bookmark, ShieldCheck, Star } from 'lucide-react';
import {
  formatCountNoun,
  formatKitchenTypeLabel,
  formatPropertyTypeLabel,
} from '@/lib/i18n';
import type { StayCardItem } from '@/modules/catalog';
import { usePreferences } from './PreferencesProvider';

export function StayCard({
  stay,
  initialSaved = false,
  isAuthenticated = false,
}: {
  stay: StayCardItem;
  initialSaved?: boolean;
  isAuthenticated?: boolean;
}) {
  const { locale, formatMoney } = usePreferences();
  const [saved, setSaved] = useState(initialSaved);
  const [saving, setSaving] = useState(false);

  const isVi = locale === 'vi';
  const title = isVi ? stay.titleVi : stay.titleEn;
  const locationLabel = [
    isVi ? stay.neighborhoodVi : stay.neighborhoodEn,
    isVi ? stay.destinationNameVi : stay.destinationNameEn,
  ]
    .filter(Boolean)
    .join(', ');

  const summaryBits: string[] = [formatPropertyTypeLabel(stay.propertyType, locale)];
  if (stay.maxGuests > 0) {
    summaryBits.push(
      formatCountNoun(stay.maxGuests, 'guest', 'guests', 'khách', locale)
    );
  }
  if (stay.kitchenType && stay.kitchenType !== 'none') {
    summaryBits.push(formatKitchenTypeLabel(stay.kitchenType, locale));
  }

  async function handleSaveToggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!isAuthenticated) {
      window.location.assign(`/login?next=/stays/${stay.slug}`);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/saved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stayId: stay.id }),
      });
      const json = await res.json();
      if (json.ok) setSaved(Boolean(json.saved));
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="group flex flex-col">
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-[#F2EDE3]">
        <Link href={`/stays/${stay.slug}`} className="block h-full w-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={stay.heroImage}
            alt={title}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-black/10" />
        </Link>

        {/* Maximum 1 high-value recognition badge on photo */}
        <div className="pointer-events-none absolute left-3 top-3">
          {stay.dealSavingsPct > 0 ? (
            <span className="inline-flex items-center rounded-full bg-[#C25E28] px-2.5 py-1 text-xs font-semibold text-white shadow-sm">
              {isVi ? `Giảm ${stay.dealSavingsPct}%` : `Save ${stay.dealSavingsPct}%`}
            </span>
          ) : stay.isWifiVerified ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-[#164E3F] shadow-sm">
              <ShieldCheck className="h-3.5 w-3.5" />
              Wi-Fi Verified
            </span>
          ) : null}
        </div>

        <button
          type="button"
          onClick={handleSaveToggle}
          disabled={saving}
          title={isVi ? 'Lưu chỗ ở' : 'Save stay'}
          aria-label={isVi ? 'Lưu chỗ ở' : 'Save stay'}
          className={`absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full transition ${
            saved
              ? 'bg-[#C25E28] text-white shadow-sm'
              : 'bg-white/90 text-[#17221E] shadow-sm hover:bg-white'
          }`}
        >
          <Bookmark className="h-4 w-4" fill={saved ? 'currentColor' : 'none'} />
        </button>
      </div>

      <Link href={`/stays/${stay.slug}`} className="mt-3 flex flex-1 flex-col justify-between space-y-1.5">
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2 text-[13px] text-[#53635D]">
            <span className="truncate font-medium text-[#17221E]">{locationLabel}</span>
            {stay.googleReviewCount > 0 && (
              <span className="inline-flex shrink-0 items-center gap-1 font-medium text-[#17221E]">
                <Star className="h-3.5 w-3.5 text-[#17221E]" fill="#17221E" />
                {stay.googleRating.toFixed(1)}
              </span>
            )}
          </div>

          <h3 className="line-clamp-1 text-[16px] font-semibold leading-snug text-[#17221E] transition group-hover:text-[#164E3F]">
            {title}
          </h3>

          <p className="line-clamp-1 text-[13px] text-[#53635D]">
            {summaryBits.join(' · ')}
            {stay.wifiDownloadMbps !== null && stay.wifiDownloadMbps > 0
              ? ` · ${stay.wifiDownloadMbps} Mbps`
              : ''}
          </p>
        </div>

        <div className="pt-1.5">
          <div className="flex items-baseline gap-1.5">
            <span className="text-[15px] font-semibold text-[#17221E]">
              {formatMoney(stay.weekDisplayVnd)}
            </span>
            <span className="text-[13px] text-[#53635D]">
              {isVi ? '/ 7 đêm' : '/ 7 nights'}
            </span>
            {stay.monthDisplayVnd > 0 && (
              <span className="ml-auto text-[12px] font-medium text-[#164E3F]">
                {formatMoney(stay.monthDisplayVnd)} {isVi ? '/ tháng' : '/ mo'}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[12px] text-[#53635D]">
            {isVi
              ? `Trả ${formatMoney(stay.weekFeeOnlineVnd)} giữ chỗ · ${formatMoney(stay.weekPayAtCheckinVnd)} trả tại chỗ`
              : `Pay ${formatMoney(stay.weekFeeOnlineVnd)} online · ${formatMoney(stay.weekPayAtCheckinVnd)} at check-in`}
          </p>
        </div>
      </Link>
    </article>
  );
}
