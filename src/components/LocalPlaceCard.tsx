'use client';

import {
  Clock,
  Coffee,
  Compass,
  Dumbbell,
  ExternalLink,
  Laptop,
  MapPin,
  Music,
  ShoppingBag,
  Sparkles,
  Star,
  Store,
  Utensils,
} from 'lucide-react';
import { formatPlaceCategoryLabel, type Locale } from '@/lib/i18n';
import type { LocalDiscoveryPlace } from '@/modules/catalog';

function CategoryFallbackIcon({ category }: { category: string }) {
  const cls = 'h-7 w-7 text-[#164E3F]/60 stroke-[1.6]';
  switch (category) {
    case 'cafe':
    case 'cafe_roastery':
      return <Coffee className={cls} />;
    case 'restaurant':
    case 'dining':
      return <Utensils className={cls} />;
    case 'coworking':
    case 'workspace':
      return <Laptop className={cls} />;
    case 'gym_yoga':
    case 'fitness':
    case 'wellness':
      return <Dumbbell className={cls} />;
    case 'shopping':
      return <ShoppingBag className={cls} />;
    case 'entertainment':
      return <Music className={cls} />;
    case 'experience':
      return <Sparkles className={cls} />;
    case 'essential':
    case 'grocery':
      return <Store className={cls} />;
    default:
      return <Compass className={cls} />;
  }
}

export function buildPlaceMapsUrl(place: LocalDiscoveryPlace): string {
  if (place.lat !== null && place.lng !== null) {
    return `https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}`;
  }
  const query = [place.name, place.address].filter(Boolean).join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function LocalPlaceCard({
  place,
  locale,
}: {
  place: LocalDiscoveryPlace;
  locale: Locale;
}) {
  const isVi = locale === 'vi';
  const desc = isVi
    ? place.descriptionVi || place.descriptionEn
    : place.descriptionEn || place.descriptionVi;
  const neighborhood = isVi
    ? place.neighborhoodNameVi || place.neighborhoodNameEn
    : place.neighborhoodNameEn || place.neighborhoodNameVi;
  const mapsUrl = buildPlaceMapsUrl(place);

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-[#E5DFD3] bg-white transition duration-300 hover:border-[#164E3F]/40 lacquer-shadow">
      <div className="relative aspect-[16/10] overflow-hidden bg-[#F2EDE3]">
        {place.imageUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={place.imageUrl}
            alt={place.name}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#F2EDE3] to-[#E7F1EC]/70">
            <CategoryFallbackIcon category={place.category} />
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent" />
        {place.distanceLabel && (
          <span className="absolute bottom-2.5 left-3 inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-[#17221E] shadow-sm">
            <MapPin className="h-3 w-3 text-[#C25E28]" />
            {place.distanceLabel}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col justify-between p-4">
        <div>
          <div className="flex items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-wider text-[#53635D]">
            <span className="truncate text-[#164E3F]">
              {formatPlaceCategoryLabel(place.category, locale)}
            </span>
            <div className="flex shrink-0 items-center gap-2">
              {place.rating !== null && (
                <span className="inline-flex items-center gap-0.5 text-[#17221E]">
                  <Star className="h-3 w-3 text-[#17221E]" fill="#17221E" />
                  {place.rating.toFixed(1)}
                </span>
              )}
              {place.priceRange && <span>{place.priceRange}</span>}
            </div>
          </div>

          <h4 className="mt-1.5 line-clamp-1 text-[16px] font-semibold leading-snug text-[#17221E]">
            {place.name}
          </h4>

          {desc && (
            <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-[#53635D]">
              {desc}
            </p>
          )}

          {place.partnerPerk && (
            <p className="mt-2 text-[12px] font-medium text-[#164E3F]">
              {isVi ? 'Ưu đãi:' : 'Perk:'} {place.partnerPerk}
            </p>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between gap-2 border-t border-[#E5DFD3] pt-3 text-[12px] text-[#53635D]">
          <div className="min-w-0 truncate">
            {place.openingHours ? (
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{place.openingHours}</span>
              </span>
            ) : (
              <span className="truncate">{neighborhood || place.address}</span>
            )}
          </div>
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-1 font-semibold text-[#164E3F] hover:underline"
          >
            {isVi ? 'Xem bản đồ' : 'View map'}
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    </article>
  );
}
