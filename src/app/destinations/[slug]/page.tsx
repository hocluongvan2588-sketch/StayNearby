import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight, MapPin, ShieldCheck, Wifi } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth/session';
import { dbQuery } from '@/lib/db';
import { getServerPreferences } from '@/lib/preferences';
import { getDestinations, searchStays } from '@/modules/catalog';
import { PaginatedStayGrid } from '@/components/PaginatedStayGrid';

export const dynamic = 'force-dynamic';

export default async function DestinationDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [prefs, user, destinations, stays] = await Promise.all([
    getServerPreferences(),
    getCurrentUser(),
    getDestinations(),
    searchStays({ destination: slug }),
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
            ? `${stays.length} chỗ ở sẵn sàng làm việc tại ${dest.nameVi}`
            : `${stays.length} Live Work-Ready Stays in ${dest.nameEn}`}
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
    </div>
  );
}
