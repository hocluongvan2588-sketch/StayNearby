'use client';

import { useEffect, useRef } from 'react';
import {
  Clock,
  ExternalLink,
  MapPin,
  Navigation,
  Sparkles,
  Star,
  Tag,
  X,
} from 'lucide-react';
import {
  formatDistanceLabel,
  formatDistanceMeters,
  formatPlaceCategoryLabel,
  type Locale,
} from '@/lib/i18n';
import { trackClientEvent } from '@/lib/attribution';
import type { LocalDiscoveryPlace } from '@/modules/catalog';
import { buildPlaceMapsUrl } from './LocalPlaceCard';

/**
 * Place detail overlay for Local Discovery: bottom sheet on mobile, centered
 * modal on desktop. Pure display — no login, no booking-state changes, scroll
 * position is preserved while open.
 */
export function LocalPlaceDetailModal({
  place,
  locale,
  onClose,
}: {
  place: LocalDiscoveryPlace;
  locale: Locale;
  onClose: () => void;
}) {
  const isVi = locale === 'vi';
  const closeRef = useRef<HTMLButtonElement>(null);
  const mapsUrl = buildPlaceMapsUrl(place);

  const desc = isVi
    ? place.descriptionVi || place.descriptionEn
    : place.descriptionEn || place.descriptionVi;
  const neighborhood = isVi
    ? place.neighborhoodNameVi || place.neighborhoodNameEn
    : place.neighborhoodNameEn || place.neighborhoodNameVi;
  const distance =
    formatDistanceLabel(place.distanceLabel, locale) ||
    formatDistanceMeters(place.distanceMeters, locale);
  const website = (place.website ?? '').trim();

  // Basic interaction telemetry (spec §11): one event per modal open.
  useEffect(() => {
    void trackClientEvent({
      eventName: 'place_detail_view',
      placeId: place.id,
      landingPath: typeof window !== 'undefined' ? window.location.pathname : undefined,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [place.id]);

  // Focus the close button and lock background scroll (position preserved).
  useEffect(() => {
    closeRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  // Escape closes.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const infoRows: Array<{ icon: React.ReactNode; label: string; value: string }> = [];
  if (place.address) {
    infoRows.push({
      icon: <MapPin className="h-4 w-4 shrink-0 text-[#C25E28]" />,
      label: isVi ? 'Địa chỉ' : 'Address',
      value: place.address,
    });
  }
  if (place.openingHours) {
    infoRows.push({
      icon: <Clock className="h-4 w-4 shrink-0 text-[#53635D]" />,
      label: isVi ? 'Giờ mở cửa' : 'Opening hours',
      value: place.openingHours,
    });
  }
  if (place.priceRange) {
    infoRows.push({
      icon: <Tag className="h-4 w-4 shrink-0 text-[#53635D]" />,
      label: isVi ? 'Mức giá tham khảo' : 'Price level',
      value: place.priceRange,
    });
  }
  if (neighborhood) {
    infoRows.push({
      icon: <MapPin className="h-4 w-4 shrink-0 text-[#53635D]" />,
      label: isVi ? 'Khu vực' : 'Neighborhood',
      value: neighborhood,
    });
  }
  if (distance) {
    infoRows.push({
      icon: <Navigation className="h-4 w-4 shrink-0 text-[#53635D]" />,
      label: isVi ? 'Khoảng cách' : 'Distance',
      value: distance,
    });
  }
  if (place.hostNote) {
    infoRows.push({
      icon: <Sparkles className="h-4 w-4 shrink-0 text-[#164E3F]" />,
      label: isVi ? 'Lý do chủ nhà giới thiệu' : "Host's reason for recommending",
      value: place.hostNote,
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="local-place-modal-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[88vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:max-w-lg sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative shrink-0">
          {place.imageUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={place.imageUrl}
              alt={place.name}
              className="aspect-[16/10] w-full object-cover"
            />
          ) : (
            <div className="flex aspect-[16/6] w-full items-center justify-center bg-[#F2EDE3]">
              <Sparkles className="h-8 w-8 text-[#164E3F]/40" />
            </div>
          )}
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label={isVi ? 'Đóng' : 'Close'}
            className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-[#17221E] shadow-sm hover:bg-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          <div className="flex items-center justify-between gap-3 text-[11px] font-semibold uppercase tracking-wider">
            <span className="text-[#164E3F]">
              {formatPlaceCategoryLabel(place.category, locale)}
              {place.linkSource === 'host_suggested' ? (
                <span className="ml-2 font-normal normal-case text-[#53635D]">
                  {isVi ? '· Chủ nhà giới thiệu' : '· Host recommended'}
                </span>
              ) : place.linkSource === 'curated' ? (
                <span className="ml-2 font-normal normal-case text-[#53635D]">
                  {isVi ? '· VietNomad biên tập' : '· Curated by VietNomad'}
                </span>
              ) : null}
            </span>
            {place.rating !== null && (
              <span className="inline-flex items-center gap-1 text-[#17221E]">
                <Star className="h-3.5 w-3.5 text-[#17221E]" fill="#17221E" />
                {place.rating.toFixed(1)}
                {place.reviewCount !== null && place.reviewCount > 0 && (
                  <span className="font-normal text-[#53635D]">
                    ({place.reviewCount})
                  </span>
                )}
              </span>
            )}
          </div>

          <h3
            id="local-place-modal-title"
            className="mt-1.5 text-[20px] font-semibold leading-snug text-[#17221E]"
          >
            {place.name}
          </h3>

          {desc && (
            <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-[#17221E]/90">
              {desc}
            </p>
          )}

          {infoRows.length > 0 && (
            <dl className="mt-5 space-y-2.5 border-t border-[#E5DFD3] pt-4 text-sm">
              {infoRows.map((row) => (
                <div key={row.label} className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
                    {row.icon}
                  </span>
                  <div className="min-w-0">
                    <dt className="text-[11px] font-semibold uppercase tracking-wider text-[#53635D]">
                      {row.label}
                    </dt>
                    <dd className="mt-0.5 text-[#17221E]">{row.value}</dd>
                  </div>
                </div>
              ))}
            </dl>
          )}

          {place.partnerPerk && (
            <div className="mt-5 rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] p-4">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#164E3F]">
                <Sparkles className="h-3.5 w-3.5" />
                {isVi
                  ? 'Ưu đãi dành cho khách VietNomad'
                  : 'VietNomad guest perk'}
              </div>
              {place.partnerName && (
                <p className="mt-1 text-[13px] font-medium text-[#17221E]">
                  {place.partnerName}
                </p>
              )}
              <p className="mt-1 text-sm leading-relaxed text-[#53635D]">
                {place.partnerPerk}
              </p>
            </div>
          )}
        </div>

        <div className="shrink-0 space-y-2 border-t border-[#E5DFD3] px-5 py-4 sm:px-6">
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => {
              void trackClientEvent({
                eventName: 'place_map_click',
                placeId: place.id,
                dedupeKey: `place_map_click:${place.id}:${Date.now()}`,
              });
            }}
            className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[#164E3F] text-sm font-semibold text-white hover:bg-[#0F392E]"
          >
            <Navigation className="h-4 w-4" />
            {isVi ? 'Chỉ đường trên Google Maps' : 'Get directions on Google Maps'}
          </a>
          {website ? (
            <a
              href={website}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                void trackClientEvent({
                  eventName: 'place_website_click',
                  placeId: place.id,
                  dedupeKey: `place_website_click:${place.id}:${Date.now()}`,
                });
              }}
              className="flex min-h-[40px] w-full items-center justify-center gap-2 rounded-xl border border-[#E5DFD3] text-sm font-semibold text-[#17221E] hover:bg-[#FAF8F3]"
            >
              <ExternalLink className="h-4 w-4" />
              {isVi ? 'Truy cập website' : 'Visit website'}
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}
