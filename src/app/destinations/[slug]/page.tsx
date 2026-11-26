import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight, MapPin, ShieldCheck, Sun } from 'lucide-react';
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
  searchStays,
} from '@/modules/catalog';
import { getPublishedCmsContents } from '@/modules/cms';
import { DestinationPlacesExplorer } from '@/components/DestinationPlacesExplorer';
import { PaginatedStayGrid } from '@/components/PaginatedStayGrid';
import { PartnerPerkTrackerLink } from '@/components/PartnerPerkTrackerLink';
import { ArticleAttributionTracker } from '@/components/cms-public/ArticleAttributionTracker';

export const dynamic = 'force-dynamic';

export default async function DestinationDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
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

  let savedIds: string[] = [];
  if (user) {
    const sv = await dbQuery<{ stay_id: string }>(
      'SELECT stay_id FROM saved_stays WHERE user_id = $1',
      [user.id]
    );
    savedIds = sv.rows.map((r) => r.stay_id);
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <ArticleAttributionTracker eventType="destination_view" destinationSlug={dest.slug} />

      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-1.5 text-xs font-semibold text-[#164E3F] hover:underline"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {isVi ? 'Về trang chủ' : 'Back to Vietnam destinations'}
      </Link>

      {/* Photography-led Destination Hero */}
      <div className="mb-12 grid gap-8 overflow-hidden rounded-2xl border border-[#E5DFD3] bg-white lg:grid-cols-12">
        <div className="lg:col-span-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={dest.heroImage}
            alt={destName}
            className="h-full min-h-[260px] w-full object-cover"
          />
        </div>
        <div className="space-y-5 p-6 sm:p-8 lg:col-span-7">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
            <span className="rounded-full bg-[#FAF8F3] px-3 py-1 text-[#17221E]">
              {isVi ? dest.regionVi : dest.regionEn}
            </span>
            <span className="rounded-full bg-[#FAEDE5] px-3 py-1 text-[#C25E28]">
              ~${dest.monthlyCostUsd}/{isVi ? 'tháng sinh hoạt' : 'mo living cost'}
            </span>
          </div>

          <h1 className="font-serif-display text-3xl font-semibold text-[#17221E] sm:text-4xl">
            {isVi ? `Khám phá & Lưu trú tại ${dest.nameVi}` : `Stay & explore ${dest.nameEn}`}
          </h1>
          <p className="text-[15px] leading-relaxed text-[#53635D]">
            {isVi ? dest.taglineVi : dest.taglineEn}
          </p>

          <div className="grid gap-4 pt-2 sm:grid-cols-2">
            <div className="border-l-2 border-[#E5DFD3] pl-4">
              <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-[#164E3F]">
                <ShieldCheck className="h-4 w-4" />
                {isVi ? 'Thủ tục & Lưu trú' : 'Visa & Entry Rules'}
              </div>
              <div className="text-xs font-semibold text-[#17221E]">
                {isVi ? dest.visaSummaryVi : dest.visaSummaryEn}
              </div>
              <p className="mt-1 text-xs leading-relaxed text-[#53635D]">
                {isVi ? dest.visaDetailsVi : dest.visaDetailsEn}
              </p>
            </div>

            <div className="border-l-2 border-[#E5DFD3] pl-4">
              <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-[#A67C2E]">
                <Sun className="h-4 w-4" />
                {isVi ? 'Khí hậu & Mùa đẹp' : 'Climate & Rhythm'}
              </div>
              <p className="text-xs leading-relaxed text-[#53635D]">
                {isVi ? dest.climateVi : dest.climateEn}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Open Stays */}
      <section className="pb-12">
        <div className="mb-6 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
          <h2 className="text-2xl font-semibold tracking-tight text-[#17221E]">
            {isVi
              ? `${stays.length} chỗ ở đang mở tại ${dest.nameVi}`
              : `${formatCountNoun(stays.length, 'stay', 'stays', 'chỗ ở', prefs.locale)} available in ${dest.nameEn}`}
          </h2>
          <Link
            href={`/stays?destination=${dest.slug}`}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#164E3F] hover:underline"
          >
            {isVi ? 'Lọc theo ngày và tiện ích' : 'Filter by dates & amenities'}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <PaginatedStayGrid
          stays={stays}
          savedIds={savedIds}
          isAuthenticated={Boolean(user)}
        />
      </section>

      <div className="divide-y divide-[#E5DFD3] border-t border-[#E5DFD3]">
        {/* Neighborhoods (Open Layout) */}
        {neighborhoods.length > 0 && (
          <section className="py-12">
            <div className="mb-6 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-[#17221E]">
                  {isVi
                    ? `Các khu vực đáng ở tại ${dest.nameVi}`
                    : `Neighborhoods to explore in ${dest.nameEn}`}
                </h2>
                <p className="mt-1 text-sm text-[#53635D]">
                  {isVi
                    ? 'Nhịp sống, tiện ích đi bộ và đặc trưng từng khu phố.'
                    : 'Walkability, daily conveniences, and local neighborhood feel.'}
                </p>
              </div>
              <span className="text-xs font-medium text-[#53635D]">
                {formatCountNoun(
                  neighborhoods.length,
                  'neighborhood',
                  'neighborhoods',
                  'khu vực',
                  prefs.locale
                )}
              </span>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {neighborhoods.map((nb) => (
                <div key={nb.id} className="space-y-2 border-l-2 border-[#E5DFD3] pl-4">
                  <div className="flex items-center gap-1.5 text-base font-semibold text-[#17221E]">
                    <MapPin className="h-4 w-4 text-[#C25E28]" />
                    <span>{isVi ? nb.nameVi || nb.nameEn : nb.nameEn}</span>
                  </div>
                  {(nb.summaryEn || nb.summaryVi) && (
                    <p className="text-sm leading-relaxed text-[#53635D]">
                      {isVi ? nb.summaryVi || nb.summaryEn : nb.summaryEn || nb.summaryVi}
                    </p>
                  )}
                  {(nb.guideEn || nb.guideVi) && (
                    <p className="text-xs leading-relaxed text-[#53635D]">
                      {isVi ? nb.guideVi || nb.guideEn : nb.guideEn || nb.guideVi}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Photography-led Local Places Explorer */}
        {localPlaces.length > 0 && (
          <div className="pb-12">
            <DestinationPlacesExplorer
              destinationName={destName}
              places={localPlaces}
              locale={prefs.locale}
            />
          </div>
        )}

        {/* Local Partners */}
        {localPartners.length > 0 && (
          <section className="py-12">
            <div className="mb-6 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-[#17221E]">
                  {isVi
                    ? `Đặc quyền từ đối tác tại ${dest.nameVi}`
                    : `Local partner perks in ${dest.nameEn}`}
                </h2>
                <p className="mt-1 text-sm text-[#53635D]">
                  {isVi
                    ? 'Ưu đãi dành riêng cho khách lưu trú đặt phòng qua VietNomad Stays.'
                    : 'Member benefits from local businesses with your VietNomad Stays booking.'}
                </p>
              </div>
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
                  className="flex flex-col justify-between rounded-2xl border border-[#E5DFD3] bg-white p-5"
                >
                  <div>
                    <span className="text-xs font-medium text-[#164E3F]">
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

        {/* Editorial Guides */}
        {destGuides.length > 0 && (
          <section className="py-12">
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
            <div className="grid gap-5 sm:grid-cols-3">
              {destGuides.map((g) => (
                <Link
                  key={g.id}
                  href={`/guides/${g.slug}`}
                  className="rounded-2xl border border-[#E5DFD3] bg-white p-5 transition hover:border-[#164E3F]"
                >
                  <div className="text-xs font-semibold text-[#164E3F]">
                    {formatCmsTypeLabel(g.contentType, prefs.locale)}
                  </div>
                  <div className="mt-1.5 text-base font-semibold text-[#17221E]">
                    {isVi ? g.titleVi : g.titleEn}
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-[#53635D]">
                    {(isVi ? g.bodyVi : g.bodyEn).slice(0, 140)}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
