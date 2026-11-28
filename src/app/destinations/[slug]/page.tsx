import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { getConfig } from '@/lib/config';
import { getCurrentUser } from '@/lib/auth/session';
import { dbQuery } from '@/lib/db';
import {
  formatCmsTypeLabel,
  formatCountNoun,
  formatPlaceCategoryLabel,
} from '@/lib/i18n';
import { getServerPreferences } from '@/lib/preferences';
import {
  getDestinationLocalPartners,
  getDestinationLocalPlaces,
  getDestinationNeighborhoods,
  getDestinations,
  getUpcomingEventsForDestination,
  searchStays,
} from '@/modules/catalog';
import { EventCard } from '@/components/events/EventCard';
import { getPublishedCmsContents } from '@/modules/cms';
import { DestinationPlacesExplorer } from '@/components/DestinationPlacesExplorer';
import { PaginatedStayGrid } from '@/components/PaginatedStayGrid';
import { AreaCard } from '@/components/AreaCard';
import { PartnerPerkTrackerLink } from '@/components/PartnerPerkTrackerLink';
import { ArticleAttributionTracker } from '@/components/cms-public/ArticleAttributionTracker';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const [prefs, destinations] = await Promise.all([
    getServerPreferences(),
    getDestinations(),
  ]);
  const dest = destinations.find((d) => d.slug === slug);
  if (!dest) return {};

  const isVi = prefs.locale === 'vi';
  const name = isVi ? dest.nameVi : dest.nameEn;
  const tagline = isVi ? dest.taglineVi : dest.taglineEn;
  const title = isVi ? `Khám phá ${name} | VietNomad Stays` : `Discover ${name} | VietNomad Stays`;
  const description = isVi
    ? `${tagline} Chỗ ở, khu vực, địa điểm và sự kiện cộng đồng tại ${name}.`
    : `${tagline} Stays, areas, local places, and community events in ${name}.`;
  const baseUrl = getConfig().appBaseUrl.replace(/\/$/, '');
  const url = `${baseUrl}/destinations/${dest.slug}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: 'VietNomad Stays',
      locale: isVi ? 'vi_VN' : 'en_US',
      type: 'website',
      images: [{ url: `${baseUrl}${dest.heroImage}`, alt: name }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [`${baseUrl}${dest.heroImage}`],
    },
  };
}

/** "&"-separated area names → lowercase segments used to match stay neighborhoods. */
function areaNameSegments(...names: Array<string | null | undefined>): string[] {
  return names
    .filter((n): n is string => Boolean(n))
    .flatMap((n) => n.split('&'))
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export default async function DestinationDetailPage({ params }: Params) {
  const { slug } = await params;
  const [
    prefs,
    user,
    destinations,
    stays,
    localPlaces,
    neighborhoods,
    localPartners,
    destGuides,
  ] = await Promise.all([
    getServerPreferences(),
    getCurrentUser(),
    getDestinations(),
    searchStays({ destination: slug }),
    getDestinationLocalPlaces(slug),
    getDestinationNeighborhoods(slug),
    getDestinationLocalPartners(slug),
    getPublishedCmsContents({
      destinationSlug: slug,
      contentTypes: ['destination_guide', 'neighborhood_guide', 'local_guide', 'article'],
      limit: 4,
    }),
  ]);

  const dest = destinations.find((d) => d.slug === slug);
  if (!dest) notFound();
  const isVi = prefs.locale === 'vi';
  const destName = isVi ? dest.nameVi : dest.nameEn;
  const upcomingEvents = await getUpcomingEventsForDestination(dest.id, 4);

  // Real per-area stay counts (live stays whose free-text neighborhood matches
  // any "&"-separated segment of the area name). No invented numbers.
  const stayAreaRows = await dbQuery<{
    neighborhood_vi: string | null;
    neighborhood_en: string | null;
  }>(
    'SELECT neighborhood_vi, neighborhood_en FROM stays WHERE destination_id = $1 AND status = $2',
    [dest.id, 'live']
  );
  const areaStayCount = new Map<string, number>();
  for (const nb of neighborhoods) {
    const segments = areaNameSegments(nb.nameVi, nb.nameEn);
    const count = stayAreaRows.rows.filter((row) =>
      segments.some(
        (seg) =>
          (row.neighborhood_vi ?? '').toLowerCase().includes(seg) ||
          (row.neighborhood_en ?? '').toLowerCase().includes(seg)
      )
    ).length;
    areaStayCount.set(nb.id, count);
  }

  let savedIds: string[] = [];
  if (user) {
    const sv = await dbQuery<{ stay_id: string }>(
      'SELECT stay_id FROM saved_stays WHERE user_id = $1',
      [user.id]
    );
    savedIds = sv.rows.map((r) => r.stay_id);
  }

  // Section nav — only entries whose section has real content.
  const navItems: Array<{ id: string; label: string }> = [];
  if (stays.length > 0) navItems.push({ id: 'stays', label: isVi ? 'Chỗ ở' : 'Stays' });
  if (neighborhoods.length > 0) navItems.push({ id: 'areas', label: isVi ? 'Khu vực' : 'Areas' });
  if (localPlaces.length > 0) navItems.push({ id: 'discover', label: isVi ? 'Khám phá' : 'Discover' });
  if (upcomingEvents.length > 0) navItems.push({ id: 'events', label: isVi ? 'Sự kiện' : 'Events' });
  if (destGuides.length > 0) navItems.push({ id: 'guides', label: isVi ? 'Cẩm nang' : 'Guides' });

  const baseUrl = getConfig().appBaseUrl.replace(/\/$/, '');
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'TouristDestination',
    name: destName,
    description: isVi ? dest.taglineVi : dest.taglineEn,
    image: `${baseUrl}${dest.heroImage}`,
    url: `${baseUrl}/destinations/${dest.slug}`,
  };

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6 lg:px-8">
      <ArticleAttributionTracker eventType="destination_view" destinationSlug={dest.slug} />

      <Link
        href="/"
        className="mb-5 inline-flex items-center gap-1.5 text-xs font-semibold text-[#164E3F] hover:underline"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {isVi ? 'Về trang chủ' : 'Back to Vietnam destinations'}
      </Link>

      {/* Destination hero — one large editorial image */}
      <div className="overflow-hidden rounded-2xl bg-[#F2EDE3]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={dest.heroImage}
          alt={destName}
          className="aspect-[4/3] w-full object-cover sm:aspect-[16/9] lg:aspect-[2/1]"
        />
      </div>

      {/* Name + short intro */}
      <div className="mt-6 max-w-3xl">
        <h1 className="font-serif-display text-3xl font-semibold text-[#17221E] sm:text-4xl lg:text-5xl">
          {isVi ? `Khám phá ${dest.nameVi}` : `Discover ${dest.nameEn}`}
        </h1>
        <p className="mt-3 text-base leading-relaxed text-[#53635D] sm:text-lg">
          {isVi ? dest.taglineVi : dest.taglineEn}
        </p>
      </div>

      {/* Section navigation */}
      {navItems.length > 0 && (
        <nav
          aria-label={isVi ? 'Điều hướng trang' : 'Page sections'}
          className="mt-6 flex flex-wrap gap-x-7 gap-y-2 text-sm font-semibold text-[#53635D]"
        >
          {navItems.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className="transition hover:text-[#164E3F] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#164E3F]"
            >
              {item.label}
            </a>
          ))}
        </nav>
      )}

      {/* Stays */}
      {stays.length > 0 && (
        <section id="stays" className="scroll-mt-24 pt-12">
          <div className="mb-6 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
            <h2 className="text-2xl font-semibold tracking-tight text-[#17221E]">
              {isVi ? `Chỗ ở tại ${dest.nameVi}` : `Stays in ${dest.nameEn}`}
            </h2>
            <Link
              href={`/stays?destination=${dest.slug}`}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#164E3F] hover:underline"
            >
              {isVi ? 'Xem tất cả' : 'See all stays'}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <PaginatedStayGrid
            stays={stays}
            savedIds={savedIds}
            isAuthenticated={Boolean(user)}
          />
        </section>
      )}

      {/* Areas */}
      {neighborhoods.length > 0 && (
        <section id="areas" className="scroll-mt-24 pt-12">
          <h2 className="mb-6 text-2xl font-semibold tracking-tight text-[#17221E]">
            {isVi ? `Các khu vực tại ${dest.nameVi}` : `Areas in ${dest.nameEn}`}
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {neighborhoods.map((nb) => (
              <AreaCard
                key={nb.id}
                href={`/stays?destination=${dest.slug}&area=${nb.slug}`}
                image={nb.imageUrl}
                name={isVi ? nb.nameVi || nb.nameEn : nb.nameEn || nb.nameVi}
                description={isVi ? nb.summaryVi || nb.summaryEn : nb.summaryEn || nb.summaryVi}
                stayCount={areaStayCount.get(nb.id) ?? 0}
                locale={prefs.locale}
              />
            ))}
          </div>
        </section>
      )}

      {/* Local discovery */}
      {localPlaces.length > 0 && (
        <div id="discover" className="scroll-mt-24">
          <DestinationPlacesExplorer
            destinationName={destName}
            places={localPlaces}
            locale={prefs.locale}
          />
        </div>
      )}

      {/* Community events */}
      {upcomingEvents.length > 0 && (
        <section id="events" className="scroll-mt-24 pt-12">
          <div className="mb-6 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
            <h2 className="text-2xl font-semibold tracking-tight text-[#17221E]">
              {isVi ? `Sự kiện sắp tới tại ${destName}` : `Upcoming events in ${destName}`}
            </h2>
            <Link
              href={`/community?destination=${dest.id}`}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#164E3F] hover:underline"
            >
              {isVi ? 'Xem tất cả sự kiện' : 'See all events'}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            {upcomingEvents.map((ev) => (
              <EventCard key={ev.id} event={ev} locale={prefs.locale} />
            ))}
          </div>
        </section>
      )}

      {/* Local partners */}
      {localPartners.length > 0 && (
        <section className="pt-12">
          <div className="mb-6 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
            <h2 className="text-2xl font-semibold tracking-tight text-[#17221E]">
              {isVi ? `Đặc quyền từ đối tác tại ${dest.nameVi}` : `Local partner perks in ${dest.nameEn}`}
            </h2>
            <span className="text-xs font-medium text-[#53635D]">
              {formatCountNoun(
                localPartners.length,
                'partner',
                'partners',
                'đối tác',
                prefs.locale
              )}
            </span>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {localPartners.map((lp) => (
              <div
                key={lp.id}
                className="flex flex-col justify-between rounded-xl bg-[#FAF8F3] p-5"
              >
                <div>
                  <span className="text-xs font-semibold text-[#164E3F]">
                    {formatPlaceCategoryLabel(lp.category, prefs.locale)}
                  </span>
                  <h3 className="mt-1 text-base font-semibold text-[#17221E]">
                    {lp.businessName}
                  </h3>
                  {lp.perkOffer && (
                    <p className="mt-1.5 text-sm font-medium text-[#C25E28]">
                      {lp.perkOffer}
                    </p>
                  )}
                </div>
                <div className="mt-4 pt-2">
                  <PartnerPerkTrackerLink
                    partnerId={lp.id}
                    partnerName={lp.businessName}
                    href={`/stays?destination=${dest.slug}`}
                    label={isVi ? 'Áp dụng khi đặt phòng' : 'Available with your stay'}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Guides (CMS) */}
      {destGuides.length > 0 && (
        <section id="guides" className="scroll-mt-24 pt-12">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-2xl font-semibold tracking-tight text-[#17221E]">
              {isVi ? `Cẩm nang ${dest.nameVi}` : `${dest.nameEn} guides`}
            </h2>
            <Link
              href="/guides"
              className="text-sm font-semibold text-[#164E3F] hover:underline"
            >
              {isVi ? 'Tất cả cẩm nang' : 'All guides'}
            </Link>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {destGuides.map((g) => (
              <Link
                key={g.id}
                href={`/guides/${g.slug}`}
                className="group rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#164E3F]"
              >
                {g.featuredImageUrl ? (
                  <div className="aspect-[16/10] overflow-hidden rounded-xl bg-[#F2EDE3]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={g.featuredImageUrl}
                      alt={isVi ? g.titleVi : g.titleEn}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                    />
                  </div>
                ) : (
                  <div className="aspect-[16/10] overflow-hidden rounded-xl bg-gradient-to-br from-[#F2EDE3] to-[#E7F1EC]" />
                )}
                <div className="mt-3 text-xs font-semibold text-[#164E3F]">
                  {formatCmsTypeLabel(g.contentType, prefs.locale)}
                </div>
                <h3 className="mt-1 text-base font-semibold leading-snug text-[#17221E] group-hover:text-[#164E3F]">
                  {isVi ? g.titleVi : g.titleEn}
                </h3>
                {(isVi ? g.excerptVi : g.excerptEn) && (
                  <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-[#53635D]">
                    {isVi ? g.excerptVi : g.excerptEn}
                  </p>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </div>
  );
}
