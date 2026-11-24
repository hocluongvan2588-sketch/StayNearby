'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  Clock,
  Compass,
  ExternalLink,
  Headphones,
  MapPin,
  QrCode,
  ShieldCheck,
  Ticket,
  Users,
} from 'lucide-react';
import { formatVnd } from '@/lib/format';
import { formatMoneyFromVnd } from '@/lib/i18n/currency';
import { getUserMessages } from '@/lib/i18n/messages';
import { useUserPreferences } from '@/components/i18n/UserPreferencesProvider';
import { FallbackImage } from '@/components/ui/FallbackImage';
import type {
  ExploreAreaOption,
  LocalGuideBudgetTier,
  LocalGuideCompanion,
  LocalGuideDurationBucket,
  LocalGuideSummary,
  LocalGuideTheme,
  NearbyCoworkingPlace,
} from '@/modules/local-guides';

interface ExploreAreaClientProps {
  area: ExploreAreaOption;
  areas: ExploreAreaOption[];
  initialGuides: LocalGuideSummary[];
  nearbyCoworking: NearbyCoworkingPlace[];
  initialFilters: {
    theme?: LocalGuideTheme;
    durationBucket?: LocalGuideDurationBucket;
    budgetTier?: LocalGuideBudgetTier;
    companion?: LocalGuideCompanion;
  };
  qrPath: string;
  qrSvg: string;
}

const THEMES: LocalGuideTheme[] = ['food', 'culture', 'leisure', 'coworking'];
const DURATIONS: LocalGuideDurationBucket[] = ['1_2_hours', 'half_day'];
const BUDGETS: LocalGuideBudgetTier[] = ['budget', 'moderate', 'splurge'];
const COMPANIONS: LocalGuideCompanion[] = ['solo', 'group'];

