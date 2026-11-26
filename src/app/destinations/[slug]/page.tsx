import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight, MapPin, ShieldCheck, Wifi } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth/session';
import { dbQuery } from '@/lib/db';
import { getServerPreferences } from '@/lib/preferences';
import { getDestinations, getDestinationLocalPlaces, searchStays } from '@/modules/catalog';
import { PaginatedStayGrid } from '@/components/PaginatedStayGrid';

export const dynamic = 'force-dynamic';

export default async function DestinationDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [prefs, user, destinations, stays, localPlaces] = await Promise.all([
    getServerPreferences(),
    getCurrentUser(),
    getDestinations(),
    searchStays({ destination: slug }),
    getDestinationLocalPlaces(slug),
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
            {isVi ? `Chỗ ở làm việc từ xa tại ${dest.nameVi}` : `Remote work stays in ${dest.nameEn}`}
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
            ? `${stays.length} chỗ ở dài ngày đang mở tại ${dest.nameVi}`
            : `${stays.length} Available Long-Stay Homes in ${dest.nameEn}`}
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

      {localPlaces.length > 0 && (
        <section className="mt-12 rounded-3xl border border-[#E5DFD3] bg-white p-6 sm:p-8">
          <div className="mb-5 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
            <div>
              <h2 className="font-serif-display text-2xl font-semibold text-[#17221E]">
                {isVi
                  ? `Khám phá địa phương tại ${dest.nameVi}`
                  : `Local Discovery in ${dest.nameEn}`}
              </h2>
              <p className="mt-1 text-xs text-[#53635D]">
                {isVi
                  ? 'Danh sách coworking, quán cà phê, phòng tập và dịch vụ thiết yếu được đội ngũ VietNomad kiểm chứng.'
                  : 'Curated coworking hubs, specialty coffee roasters, wellness studios, and daily essentials.'}
              </p>
            </div>
            <span className="text-xs font-semibold text-[#164E3F]">
              {localPlaces.length} {isVi ? 'địa điểm đã xác minh' : 'verified places'}
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
                      {pl.category.replace('_', ' ')}
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
    </div>
  );
}
