'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Bookmark, ShieldCheck, Star, Wifi } from 'lucide-react';
import {
  formatCountNoun,
  formatKitchenTypeLabel,
  formatPropertyTypeLabel,
  formatStayLocationLabel,
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
  const locationLabel = formatStayLocationLabel([
    isVi ? stay.neighborhoodVi : stay.neighborhoodEn,
    isVi ? stay.destinationNameVi : stay.destinationNameEn,
  ]);

  const summaryBits: string[] = [formatPropertyTypeLabel(stay.propertyType, locale)];
  if (stay.maxGuests > 0) {
    summaryBits.push(
      formatCountNoun(stay.maxGuests, 'guest', 'guests', 'khách', locale)
    );
  }
  if (stay.kitchenType && stay.kitchenType !== 'none') {
    summaryBits.push(formatKitchenTypeLabel(stay.kitchenType, locale));
  }

  // Rating: internal VietNomad reviews first; Google only when present,
  // always labelled with its source. Never a default score.
  const hasInternalRating = stay.guestReviewsCount > 0 && stay.guestReviewsAvg !== null;
  const hasGoogleRating = !hasInternalRating && stay.googleReviewCount > 0;
  const ratingValue = hasInternalRating
    ? stay.guestReviewsAvg!.toFixed(1)
    : hasGoogleRating
      ? stay.googleRating.toFixed(1)
      : null;

  // Wi-Fi badge: only a real declared/measured speed, never0 or assumed.
  const wifiSpeed =
    stay.wifiDownloadMbps !== null && stay.wifiDownloadMbps > 0
      ? stay.wifiDownloadMbps
      : null;

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

        {/* Top-left: Wi-Fi speed badge (intentional exception to the
            no-badge rule — a VietNomad signature attribute) */}
        {wifiSpeed !== null && (
          <span className="pointer-events-none absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-[#164E3F] px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm">
            <Wifi className="h-3.5 w-3.5" />
            {wifiSpeed} Mbps
            {stay.isWifiVerified && (
              <ShieldCheck className="h-3.5 w-3.5" aria-label="Verified" />
            )}
          </span>
        )}

        {/* Top-right: save */}
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

        {/* Bottom-left: real long-stay deal only */}
        {stay.dealSavingsPct > 0 && (
          <span className="pointer-events-none absolute bottom-3 left-3 inline-flex items-center rounded-full bg-[#C25E28] px-2.5 py-1 text-xs font-semibold text-white shadow-sm">
            {isVi ? `Giảm ${stay.dealSavingsPct}%` : `Save ${stay.dealSavingsPct}%`}
          </span>
        )}
      </div>

      <Link
        href={`/stays/${stay.slug}`}
        className="mt-3 flex flex-1 flex-col space-y-1.5"
      >
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-1 text-[16px] font-semibold leading-snug text-[#17221E] transition group-hover:text-[#164E3F]">
            {title}
          </h3>
          {ratingValue !== null && (
            <span className="inline-flex shrink-0 items-center gap-1 pt-0.5 text-[13px] font-medium text-[#17221E]">
              <Star
                className={`h-3.5 w-3.5 ${hasGoogleRating ? 'text-[#A67C2E]' : 'text-[#17221E]'}`}
                fill={hasGoogleRating ? '#A67C2E' : '#17221E'}
              />
              {ratingValue}
              {hasGoogleRating && (
                <span className="text-[10px] font-normal text-[#53635D]">
                  {isVi ? 'Google' : 'Google'}
                </span>
              )}
            </span>
          )}
        </div>

        {locationLabel && (
          <p className="line-clamp-1 text-[13px] text-[#53635D]">{locationLabel}</p>
        )}

        <p className="line-clamp-1 text-[13px] text-[#53635D]">
          {summaryBits.join(' · ')}
        </p>

        <div className="mt-auto space-y-0.5 pt-1.5">
          {stay.selectedStayNights !== null &&
          stay.selectedStayNights !== undefined &&
          stay.selectedStayTotalVnd !== null &&
          stay.selectedStayTotalVnd !== undefined ? (
            <div className="flex items-baseline gap-1.5">
              <span className="text-[15px] font-semibold text-[#17221E]">
                {formatMoney(stay.selectedStayTotalVnd)}
              </span>
              <span className="text-[13px] text-[#53635D]">
                {isVi ? `/ ${stay.selectedStayNights} đêm` : `/ ${stay.selectedStayNights} nights`}
              </span>
            </div>
          ) : (
            <>
              <div className="flex items-baseline gap-1.5">
                <span className="text-[15px] font-semibold text-[#17221E]">
                  {formatMoney(stay.weekDisplayVnd)}
                </span>
                <span className="text-[13px] text-[#53635D]">
                  {isVi ? '/ 7 đêm' : '/ 7 nights'}
                </span>
              </div>
              {stay.monthDisplayVnd > 0 && (
                <p className="text-[13px] text-[#53635D]">
                  {formatMoney(stay.monthDisplayVnd)}{' '}
                  {isVi ? '/ 30 đêm' : '/ 30 nights'}
                </p>
              )}
            </>
          )}
        </div>
      </Link>
    </article>
  );
}
