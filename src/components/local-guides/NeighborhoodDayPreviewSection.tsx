'use client';

import Link from 'next/link';
import {
  ArrowRight,
  Clock,
  Compass,
  ExternalLink,
  Headphones,
  MapPin,
  Ticket,
} from 'lucide-react';
import { formatMoneyFromVnd } from '@/lib/i18n/currency';
import { getUserMessages } from '@/lib/i18n/messages';
import { useUserPreferences } from '@/components/i18n/UserPreferencesProvider';
import { FallbackImage } from '@/components/ui/FallbackImage';
import type { NeighborhoodDayPreview } from '@/modules/local-guides';

interface NeighborhoodDayPreviewSectionProps {
  preview: NeighborhoodDayPreview;
}

export function NeighborhoodDayPreviewSection({
  preview,
}: NeighborhoodDayPreviewSectionProps) {
  const { preferences } = useUserPreferences();
  const locale = preferences.locale;
  const currency = preferences.currency;
  const t = getUserMessages(locale);

  const areaName = locale === 'vi' ? preview.areaNameVi : preview.areaNameEn;

  return (
    <section
      aria-labelledby="neighborhood-day-heading"
      className="pt-8 border-t border-[var(--color-hairline)] space-y-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--color-primary)]">
            <Compass className="w-4 h-4" aria-hidden="true" />
            <span>{areaName}</span>
          </div>
          <h2 id="neighborhood-day-heading" className="section-title">
            {t.localGuides.sectionTitlePreBooking}
          </h2>
          <p className="text-sm text-[var(--color-text-muted)]">
            {t.localGuides.sectionSubtitlePreBooking}
          </p>
        </div>

        <Link
          href={`/explore/${preview.areaSlug}`}
          className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] text-sm font-medium text-[var(--color-primary)] hover:border-[var(--color-primary)] transition-colors"
        >
          <span>{t.localGuides.viewAllGuidesForArea(areaName)}</span>
          <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </Link>
      </div>

      {preview.guides.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {preview.guides.slice(0, 2).map((guide) => {
            const title = locale === 'vi' ? guide.titleVi : guide.titleEn;
            const summary = locale === 'vi' ? guide.summaryVi : guide.summaryEn;
            const verifiedDate = guide.verifiedAt.slice(0, 10);

            return (
              <Link
                key={guide.id}
                href={`/explore/${preview.areaSlug}?theme=${guide.theme}`}
                className="group rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden flex flex-col hover:border-[var(--color-primary)] transition-colors"
              >
                <div className="aspect-[16/9] bg-[var(--color-surface-muted)] overflow-hidden">
                  <FallbackImage
                    src={guide.coverImagePath}
                    alt={title}
                    fallbackLabel={areaName}
                  />
                </div>
                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-primary)]">
                      <span>{t.localGuides.themes[guide.theme]}</span>
                      <span aria-hidden="true">·</span>
                      <span className="inline-flex items-center gap-1 text-[var(--color-text-muted)]">
                        <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                        {t.localGuides.durations[guide.durationBucket]}
                      </span>
                    </div>
                    <h3 className="text-[15px] font-semibold text-[var(--color-text)] group-hover:text-[var(--color-primary)] transition-colors">
                      {title}
                    </h3>
                    <p className="text-xs text-[var(--color-text-muted)] line-clamp-2">
                      {summary}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-[var(--color-hairline)] flex items-center justify-between gap-2 text-xs">
                    <span className="font-medium text-[var(--color-text)] tabular-nums">
                      ~{formatMoneyFromVnd(guide.estimatedTotalVnd, currency, locale)}
                    </span>
                    <span className="text-[11px] text-[var(--color-text-muted)]">
                      {verifiedDate}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {preview.nearbyCoworking.length > 0 && (
        <div className="rounded-[12px] border border-[var(--color-hairline)] bg-[var(--color-surface-ivory)] p-5 space-y-3">
          <h3 className="text-sm font-semibold text-[var(--color-text)] flex items-center gap-2">
            <Headphones className="w-4 h-4 text-[var(--color-primary)]" aria-hidden="true" />
            <span>{t.localGuides.coworkingTitle}</span>
          </h3>

          <div className="grid grid-cols-1 gap-3">
            {preview.nearbyCoworking.map((spot) => {
              const spotName = locale === 'vi' ? spot.nameVi : spot.nameEn;
              const spotDesc =
                locale === 'vi' ? spot.shortDescriptionVi : spot.shortDescriptionEn;
              const coworkNotes =
                locale === 'vi' ? spot.coworkingNotesVi : spot.coworkingNotesEn;

              return (
                <div
                  key={spot.id}
                  className="rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-2 text-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-[var(--color-text)]">{spotName}</p>
                      <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                        {spotDesc}
                      </p>
                    </div>
                    <span className="text-xs font-medium text-[var(--color-text)] tabular-nums">
                      {formatMoneyFromVnd(spot.estimatedCostVnd, currency, locale)}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border ${
                        spot.hasVideoCallBooths
                          ? 'bg-[var(--color-primary-soft)] border-[#C4DCD2] text-[var(--color-primary)] font-medium'
                          : 'bg-[var(--color-surface-muted)] border-[var(--color-hairline)] text-[var(--color-text-muted)]'
                      }`}
                    >
                      <Headphones className="w-3.5 h-3.5" aria-hidden="true" />
                      {spot.hasVideoCallBooths
                        ? t.localGuides.videoBoothsAvailable
                        : t.localGuides.noVideoBooths}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[var(--color-surface-muted)] border border-[var(--color-hairline)] text-[var(--color-text-muted)]">
                      <Ticket className="w-3.5 h-3.5" aria-hidden="true" />
                      {spot.bookingRequired
                        ? t.localGuides.bookingRequiredBadge
                        : t.localGuides.walkInBadge}
                    </span>
                  </div>

                  {coworkNotes && (
                    <p className="text-xs text-[var(--color-text-muted)]">{coworkNotes}</p>
                  )}

                  <div className="flex flex-wrap items-center gap-4 pt-1 text-xs font-medium">
                    <a
                      href={spot.mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[var(--color-primary)] hover:underline underline-offset-4"
                    >
                      <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>{t.localGuides.openGoogleMaps}</span>
                      <ExternalLink className="w-3 h-3" aria-hidden="true" />
                    </a>
                    {spot.partnerBookingUrl && (
                      <a
                        href={spot.partnerBookingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[var(--color-text)] hover:text-[var(--color-primary)] hover:underline underline-offset-4"
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
        </div>
      )}
    </section>
  );
}
