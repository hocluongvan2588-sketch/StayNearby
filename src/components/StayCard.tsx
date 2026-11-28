'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  Bookmark,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Star,
  Wifi,
} from 'lucide-react';
import {
  formatCancellationPolicyLabel,
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

  // Photo carousel (app-standard card): hero first, then gallery, deduped.
  // Cards are keyed by stay.id upstream, so state resets on stay change; the
  // clamp guards the rare same-instance prop swap instead of an effect.
  const [photoIdx, setPhotoIdx] = useState(0);
  const photos = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const src of [stay.heroImage, ...(stay.galleryImages ?? [])]) {
      if (src && !seen.has(src)) {
        seen.add(src);
        out.push(src);
      }
    }
    return out.length > 0 ? out : [stay.heroImage];
  }, [stay.heroImage, stay.galleryImages]);
  const activePhotoIdx = photoIdx < photos.length ? photoIdx : 0;

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
  const hasGoogleRating =
    !hasInternalRating &&
    stay.googleReviewCount !== null &&
    stay.googleReviewCount > 0 &&
    stay.googleRating !== null;
  const ratingValue = hasInternalRating
    ? stay.guestReviewsAvg!.toFixed(1)
    : hasGoogleRating
      ? stay.googleRating!.toFixed(1)
      : null;

  // Airbnb-style review count next to the star (source stays labelled).
  const ratingCount = hasInternalRating
    ? stay.guestReviewsCount
    : hasGoogleRating
      ? (stay.googleReviewCount ?? 0)
      : 0;

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
            src={photos[activePhotoIdx] ?? stay.heroImage}
            alt={title}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-black/10" />
        </Link>

        {/* Carousel controls (Airbnb-style): arrows on hover, dots always */}
        {photos.length > 1 && (
          <>
            <button
              type="button"
              aria-label={isVi ? 'Ảnh trước' : 'Previous photo'}
              onClick={() => setPhotoIdx((i) => (i - 1 + photos.length) % photos.length)}
              className="absolute left-2 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[#17221E] shadow-sm opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label={isVi ? 'Ảnh tiếp theo' : 'Next photo'}
              onClick={() => setPhotoIdx((i) => (i + 1) % photos.length)}
              className="absolute right-11 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[#17221E] shadow-sm opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <div className="absolute bottom-2.5 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5">
              {photos.map((src, i) => (
                <button
                  key={`${src}-${i}`}
                  type="button"
                  aria-label={isVi ? `Ảnh ${i + 1}/${photos.length}` : `Photo ${i + 1}/${photos.length}`}
                  onClick={() => setPhotoIdx(i)}
                  className={`h-1.5 rounded-full transition-all ${
                    i === activePhotoIdx
                      ? 'w-4 bg-white shadow-sm'
                      : 'w-1.5 bg-white/60 hover:bg-white/80'
                  }`}
                />
              ))}
            </div>
          </>
        )}

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
              {ratingCount > 0 && (
                <span className="font-normal text-[#53635D]">({ratingCount})</span>
              )}
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

        {/* Trust chips (Booking-style): only real, earned attributes */}
        {(stay.isWorkReady || stay.cancellationPolicy === 'flexible') && (
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {stay.isWorkReady && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#E7F1EC] px-2 py-0.5 text-[10px] font-semibold text-[#164E3F]">
                <Briefcase className="h-3 w-3" />
                Work-Ready
              </span>
            )}
            {stay.cancellationPolicy === 'flexible' && (
              <span className="inline-flex items-center gap-1 rounded-full border border-[#E5DFD3] bg-[#FAF8F3] px-2 py-0.5 text-[10px] font-semibold text-[#53635D]">
                <ShieldCheck className="h-3 w-3 text-[#164E3F]" />
                {formatCancellationPolicyLabel(stay.cancellationPolicy, locale)}
              </span>
            )}
          </div>
        )}

        <div className="mt-auto space-y-0.5 pt-1.5">
          {stay.selectedStayNights !== null &&
          stay.selectedStayNights !== undefined &&
          stay.selectedStayTotalVnd !== null &&
          stay.selectedStayTotalVnd !== undefined ? (
            <>
            <div className="flex items-baseline gap-1.5">
              <span className="text-[15px] font-semibold text-[#17221E]">
                {formatMoney(stay.selectedStayTotalVnd)}
              </span>
              <span className="text-[13px] text-[#53635D]">
                {isVi ? `/ ${stay.selectedStayNights} đêm` : `/ ${stay.selectedStayNights} nights`}
              </span>
            </div>
            {stay.selectedStayNights > 0 && (
              <p className="text-[12px] text-[#53635D]">
                ≈ {formatMoney(Math.round(stay.selectedStayTotalVnd / stay.selectedStayNights))}
                {isVi ? ' / đêm' : ' / night'}
              </p>
            )}
            </>
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
