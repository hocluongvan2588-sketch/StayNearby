'use client';

import {
  Coffee,
  Compass,
  Dumbbell,
  Laptop,
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

/**
 * Local discovery place card — image-first and borderless, aligned with
 * StayCard/EventCard. The whole card opens the detail modal when `onOpen`
 * is provided; ratings and price show only when the data exists.
 */
export function LocalPlaceCard({
  place,
  locale,
  onOpen,
}: {
  place: LocalDiscoveryPlace;
  locale: Locale;
  /** Opens the detail overlay; the whole card becomes interactive. */
  onOpen?: () => void;
}) {
  const isVi = locale === 'vi';
  const desc = isVi
    ? place.descriptionVi || place.descriptionEn
    : place.descriptionEn || place.descriptionVi;

  return (
    <article
      className={`group flex flex-col rounded-2xl ${
        onOpen
          ? 'cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#164E3F]'
          : ''
      }`}
      onClick={onOpen}
      onKeyDown={
        onOpen
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onOpen();
              }
            }
          : undefined
      }
      role={onOpen ? 'button' : undefined}
      tabIndex={onOpen ? 0 : undefined}
      aria-label={
        onOpen
          ? isVi
            ? `Xem chi tiết ${place.name}`
            : `View details for ${place.name}`
          : undefined
      }
    >
      <div className="relative aspect-[16/10] overflow-hidden rounded-xl bg-[#F2EDE3]">
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
      </div>

      <div className="flex flex-1 flex-col pt-3">
        <div className="flex items-start justify-between gap-2">
          <span className="text-xs font-semibold text-[#164E3F]">
            {formatPlaceCategoryLabel(place.category, locale)}
          </span>
          <div className="flex shrink-0 items-center gap-2 text-xs font-medium text-[#53635D]">
            {place.rating !== null && (
              <span className="inline-flex items-center gap-0.5 text-[#17221E]">
                <Star className="h-3 w-3 text-[#17221E]" fill="#17221E" />
                {place.rating.toFixed(1)}
              </span>
            )}
            {place.priceRange && <span>{place.priceRange}</span>}
          </div>
        </div>

        <h4 className="mt-1 text-[16px] font-semibold leading-snug text-[#17221E] group-hover:text-[#164E3F]">
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
    </article>
  );
}
