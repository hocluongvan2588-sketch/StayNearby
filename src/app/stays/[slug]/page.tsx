import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeft,
  Bike,
  Check,
  Clock,
  Coffee,
  Laptop,
  Lock,
  MapPin,
  Shirt,
  Trees,
  Users,
  Utensils,
  Wifi,
  Wind,
  type LucideIcon,
} from 'lucide-react';
import { getUserMessages } from '@/lib/i18n/messages';
import { getServerUserPreferences } from '@/lib/i18n/preferences';
import { getPublishedStayBySlug } from '@/modules/catalog';
import { getNeighborhoodDayPreview } from '@/modules/local-guides';
import { StayGallery } from '@/components/stays/StayGallery';
import { QuoteWidget } from '@/components/stays/QuoteWidget';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { NeighborhoodDayPreviewSection } from '@/components/local-guides/NeighborhoodDayPreviewSection';

export const dynamic = 'force-dynamic';

const AMENITY_ICONS: Record<string, LucideIcon> = {
  Wifi,
  Laptop,
  Wind,
  Shirt,
  Utensils,
  Coffee,
  Trees,
  Bike,
};

interface StayDetailPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default async function StayDetailPage({
  params,
  searchParams,
}: StayDetailPageProps) {
  const [{ slug }, sp, prefs] = await Promise.all([
    params,
    searchParams,
    getServerUserPreferences(),
  ]);
  const stay = await getPublishedStayBySlug(slug);
  if (!stay) {
    notFound();
  }

  const neighborhoodPreview = await getNeighborhoodDayPreview(stay.areaSlug);

  const locale = prefs.locale;
  const t = getUserMessages(locale);

  const initialCheckIn = firstParam(sp.checkIn);
  const initialCheckOut = firstParam(sp.checkOut);
  const initialGuestsRaw = firstParam(sp.guests);
  const initialGuests = initialGuestsRaw
    ? Number.parseInt(initialGuestsRaw, 10)
    : undefined;

  const title = locale === 'vi' ? stay.titleVi : stay.titleEn;
  const description = locale === 'vi' ? stay.descriptionVi : stay.descriptionEn;
  const areaName = locale === 'vi' ? stay.areaNameVi : stay.areaNameEn;
  const cityName = locale === 'vi' ? stay.cityVi : stay.cityEn;
  const areaVibe = locale === 'vi' ? stay.areaVibeVi : stay.areaVibeEn;
  const walkabilityNote =
    locale === 'vi' ? stay.walkabilityNoteVi : stay.walkabilityNoteEn;
  const workspaceNotes =
    locale === 'vi' ? stay.workspaceNotesVi : stay.workspaceNotesEn;
  const checkinConditions =
    locale === 'vi' ? stay.checkinConditionsVi : stay.checkinConditionsEn;
  const houseRules = locale === 'vi' ? stay.houseRulesVi : stay.houseRulesEn;

  return (
    <div className="container-stay pt-8 pb-28 lg:pb-16 space-y-8">
      <div>
        <Link
          href="/stays"
          className="inline-flex items-center gap-2 min-h-[44px] px-3 -ml-3 rounded-[12px] text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>{t.stayDetail.backToAll}</span>
        </Link>
      </div>

      {/* Editorial Header */}
      <div className="space-y-3 max-w-4xl">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-primary)]">
            <MapPin className="w-4 h-4" aria-hidden="true" />
            <span>
              {areaName}, {cityName}
            </span>
          </span>
          {stay.isDemo && <StatusBadge label={t.stayDetail.demoData} tone="neutral" />}
        </div>

        <h1 className="page-title">{title}</h1>

        <p className="text-[15px] text-[var(--color-text-muted)]">
          {t.stayDetail.hostedBy}{' '}
          <strong className="text-[var(--color-text)]">{stay.hostDisplayName}</strong>
          {' — '}
          {locale === 'vi'
            ? `Tối đa ${stay.maxGuests} ${t.stayDetail.guestsWord}, ${stay.bedrooms} ${t.stayDetail.bedroomSingular}, ${stay.beds} ${t.stayDetail.bedSingular}, ${stay.bathrooms} ${t.stayDetail.bathWord}. ${t.stayDetail.timezoneLabel}: ${stay.timezone}.`
            : `Up to ${stay.maxGuests} ${t.stayDetail.guestsWord}, ${stay.bedrooms} ${stay.bedrooms === 1 ? t.stayDetail.bedroomSingular : t.stayDetail.bedroomPlural}, ${stay.beds} ${stay.beds === 1 ? t.stayDetail.bedSingular : t.stayDetail.bedPlural}, ${stay.bathrooms} ${t.stayDetail.bathWord}. ${t.stayDetail.timezoneLabel}: ${stay.timezone}.`}
        </p>
      </div>

      {/* Two-column showcase layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-start">
        <div className="lg:col-span-7 space-y-10">
          <StayGallery photos={stay.photos} stayTitle={title} />

          {/* Multi-week & remote stay summary */}
          <section className="pt-8 border-t border-[var(--color-hairline)] space-y-4">
            <h2 className="section-title">{t.stayDetail.designedTitle}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-[var(--color-primary)] shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <p className="font-semibold text-[var(--color-text)]">
                    {stay.lateCheckinAvailable
                      ? t.stayDetail.lateCheckinSupported
                      : t.stayDetail.standardCheckinWindow}
                  </p>
                  <p className="text-[var(--color-text-muted)] mt-0.5">
                    {checkinConditions || t.stayDetail.defaultCheckinNote}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Users className="w-5 h-5 text-[var(--color-primary)] shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <p className="font-semibold text-[var(--color-text)]">
                    {t.stayDetail.stayDuration(stay.minNights, stay.maxNights)}
                  </p>
                  <p className="text-[var(--color-text-muted)] mt-0.5">
                    {t.stayDetail.suitableForGuests(stay.maxGuests)}
                  </p>
                </div>
              </div>
            </div>

            {workspaceNotes && (
              <p className="text-sm text-[var(--color-text-muted)] pt-1">
                {workspaceNotes}
              </p>
            )}
          </section>

          {/* Description */}
          <section className="pt-8 border-t border-[var(--color-hairline)] space-y-3">
            <h2 className="section-title">{t.stayDetail.aboutHome}</h2>
            <p className="text-[15px] leading-relaxed text-[var(--color-text)]">
              {description}
            </p>
          </section>

          {/* Neighborhood context */}
          {(areaVibe || walkabilityNote) && (
            <section className="pt-8 border-t border-[var(--color-hairline)] space-y-3">
              <h2 className="section-title">{t.stayDetail.neighborhoodWalkability}</h2>
              <div className="rounded-[12px] bg-[var(--color-surface-ivory)] border border-[var(--color-hairline)] p-5 space-y-1.5 text-sm">
                <p className="font-semibold text-[var(--color-text)]">
                  {areaName}, {cityName}
                  {areaVibe ? ` — ${areaVibe}` : ''}
                </p>
                {walkabilityNote && (
                  <p className="text-[var(--color-text-muted)]">{walkabilityNote}</p>
                )}
              </div>
            </section>
          )}

          {/* Moment 1: Pre-booking neighborhood day preview (only when published content exists) */}
          {neighborhoodPreview && (
            <NeighborhoodDayPreviewSection preview={neighborhoodPreview} />
          )}

          {/* Host-declared amenities */}
          <section className="pt-8 border-t border-[var(--color-hairline)] space-y-4">
            <div>
              <h2 className="section-title">{t.stayDetail.hostDeclaredAmenities}</h2>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">
                {t.stayDetail.amenitiesNote}
              </p>
            </div>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {stay.amenities.map((amenity) => {
                const Icon = AMENITY_ICONS[amenity.iconName] ?? Check;
                return (
                  <li
                    key={amenity.code}
                    className="flex items-center gap-3 p-3.5 rounded-[12px] border border-[var(--color-hairline)] bg-[var(--color-surface)] text-sm text-[var(--color-text)]"
                  >
                    <Icon
                      className="w-5 h-5 text-[var(--color-primary)] shrink-0"
                      aria-hidden="true"
                    />
                    <span>{locale === 'vi' ? amenity.labelVi : amenity.labelEn}</span>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* House Rules */}
          {houseRules.length > 0 && (
            <section className="pt-8 border-t border-[var(--color-hairline)] space-y-3">
              <h2 className="section-title">{t.stayDetail.houseRules}</h2>
              <ul className="space-y-2.5 text-[15px] text-[var(--color-text)]">
                {houseRules.map((rule, idx) => (
                  <li key={idx} className="flex items-start gap-2.5">
                    <Check
                      className="w-5 h-5 text-[var(--color-primary)] shrink-0 mt-0.5"
                      aria-hidden="true"
                    />
                    <span>{rule}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Location privacy & availability */}
          <section className="pt-8 border-t border-[var(--color-hairline)] space-y-4">
            <h2 className="section-title">{t.stayDetail.locationNotes}</h2>
            <div className="rounded-[12px] border border-[var(--color-hairline)] bg-[var(--color-surface)] p-4 flex items-start gap-3">
              <Lock className="w-5 h-5 text-[var(--color-primary)] shrink-0 mt-0.5" aria-hidden="true" />
              <div className="text-sm space-y-1">
                <p className="font-medium text-[var(--color-text)]">
                  {t.stayDetail.areaLabel}: {areaName}, {cityName}
                </p>
                <p className="text-[var(--color-text-muted)]">
                  {t.stayDetail.privacyExplanation}
                </p>
              </div>
            </div>

            {stay.upcomingBlockedDates.length > 0 && (
              <div className="rounded-[12px] border border-[var(--color-hairline)] bg-[var(--color-surface)] p-4 text-sm space-y-1.5">
                <p className="font-medium text-[var(--color-text)]">
                  {t.stayDetail.upcomingUnavailable}
                </p>
                <p className="text-xs text-[var(--color-text-muted)] tabular-nums">
                  {stay.upcomingBlockedDates.join(', ')}
                </p>
              </div>
            )}
          </section>
        </div>

        {/* Right sticky quote column */}
        <div className="lg:col-span-5 lg:sticky lg:top-8">
          <QuoteWidget
            listingId={stay.id}
            listingSlug={stay.slug}
            timezone={stay.timezone}
            maxGuests={stay.maxGuests}
            minNights={stay.minNights}
            maxNights={stay.maxNights}
            baseNightlyRateVnd={stay.baseNightlyRateVnd}
            cleaningFeeVnd={stay.cleaningFeeVnd}
            paymentTerms={stay.paymentTerms}
            cancellationTitleEn={stay.cancellationPolicy.titleEn}
            cancellationTitleVi={stay.cancellationPolicy.titleVi}
            initialCheckIn={initialCheckIn}
            initialCheckOut={initialCheckOut}
            initialGuests={
              initialGuests && Number.isFinite(initialGuests)
                ? initialGuests
                : undefined
            }
          />
        </div>
      </div>
    </div>
  );
}
