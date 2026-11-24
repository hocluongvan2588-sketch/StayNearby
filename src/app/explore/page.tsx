import Link from 'next/link';
import { ArrowRight, Compass, MapPin } from 'lucide-react';
import { getUserMessages } from '@/lib/i18n/messages';
import { getServerUserPreferences } from '@/lib/i18n/preferences';
import { listPublishedExploreAreas } from '@/modules/local-guides';

export const dynamic = 'force-dynamic';

export default async function ExploreIndexPage() {
  const [areas, prefs] = await Promise.all([
    listPublishedExploreAreas(),
    getServerUserPreferences(),
  ]);
  const locale = prefs.locale;
  const t = getUserMessages(locale);

  return (
    <div className="container-stay py-10 md:py-14 space-y-8">
      <div className="space-y-2 max-w-3xl">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary)] text-xs font-semibold">
          <Compass className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{t.localGuides.curatedBadge}</span>
        </span>
        <h1 className="page-title">{t.localGuides.exploreIndexTitle}</h1>
        <p className="text-[15px] text-[var(--color-text-muted)]">
          {t.localGuides.exploreIndexSubtitle}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {areas.map((area) => {
          const areaName = locale === 'vi' ? area.nameVi : area.nameEn;
          const cityName = locale === 'vi' ? area.cityVi : area.cityEn;
          const vibe = locale === 'vi' ? area.vibeSummaryVi : area.vibeSummaryEn;
          const walk = locale === 'vi' ? area.walkabilityNoteVi : area.walkabilityNoteEn;

          return (
            <Link
              key={area.id}
              href={`/explore/${area.slug}`}
              className="group rounded-[14px] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 space-y-4 hover:border-[var(--color-primary)] transition-colors flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2 text-xs font-medium text-[var(--color-primary)]">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
                    {cityName}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-[var(--color-primary-soft)] tabular-nums">
                    {area.publishedGuidesCount}
                  </span>
                </div>
                <h2 className="text-xl font-semibold text-[var(--color-text)] group-hover:text-[var(--color-primary)] transition-colors">
                  {areaName}
                </h2>
                <p className="text-sm text-[var(--color-text-muted)]">{vibe}</p>
                <p className="text-xs text-[var(--color-text-muted)]">{walk}</p>
              </div>

              <div className="pt-3 border-t border-[var(--color-hairline)] flex items-center justify-between text-sm font-medium text-[var(--color-primary)]">
                <span>{t.localGuides.viewAllGuidesForArea(areaName)}</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
