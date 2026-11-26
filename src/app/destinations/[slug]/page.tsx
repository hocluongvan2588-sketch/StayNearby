import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight, MapPin, ShieldCheck, Wifi } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth/session';
import { dbQuery } from '@/lib/db';
import { formatCmsTypeLabel, formatCountNoun, formatPlaceCategoryLabel } from '@/lib/i18n';
import { getServerPreferences } from '@/lib/preferences';
import {
  getDestinationLocalPartners,
  getDestinationLocalPlaces,
  getDestinationNeighborhoods,
  getDestinations,
  searchStays,
} from '@/modules/catalog';
import { getPublishedCmsContents } from '@/modules/cms';
import { PaginatedStayGrid } from '@/components/PaginatedStayGrid';
import { PartnerPerkTrackerLink } from '@/components/PartnerPerkTrackerLink';

export const dynamic = 'force-dynamic';

export default async function DestinationDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [prefs, user, destinations, stays, localPlaces, neighborhoods, localPartners, destGuides] =
    await Promise.all([
      getServerPreferences(),
      getCurrentUser(),
      getDestinations(),
      searchStays({ destination: slug }),
      getDestinationLocalPlaces(slug),
      getDestinationNeighborhoods(slug),
      getDestinationLocalPartners(slug),
      getPublishedCmsContents({
        destinationSlug: slug,
        contentTypes: ['destination_guide', 'article'],
        limit: 3,
      }),
    ]);

  const dest = destinations.find((d) => d.slug === slug);
  if (!dest) notFound();
  const isVi = prefs.locale === 'vi';

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
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-1.5 text-xs font-semibold text-[#164E3F] hover:underline"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {isVi ? 'Về trang chủ' : 'Back to Vietnam Hubs'}
      </Link>

      <div className="mb-10 grid gap-8 overflow-hidden rounded-3xl border border-[#E5DFD3] bg-white lg:grid-cols-12 lacquer-shadow">
        <div className="lg:col-span-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={dest.heroImage}
            alt={isVi ? dest.nameVi : dest.nameEn}
            className="h-full min-h-[260px] w-full object-cover"
          />
        </div>
        <div className="space-y-4 p-6 sm:p-8 lg:col-span-7">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
            <span className="rounded-full bg-[#E7F1EC] px-3 py-1 text-[#164E3F]">
              <Wifi className="mr-1 inline h-3.5 w-3.5" />~{dest.avgWifiMbps} Mbps
            </span>
            <span className="rounded-full bg-[#FAEDE5] px-3 py-1 text-[#C25E28]">
              ~${dest.monthlyCostUsd}/{isVi ? 'tháng sinh hoạt' : 'mo living cost'}
            </span>
          </div>
          <h1 className="font-serif-display text-4xl font-semibold text-[#17221E]">
            {isVi ? `Chỗ ở dài ngày tại ${dest.nameVi}` : `Stays in ${dest.nameEn}`}
          </h1>
          <p className="text-sm leading-relaxed text-[#53635D]">
            {isVi ? dest.taglineVi : dest.taglineEn}
          </p>

          <div className="grid gap-3 pt-2 sm:grid-cols-2">
            <div className="rounded-2xl bg-[#FAF8F3] p-4">
              <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-[#164E3F]">
                <ShieldCheck className="h-4 w-4" />
                {isVi ? 'Thông tin Visa' : 'Visa & Entry Rules'}
              </div>
              <div className="text-xs font-bold text-[#17221E]">
                {isVi ? dest.visaSummaryVi : dest.visaSummaryEn}
              </div>
              <p className="mt-1 text-xs text-[#53635D]">
                {isVi ? dest.visaDetailsVi : dest.visaDetailsEn}
              </p>
            </div>
            <div className="rounded-2xl bg-[#FAF8F3] p-4">
              <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-[#A67C2E]">
                <MapPin className="h-4 w-4" />
                {isVi ? 'Khí hậu & Mùa đẹp' : 'Climate & Rhythm'}
              </div>
              <p className="text-xs leading-relaxed text-[#53635D]">
                {isVi ? dest.climateVi : dest.climateEn}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-6 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
        <h2 className="font-serif-display text-2xl font-semibold text-[#17221E]">
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

      {neighborhoods.length > 0 && (
        <section className="mt-12 rounded-3xl border border-[#E5DFD3] bg-white p-6 sm:p-8">
          <div className="mb-5 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
            <div>
              <h2 className="font-serif-display text-2xl font-semibold text-[#17221E]">
                {isVi
                  ? `Các khu vực nổi bật tại ${dest.nameVi}`
                  : `Neighborhoods to explore in ${dest.nameEn}`}
              </h2>
              <p className="mt-1 text-xs text-[#53635D]">
                {isVi
                  ? 'Thông tin nhịp sống, di chuyển và tiện ích từng khu vực.'
                  : 'Walkability, daily conveniences, and local neighborhood feel.'}
              </p>
            </div>
            <span className="text-xs font-semibold text-[#164E3F]">
              {formatCountNoun(neighborhoods.length, 'neighborhood', 'neighborhoods', 'khu vực', prefs.locale)}
            </span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {neighborhoods.map((nb) => (
              <div
                key={nb.id}
                className="rounded-2xl border border-[#E5DFD3] bg-[#FAF8F3] p-4"
              >
                <h3 className="text-sm font-semibold text-[#17221E]">
                  {isVi ? nb.nameVi || nb.nameEn : nb.nameEn}
                </h3>
                {(nb.summaryEn || nb.summaryVi) && (
                  <p className="mt-1.5 text-xs leading-relaxed text-[#53635D]">
                    {isVi ? nb.summaryVi || nb.summaryEn : nb.summaryEn || nb.summaryVi}
                  </p>
                )}
                {(nb.guideEn || nb.guideVi) && (
                  <p className="mt-2 border-t border-[#E5DFD3] pt-2 text-[11px] text-[#53635D]">
                    {isVi ? nb.guideVi || nb.guideEn : nb.guideEn || nb.guideVi}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {localPlaces.length > 0 && (
        <section className="mt-12 rounded-3xl border border-[#E5DFD3] bg-white p-6 sm:p-8">
          <div className="mb-5 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
            <div>
              <h2 className="font-serif-display text-2xl font-semibold text-[#17221E]">
                {isVi
                  ? `Địa điểm khám phá tại ${dest.nameVi}`
                  : `Places to explore in ${dest.nameEn}`}
              </h2>
              <p className="mt-1 text-xs text-[#53635D]">
                {isVi
                  ? 'Bãi biển, địa danh, ẩm thực, quán cà phê, không gian làm việc và tiện ích thiết yếu.'
                  : 'Beaches, landmarks, dining, cafes, workspaces, fitness, and daily essentials.'}
              </p>
            </div>
            <span className="text-xs font-semibold text-[#164E3F]">
              {formatCountNoun(localPlaces.length, 'verified place', 'verified places', 'địa điểm', prefs.locale)}
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {localPlaces.map((pl) => (
              <div
                key={pl.id}
                className="flex flex-col justify-between rounded-2xl border border-[#E5DFD3] bg-[#FAF8F3] p-4"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 text-[11px] font-semibold">
                    <span className="rounded bg-[#E7F1EC] px-2 py-0.5 uppercase tracking-wide text-[#164E3F]">
                      {formatPlaceCategoryLabel(pl.category, prefs.locale)}
                    </span>
                    <span className="text-[#53635D]">{pl.priceRange}</span>
                  </div>
                  <h3 className="mt-2.5 text-sm font-semibold text-[#17221E]">{pl.name}</h3>
                  {(pl.neighborhoodNameEn || pl.neighborhoodNameVi) && (
                    <div className="mt-0.5 text-[11px] font-medium text-[#C25E28]">
                      {isVi
                        ? pl.neighborhoodNameVi || pl.neighborhoodNameEn
                        : pl.neighborhoodNameEn || pl.neighborhoodNameVi}
                    </div>
                  )}
                  <p className="mt-2 text-xs leading-relaxed text-[#53635D]">
                    {isVi ? pl.descriptionVi || pl.descriptionEn : pl.descriptionEn || pl.descriptionVi}
                  </p>
                  {pl.partnerPerk && (
                    <div className="mt-2 inline-block rounded-lg bg-[#E7F1EC] px-2 py-1 text-[11px] font-semibold text-[#164E3F]">
                      {isVi ? 'Ưu đãi hội viên:' : 'Member perk:'} {pl.partnerPerk}
                    </div>
                  )}
                </div>
                <div className="mt-3 border-t border-[#E5DFD3] pt-2.5 text-[11px] text-[#53635D]">
                  <div>{pl.address}</div>
                  <div className="mt-0.5 font-medium text-[#17221E]">{pl.openingHours}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {localPartners.length > 0 && (
        <section className="mt-12 rounded-3xl border border-[#CBE1D6] bg-[#FAF8F3] p-6 sm:p-8">
          <div className="mb-5 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
            <div>
              <h2 className="font-serif-display text-2xl font-semibold text-[#17221E]">
                {isVi
                  ? `Đối tác địa phương tại ${dest.nameVi}`
                  : `Local partners & perks in ${dest.nameEn}`}
              </h2>
              <p className="mt-1 text-xs text-[#53635D]">
                {isVi
                  ? 'Ưu đãi từ các đối tác địa phương dành cho khách đặt phòng qua VietNomad Stays.'
                  : 'Member benefits from local businesses, available with your VietNomad Stays booking.'}
              </p>
            </div>
            <span className="text-xs font-semibold text-[#164E3F]">
              {formatCountNoun(localPartners.length, 'active partner', 'active partners', 'đối tác đang hoạt động', prefs.locale)}
            </span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {localPartners.map((lp) => (
              <div
                key={lp.id}
                className="flex flex-col justify-between rounded-2xl border border-[#E5DFD3] bg-white p-4"
              >
                <div>
                  <span className="rounded bg-[#E7F1EC] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#164E3F]">
                    {formatPlaceCategoryLabel(lp.category, prefs.locale)}
                  </span>
                  <h3 className="mt-2 text-sm font-semibold text-[#17221E]">{lp.businessName}</h3>
                  {lp.perkOffer && (
                    <p className="mt-1.5 text-xs font-medium text-[#C25E28]">{lp.perkOffer}</p>
                  )}
                </div>
                <div className="mt-3 pt-2">
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

      {destGuides.length > 0 && (
        <section className="mt-12 rounded-3xl border border-[#E5DFD3] bg-white p-6 sm:p-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-serif-display text-2xl font-semibold text-[#17221E]">
              {isVi ? `Cẩm nang ${dest.nameVi}` : `${dest.nameEn} Guides`}
            </h2>
            <Link href="/guides" className="text-xs font-semibold text-[#164E3F] hover:underline">
              {isVi ? 'Tất cả cẩm nang' : 'All guides'}
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {destGuides.map((g) => (
              <Link
                key={g.id}
                href={`/guides/${g.slug}`}
                className="rounded-2xl border border-[#E5DFD3] bg-[#FAF8F3] p-4 hover:border-[#164E3F]"
              >
                <div className="text-[10px] font-semibold uppercase tracking-wider text-[#164E3F]">
                  {formatCmsTypeLabel(g.contentType, prefs.locale)}
                </div>
                <div className="mt-1 font-semibold text-[#17221E]">
                  {isVi ? g.titleVi : g.titleEn}
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-[#53635D]">
                  {(isVi ? g.bodyVi : g.bodyEn).slice(0, 140)}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