export function ExploreAreaClient({
  area,
  areas,
  initialGuides,
  nearbyCoworking,
  initialFilters,
  qrPath,
  qrSvg,
}: ExploreAreaClientProps) {
  const router = useRouter();
  const { preferences } = useUserPreferences();
  const locale = preferences.locale;
  const currency = preferences.currency;
  const t = getUserMessages(locale);

  const [guides, setGuides] = useState<LocalGuideSummary[]>(initialGuides);
  const [filters, setFilters] = useState(initialFilters);
  const [loading, setLoading] = useState(false);

  const areaName = locale === 'vi' ? area.nameVi : area.nameEn;
  const cityName = locale === 'vi' ? area.cityVi : area.cityEn;
  const areaVibe = locale === 'vi' ? area.vibeSummaryVi : area.vibeSummaryEn;
  const walkability = locale === 'vi' ? area.walkabilityNoteVi : area.walkabilityNoteEn;

  async function applyFilters(nextFilters: typeof filters) {
    setFilters(nextFilters);
    setLoading(true);
    try {
      const sp = new URLSearchParams();
      if (nextFilters.theme) sp.set('theme', nextFilters.theme);
      if (nextFilters.durationBucket) sp.set('durationBucket', nextFilters.durationBucket);
      if (nextFilters.budgetTier) sp.set('budgetTier', nextFilters.budgetTier);
      if (nextFilters.companion) sp.set('companion', nextFilters.companion);

      const queryStr = sp.toString();
      const targetPageUrl = queryStr
        ? `/explore/${area.slug}?${queryStr}`
        : `/explore/${area.slug}`;
      router.replace(targetPageUrl, { scroll: false });

      const res = await fetch(
        queryStr ? `/api/explore/${area.slug}?${queryStr}` : `/api/explore/${area.slug}`
      );
      if (res.ok) {
        const payload = (await res.json()) as { guides?: LocalGuideSummary[] };
        if (payload.guides) {
          setGuides(payload.guides);
        }
      }
    } finally {
      setLoading(false);
    }
  }

  function clearAllFilters() {
    void applyFilters({});
  }

  const hasActiveFilters = Boolean(
    filters.theme || filters.durationBucket || filters.budgetTier || filters.companion
  );

  return (
    <div className="container-stay py-10 md:py-12 space-y-8">
      {/* Header + Area switcher */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-3xl">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary)] text-xs font-semibold">
              <Compass className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{t.localGuides.curatedBadge}</span>
            </span>
            <h1 className="page-title">
              {areaName}, {cityName}
            </h1>
            <p className="text-[15px] text-[var(--color-text-muted)]">
              {areaVibe} — {walkability}
            </p>
          </div>

          <Link
            href={`/stays?area=${encodeURIComponent(area.slug)}`}
            className="inline-flex items-center justify-center min-h-[44px] px-5 rounded-[12px] bg-[var(--color-primary)] text-white text-sm font-medium hover:bg-[var(--color-primary-hover)] transition-colors"
          >
            {t.localGuides.browseStaysInArea(areaName)}
          </Link>
        </div>

        {/* Area Switcher */}
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)] mr-1">
            {t.localGuides.switchAreaLabel}:
          </span>
          {areas.map((opt) => {
            const active = opt.slug === area.slug;
            const optName = locale === 'vi' ? opt.nameVi : opt.nameEn;
            return (
              <Link
                key={opt.id}
                href={`/explore/${opt.slug}`}
                className={`inline-flex items-center min-h-[38px] px-3.5 rounded-full text-sm font-medium transition-colors border ${
                  active
                    ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]'
                    : 'bg-[var(--color-surface)] text-[var(--color-text)] border-[var(--color-border)] hover:border-[var(--color-primary)]'
                }`}
              >
                {optName}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Filter Bar */}
      <section
        aria-label="Guide filters"
        className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-4"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <label
              htmlFor="guide-filter-theme"
              className="block text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]"
            >
              {t.localGuides.filterThemeLabel}
            </label>
            <select
              id="guide-filter-theme"
              value={filters.theme ?? ''}
              onChange={(e) =>
                void applyFilters({
                  ...filters,
                  theme: (e.target.value || undefined) as LocalGuideTheme | undefined,
                })
              }
              className="w-full min-h-[44px] px-3 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text)]"
            >
              <option value="">{t.localGuides.allFilter}</option>
              {THEMES.map((themeKey) => (
                <option key={themeKey} value={themeKey}>
                  {t.localGuides.themes[themeKey]}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="guide-filter-duration"
              className="block text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]"
            >
              {t.localGuides.filterDurationLabel}
            </label>
            <select
              id="guide-filter-duration"
              value={filters.durationBucket ?? ''}
              onChange={(e) =>
                void applyFilters({
                  ...filters,
                  durationBucket: (e.target.value || undefined) as
                    | LocalGuideDurationBucket
                    | undefined,
                })
              }
              className="w-full min-h-[44px] px-3 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text)]"
            >
              <option value="">{t.localGuides.allFilter}</option>
              {DURATIONS.map((dKey) => (
                <option key={dKey} value={dKey}>
                  {t.localGuides.durations[dKey]}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="guide-filter-budget"
              className="block text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]"
            >
              {t.localGuides.filterBudgetLabel}
            </label>
            <select
              id="guide-filter-budget"
              value={filters.budgetTier ?? ''}
              onChange={(e) =>
                void applyFilters({
                  ...filters,
                  budgetTier: (e.target.value || undefined) as
                    | LocalGuideBudgetTier
                    | undefined,
                })
              }
              className="w-full min-h-[44px] px-3 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text)]"
            >
              <option value="">{t.localGuides.allFilter}</option>
              {BUDGETS.map((bKey) => (
                <option key={bKey} value={bKey}>
                  {t.localGuides.budgets[bKey]}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="guide-filter-companion"
              className="block text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]"
            >
              {t.localGuides.filterCompanionLabel}
            </label>
            <select
              id="guide-filter-companion"
              value={filters.companion ?? ''}
              onChange={(e) =>
                void applyFilters({
                  ...filters,
                  companion: (e.target.value || undefined) as
                    | LocalGuideCompanion
                    | undefined,
                })
              }
              className="w-full min-h-[44px] px-3 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text)]"
            >
              <option value="">{t.localGuides.allFilter}</option>
              {COMPANIONS.map((cKey) => (
                <option key={cKey} value={cKey}>
                  {t.localGuides.companions[cKey]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--color-text-muted)]">
          <span>{t.localGuides.limitNote(guides.length)}</span>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="font-medium text-[var(--color-primary)] hover:underline underline-offset-4"
            >
              {t.localGuides.relaxFiltersButton}
            </button>
          )}
        </div>
      </section>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Guides column */}
        <div className="lg:col-span-8 space-y-6">
          {loading ? (
            <div className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center text-sm text-[var(--color-text-muted)]">
              ...
            </div>
          ) : guides.length === 0 ? (
            <div className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center space-y-3">
              <h2 className="text-base font-semibold text-[var(--color-text)]">
                {t.localGuides.emptyGuidesTitle}
              </h2>
              <p className="text-sm text-[var(--color-text-muted)] max-w-md mx-auto">
                {t.localGuides.emptyGuidesBody}
              </p>
              <button
                type="button"
                onClick={clearAllFilters}
                className="inline-flex items-center justify-center min-h-[44px] px-5 rounded-[12px] bg-[var(--color-primary)] text-white text-sm font-medium hover:bg-[var(--color-primary-hover)] transition-colors"
              >
                {t.localGuides.relaxFiltersButton}
              </button>
            </div>
          ) : (
            guides.map((guide) => {
              const title = locale === 'vi' ? guide.titleVi : guide.titleEn;
              const summary = locale === 'vi' ? guide.summaryVi : guide.summaryEn;
              const directions =
                locale === 'vi'
                  ? guide.directionsSummaryVi
                  : guide.directionsSummaryEn;
              const verifiedDate = guide.verifiedAt.slice(0, 10);

              return (
                <article
                  key={guide.id}
                  className="rounded-[14px] border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden"
                >
                  {guide.coverImagePath && (
                    <div className="aspect-[16/8] bg-[var(--color-surface-muted)] overflow-hidden">
                      <FallbackImage
                        src={guide.coverImagePath}
                        alt={title}
                        fallbackLabel={areaName}
                      />
                    </div>
                  )}

                  <div className="p-6 space-y-5">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
                        <span className="px-2.5 py-1 rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
                          {t.localGuides.themes[guide.theme]}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[var(--color-surface-muted)] text-[var(--color-text)]">
                          <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                          {t.localGuides.durations[guide.durationBucket]}
                        </span>
                        <span className="px-2.5 py-1 rounded-full bg-[var(--color-surface-muted)] text-[var(--color-text)]">
                          {t.localGuides.budgets[guide.budgetTier]}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]">
                          <Users className="w-3.5 h-3.5" aria-hidden="true" />
                          {guide.suitableSolo && guide.suitableGroup
                            ? `${t.localGuides.companions.solo} / ${t.localGuides.companions.group}`
                            : guide.suitableSolo
                              ? t.localGuides.companions.solo
                              : t.localGuides.companions.group}
                        </span>
                      </div>

                      <h2 className="text-xl font-semibold text-[var(--color-text)]">
                        {title}
                      </h2>
                      <p className="text-sm leading-relaxed text-[var(--color-text-muted)]">
                        {summary}
                      </p>

                      {directions && (
                        <p className="text-xs text-[var(--color-text)] bg-[var(--color-surface-ivory)] border border-[var(--color-hairline)] rounded-[10px] px-3.5 py-2.5">
                          <strong>{t.localGuides.directionsLabel}</strong> {directions}
                        </p>
                      )}
                    </div>

                    {/* Stops Timeline */}
                    <div className="space-y-3 pt-2 border-t border-[var(--color-hairline)]">
                      <h3 className="text-sm font-semibold text-[var(--color-text)]">
                        {t.localGuides.stopsHeading} ({guide.stops.length})
                      </h3>

                      <ol className="space-y-3">
                        {guide.stops.map((stop) => {
                          const stopName =
                            locale === 'vi' ? stop.placeNameVi : stop.placeNameEn;
                          const stopDesc =
                            locale === 'vi'
                              ? stop.shortDescriptionVi
                              : stop.shortDescriptionEn;
                          const stopRecs =
                            locale === 'vi'
                              ? stop.recommendedItemsVi
                              : stop.recommendedItemsEn;
                          const stopNotes =
                            locale === 'vi' ? stop.localNotesVi : stop.localNotesEn;
                          const stopDirections =
                            locale === 'vi'
                              ? stop.directionsNoteVi
                              : stop.directionsNoteEn;
                          const stopCowork =
                            locale === 'vi'
                              ? stop.coworkingNotesVi
                              : stop.coworkingNotesEn;

                          return (
                            <li
                              key={`${guide.id}-${stop.stopOrder}`}
                              className="rounded-[12px] border border-[var(--color-hairline)] bg-[var(--color-surface-ivory)] p-4 space-y-2 text-sm"
                            >
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div>
                                  <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-primary)]">
                                    {t.localGuides.stopPrefix(stop.stopOrder)}
                                  </span>
                                  <h4 className="font-semibold text-[var(--color-text)]">
                                    {stopName}
                                  </h4>
                                </div>
                                <div className="text-right text-xs tabular-nums text-[var(--color-text-muted)]">
                                  <p className="font-medium text-[var(--color-text)]">
                                    {formatMoneyFromVnd(
                                      stop.estimatedCostVnd,
                                      currency,
                                      locale
                                    )}
                                  </p>
                                  {stop.durationMinutes !== null && (
                                    <p>
                                      {stop.durationMinutes} {t.localGuides.minutesUnit}
                                    </p>
                                  )}
                                </div>
                              </div>

                              <p className="text-xs text-[var(--color-text-muted)]">
                                {stopDesc}
                              </p>

                              {stop.theme === 'coworking' && (
                                <div className="flex flex-wrap gap-2 text-xs">
                                  <span
                                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border ${
                                      stop.hasVideoCallBooths
                                        ? 'bg-[var(--color-primary-soft)] border-[#C4DCD2] text-[var(--color-primary)] font-medium'
                                        : 'bg-[var(--color-surface)] border-[var(--color-hairline)] text-[var(--color-text-muted)]'
                                    }`}
                                  >
                                    <Headphones className="w-3.5 h-3.5" aria-hidden="true" />
                                    {stop.hasVideoCallBooths
                                      ? t.localGuides.videoBoothsAvailable
                                      : t.localGuides.noVideoBooths}
                                  </span>
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[var(--color-surface)] border border-[var(--color-hairline)] text-[var(--color-text-muted)]">
                                    <Ticket className="w-3.5 h-3.5" aria-hidden="true" />
                                    {stop.bookingRequired
                                      ? t.localGuides.bookingRequiredBadge
                                      : t.localGuides.walkInBadge}
                                  </span>
                                </div>
                              )}

                              {stopCowork && (
                                <p className="text-xs text-[var(--color-text-muted)]">
                                  {stopCowork}
                                </p>
                              )}

                              {stopRecs && (
                                <p className="text-xs text-[var(--color-text)]">
                                  <strong>{t.localGuides.recommendedItemsLabel}</strong>{' '}
                                  {stopRecs}
                                </p>
                              )}

                              {(stopDirections || stopNotes) && (
                                <p className="text-xs text-[var(--color-text-muted)]">
                                  {stopDirections || stopNotes}
                                </p>
                              )}

                              <div className="flex flex-wrap items-center gap-4 pt-1 text-xs font-medium">
                                <a
                                  href={stop.mapsUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-[var(--color-primary)] hover:underline underline-offset-4"
                                >
                                  <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
                                  <span>{t.localGuides.openGoogleMaps}</span>
                                  <ExternalLink className="w-3 h-3" aria-hidden="true" />
                                </a>
                                {stop.partnerBookingUrl && (
                                  <a
                                    href={stop.partnerBookingUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-[var(--color-text)] hover:text-[var(--color-primary)] hover:underline underline-offset-4"
                                  >
                                    <span>{t.localGuides.bookPartnerPass}</span>
                                    <ExternalLink className="w-3 h-3" aria-hidden="true" />
                                  </a>
                                )}
                              </div>
                            </li>
                          );
                        })}
                      </ol>
                    </div>

                    {/* Footer: Total + Source Attribution */}
                    <div className="pt-3 border-t border-[var(--color-hairline)] flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div className="inline-flex items-center gap-1.5 text-[var(--color-text-muted)]">
                        <ShieldCheck
                          className="w-4 h-4 text-[var(--color-primary)] shrink-0"
                          aria-hidden="true"
                        />
                        <span>
                          {t.localGuides.sourceVerifiedLabel(guide.source, verifiedDate)}
                        </span>
                      </div>

                      <div className="text-right">
                        <span className="text-[var(--color-text-muted)] mr-2">
                          {t.localGuides.estimatedTotalLabel}:
                        </span>
                        <span className="font-semibold text-[var(--color-text)] tabular-nums">
                          {formatMoneyFromVnd(guide.estimatedTotalVnd, currency, locale)}
                        </span>
                        {currency !== 'VND' && (
                          <span className="ml-2 text-[var(--color-text-muted)] tabular-nums">
                            ({formatVnd(guide.estimatedTotalVnd, locale)})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>

        {/* Right Sidebar: Coworking Directory & Public QR */}
        <aside className="lg:col-span-4 space-y-6">
          {nearbyCoworking.length > 0 && (
            <section className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-4">
              <h2 className="text-base font-semibold text-[var(--color-text)] flex items-center gap-2">
                <Headphones
                  className="w-4 h-4 text-[var(--color-primary)] shrink-0"
                  aria-hidden="true"
                />
                <span>{t.localGuides.coworkingTitle}</span>
              </h2>
              <div className="space-y-3">
                {nearbyCoworking.map((spot) => {
                  const spotName = locale === 'vi' ? spot.nameVi : spot.nameEn;
                  const spotNotes =
                    locale === 'vi' ? spot.coworkingNotesVi : spot.coworkingNotesEn;
                  return (
                    <div
                      key={spot.id}
                      className="rounded-[10px] border border-[var(--color-hairline)] bg-[var(--color-surface-ivory)] p-3.5 space-y-2 text-xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-[var(--color-text)] text-sm">
                          {spotName}
                        </p>
                        <span className="font-medium text-[var(--color-text)] tabular-nums">
                          {formatMoneyFromVnd(spot.estimatedCostVnd, currency, locale)}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <span className="px-2 py-0.5 rounded-full bg-[var(--color-surface)] border border-[var(--color-hairline)] text-[var(--color-text)]">
                          {spot.hasVideoCallBooths
                            ? t.localGuides.videoBoothsAvailable
                            : t.localGuides.noVideoBooths}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-[var(--color-surface)] border border-[var(--color-hairline)] text-[var(--color-text-muted)]">
                          {spot.bookingRequired
                            ? t.localGuides.bookingRequiredBadge
                            : t.localGuides.walkInBadge}
                        </span>
                      </div>
                      {spotNotes && (
                        <p className="text-[var(--color-text-muted)]">{spotNotes}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-3 pt-1 font-medium">
                        <a
                          href={spot.mapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[var(--color-primary)] hover:underline"
                        >
                          <span>{t.localGuides.openGoogleMaps}</span>
                          <ExternalLink className="w-3 h-3" aria-hidden="true" />
                        </a>
                        {spot.partnerBookingUrl && (
                          <a
                            href={spot.partnerBookingUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[var(--color-text)] hover:text-[var(--color-primary)] hover:underline"
                          >
                            <span>{t.localGuides.bookPartnerPass}</span>
                            <ExternalLink className="w-3 h-3" aria-hidden="true" />
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Clean Public QR Card */}
          <section className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-3 text-center">
            <div className="inline-flex items-center justify-center gap-1.5 text-sm font-semibold text-[var(--color-text)]">
              <QrCode className="w-4 h-4 text-[var(--color-primary)]" aria-hidden="true" />
              <span>{t.localGuides.qrCardTitle}</span>
            </div>
            <div
              className="mx-auto w-[168px] h-[168px] p-2 rounded-[10px] border border-[var(--color-hairline)] bg-white [&>svg]:w-full [&>svg]:h-full"
              dangerouslySetInnerHTML={{ __html: qrSvg }}
            />
            <p className="text-xs font-mono text-[var(--color-primary)]">{qrPath}</p>
            <p className="text-xs text-[var(--color-text-muted)]">
              {t.localGuides.qrCardBody}
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
