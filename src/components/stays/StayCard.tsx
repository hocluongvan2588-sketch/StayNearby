import Link from 'next/link';
import { formatVnd } from '@/lib/format';
import { formatMoneyFromVnd } from '@/lib/i18n/currency';
import { getUserMessages } from '@/lib/i18n/messages';
import type { SupportedCurrency, UserLocale } from '@/lib/i18n/types';
import type { PublicStayCard } from '@/modules/catalog';
import { FallbackImage } from '@/components/ui/FallbackImage';
import { StatusBadge } from '@/components/ui/StatusBadge';

interface StayCardProps {
  stay: PublicStayCard;
  selectedDates?: {
    checkIn: string;
    checkOut: string;
    guests?: number;
  } | null;
  locale?: UserLocale;
  currency?: SupportedCurrency;
}

export function StayCard({
  stay,
  selectedDates,
  locale = 'en',
  currency = 'VND',
}: StayCardProps) {
  const t = getUserMessages(locale);

  const detailParams = new URLSearchParams();
  if (selectedDates?.checkIn && selectedDates?.checkOut) {
    detailParams.set('checkIn', selectedDates.checkIn);
    detailParams.set('checkOut', selectedDates.checkOut);
  }
  if (selectedDates?.guests && selectedDates.guests > 1) {
    detailParams.set('guests', String(selectedDates.guests));
  }
  const href = detailParams.toString()
    ? `/stays/${stay.slug}?${detailParams.toString()}`
    : `/stays/${stay.slug}`;

  const title = locale === 'vi' ? stay.titleVi : stay.titleEn;
  const summary = locale === 'vi' ? stay.summaryVi : stay.summaryEn;
  const areaName = locale === 'vi' ? stay.areaNameVi : stay.areaNameEn;
  const cityName = locale === 'vi' ? stay.cityVi : stay.cityEn;
  const photoAlt =
    locale === 'vi'
      ? (stay.coverPhoto?.altTextVi ?? title)
      : (stay.coverPhoto?.altTextEn ?? title);

  const highlights: string[] = [];
  if (stay.declaredAmenities.includes('kitchen')) highlights.push(t.stayCard.kitchen);
  if (stay.declaredAmenities.includes('washer')) highlights.push(t.stayCard.washer);
  if (stay.hasDedicatedDesk || stay.declaredAmenities.includes('dedicated_desk')) {
    highlights.push(t.stayCard.workDesk);
  }
  if (stay.declaredAmenities.includes('wifi')) highlights.push(t.stayCard.wifi);

  return (
    <article className="group flex flex-col bg-[var(--color-surface)]">
      <Link href={href} className="block overflow-hidden rounded-[12px]">
        <FallbackImage
          src={stay.coverPhoto?.url}
          alt={photoAlt}
          fallbackLabel={t.stayCard.noPhotos}
          className="transition-transform duration-300 group-hover:scale-[1.015]"
        />
      </Link>

      <div className="pt-3.5 flex-1 flex flex-col justify-between gap-2.5">
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2 text-xs text-[var(--color-text-muted)]">
            <span className="truncate font-medium">
              {areaName}, {cityName}
            </span>
            <span className="shrink-0">{t.propertyTypes[stay.propertyType]}</span>
          </div>

          <h3 className="text-[16px] font-semibold leading-snug tracking-[-0.01em] text-[var(--color-text)]">
            <Link
              href={href}
              className="hover:text-[var(--color-primary)] transition-colors"
            >
              {title}
            </Link>
          </h3>

          <p className="text-[13px] text-[var(--color-text-muted)] line-clamp-1">
            {highlights.length > 0 ? highlights.join(', ') : summary}
            {stay.lateCheckinAvailable ? ` — ${t.stayCard.lateCheckinShort}` : ''}
          </p>
        </div>

        <div className="pt-2 border-t border-[var(--color-hairline)] flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <p className="text-[15px] font-semibold text-[var(--color-text)] tabular-nums">
              {formatMoneyFromVnd(stay.baseNightlyRateVnd, currency, locale)}{' '}
              <span className="text-xs font-normal text-[var(--color-text-muted)]">
                {t.stayCard.perNight}
              </span>
            </p>
            {currency !== 'VND' && (
              <p className="text-[11px] text-[var(--color-text-muted)] tabular-nums">
                {t.stayCard.exactVndPrefix} {formatVnd(stay.baseNightlyRateVnd, locale)}
              </p>
            )}
            {stay.stayTotalVnd !== null && stay.nightsCount !== null && (
              <p className="text-xs font-medium text-[var(--color-primary)] tabular-nums mt-0.5">
                {t.stayCard.totalPrefix} ({stay.nightsCount}{' '}
                {stay.nightsCount === 1
                  ? t.stayCard.nightSingular
                  : t.stayCard.nightPlural}
                ): {formatMoneyFromVnd(stay.stayTotalVnd, currency, locale)}
              </p>
            )}
          </div>
          {stay.isDemo && <StatusBadge label={t.stayCard.demoBadge} tone="neutral" />}
        </div>
      </div>
    </article>
  );
}
