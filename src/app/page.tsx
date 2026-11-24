import Link from 'next/link';
import { ArrowRight, KeyRound, Laptop, MapPin, Wallet } from 'lucide-react';
import { getUserMessages } from '@/lib/i18n/messages';
import { getServerUserPreferences } from '@/lib/i18n/preferences';
import { listPublishedAreas, searchPublishedStays } from '@/modules/catalog';
import { SearchBar } from '@/components/stays/SearchBar';
import { StayCard } from '@/components/stays/StayCard';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const [prefs, areas, featured] = await Promise.all([
    getServerUserPreferences(),
    listPublishedAreas(),
    searchPublishedStays({ page: 1, pageSize: 8 }),
  ]);

  const t = getUserMessages(prefs.locale);

  return (
    <div className="bg-[var(--color-bg)]">
      {/* Apple-style airy hero & unified search */}
      <section className="container-stay pt-12 pb-10 md:pt-20 md:pb-14 space-y-10">
        <div className="max-w-3xl mx-auto text-center space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-primary)]">
            {t.home.eyebrow}
          </p>
          <h1 className="page-title">{t.home.heroTitle}</h1>
          <p className="text-[16px] md:text-[17px] text-[var(--color-text-muted)] max-w-2xl mx-auto leading-relaxed">
            {t.home.heroSubtitle}
          </p>
        </div>

        <div className="max-w-5xl mx-auto">
          <SearchBar areas={areas} />
        </div>
      </section>

      {/* Photography-first featured stays */}
      <section className="container-stay py-8 md:py-12 space-y-6 border-t border-[var(--color-hairline)]">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-1">
            <h2 className="section-title">{t.home.selectedStays}</h2>
            <p className="text-sm text-[var(--color-text-muted)]">
              {t.home.selectedStaysSubtitle}
            </p>
          </div>
          <Link
            href="/stays"
            className="inline-flex items-center gap-1.5 min-h-[44px] px-4 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] text-sm font-medium text-[var(--color-text)] hover:border-[var(--color-primary)] transition-colors"
          >
            <span>{t.home.exploreAllStays}</span>
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>
        </div>

        <div className="stays-grid">
          {featured.items.map((stay) => (
            <StayCard
              key={stay.id}
              stay={stay}
              locale={prefs.locale}
              currency={prefs.currency}
            />
          ))}
        </div>
      </section>

      {/* Subtle ivory editorial pillar band */}
      <section className="bg-[var(--color-surface-ivory)] border-y border-[var(--color-hairline)] my-8">
        <div className="container-stay py-12 md:py-16 grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-10">
          <div className="space-y-2">
            <Laptop className="w-5 h-5 text-[var(--color-primary)]" aria-hidden="true" />
            <h2 className="text-[16px] font-semibold text-[var(--color-text)]">
              {t.home.pillar1Title}
            </h2>
            <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
              {t.home.pillar1Body}
            </p>
          </div>

          <div className="space-y-2">
            <KeyRound className="w-5 h-5 text-[var(--color-primary)]" aria-hidden="true" />
            <h2 className="text-[16px] font-semibold text-[var(--color-text)]">
              {t.home.pillar2Title}
            </h2>
            <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
              {t.home.pillar2Body}
            </p>
          </div>

          <div className="space-y-2">
            <Wallet className="w-5 h-5 text-[var(--color-primary)]" aria-hidden="true" />
            <h2 className="text-[16px] font-semibold text-[var(--color-text)]">
              {t.home.pillar3Title}
            </h2>
            <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
              {t.home.pillar3Body}
            </p>
          </div>
        </div>
      </section>

      {/* Neighborhoods with vibe & walkability */}
      <section className="container-stay py-10 md:py-14 space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-1">
            <h2 className="section-title">{t.home.neighborhoodTitle}</h2>
            <p className="text-sm text-[var(--color-text-muted)]">
              {t.home.neighborhoodSubtitle}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <Link
              href="/explore"
              className="inline-flex items-center gap-1.5 min-h-[44px] px-3 text-sm font-medium text-[var(--color-text)] hover:text-[var(--color-primary)] hover:underline underline-offset-4"
            >
              <span>{t.nav.localGuides}</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
            <Link
              href="/stays"
              className="inline-flex items-center gap-1.5 min-h-[44px] px-3 text-sm font-medium text-[var(--color-primary)] hover:underline underline-offset-4"
            >
              <span>{t.home.browseNeighborhoods}</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {areas.map((area) => {
            const areaName = prefs.locale === 'vi' ? area.nameVi : area.nameEn;
            const cityName = prefs.locale === 'vi' ? area.cityVi : area.cityEn;
            const vibe =
              prefs.locale === 'vi' ? area.vibeSummaryVi : area.vibeSummaryEn;
            const walkability =
              prefs.locale === 'vi'
                ? area.walkabilityNoteVi || area.descriptionVi
                : area.walkabilityNoteEn || area.descriptionEn;

            return (
              <Link
                key={area.id}
                href={`/stays?area=${encodeURIComponent(area.slug)}`}
                className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 hover:border-[var(--color-primary)] shadow-apple-subtle transition-colors flex flex-col justify-between gap-4"
              >
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-primary)]">
                    {cityName}
                  </p>
                  <h3 className="text-lg font-semibold text-[var(--color-text)]">
                    {areaName}
                  </h3>
                  {vibe && (
                    <p className="text-xs font-medium text-[var(--color-text)]">
                      {vibe}
                    </p>
                  )}
                  <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                    {walkability}
                  </p>
                </div>
                <div className="pt-3 border-t border-[var(--color-hairline)] flex items-center justify-between text-xs font-medium text-[var(--color-text)]">
                  <span className="inline-flex items-center gap-1 text-[var(--color-text-muted)]">
                    <MapPin className="w-4 h-4 text-[var(--color-primary)]" aria-hidden="true" />
                    <span>
                      {area.publishedStayCount}{' '}
                      {area.publishedStayCount === 1
                        ? t.home.staySingular
                        : t.home.stayPlural}
                    </span>
                  </span>
                  <span className="text-[var(--color-primary)]">
                    {t.home.viewAction}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
