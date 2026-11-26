import Link from 'next/link';
import { ArrowRight, BookOpen, MapPin } from 'lucide-react';
import { formatCmsTypeLabel } from '@/lib/i18n';
import { getServerPreferences } from '@/lib/preferences';
import { getPublishedCmsContents } from '@/modules/cms';

export const dynamic = 'force-dynamic';

export default async function GuidesIndexPage() {
  const [prefs, guides] = await Promise.all([
    getServerPreferences(),
    getPublishedCmsContents({
      contentTypes: ['article', 'destination_guide', 'community_story', 'landing_page', 'faq'],
      limit: 50,
    }),
  ]);
  const isVi = prefs.locale === 'vi';

  return (
    <div className="mx-auto max-w-6xl space-y-10 px-4 py-12 sm:px-6 lg:px-8">
      <div className="space-y-3">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E7F1EC] px-3 py-1 text-xs font-semibold text-[#164E3F]">
          <BookOpen className="h-3.5 w-3.5" />
          {isVi ? 'Cẩm nang & Câu chuyện địa phương' : 'Guides & Local Stories'}
        </span>
        <h1 className="font-serif-display text-4xl font-semibold text-[#17221E]">
          {isVi ? 'Cẩm nang lưu trú dài ngày tại Việt Nam' : 'Long-Stay & Living Guides in Vietnam'}
        </h1>
        <p className="max-w-2xl text-sm text-[#53635D]">
          {isVi
            ? 'Thông tin từng khu vực, hướng dẫn nhận phòng, mẹo sinh hoạt và giải đáp thường gặp từ đội ngũ VietNomad.'
            : 'Neighborhood guides, arrival checklists, living tips, and city notes from the VietNomad team.'}
        </p>
      </div>

      {guides.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[#E5DFD3] bg-white p-10 text-center text-sm text-[#53635D]">
          {isVi ? 'Chưa có bài viết nào được đăng.' : 'No guides published yet.'}
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {guides.map((g) => (
            <Link
              key={g.id}
              href={`/guides/${g.slug}`}
              className="group flex flex-col justify-between rounded-3xl border border-[#E5DFD3] bg-white p-6 transition hover:border-[#164E3F] lacquer-shadow"
            >
              <div>
                <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px] font-semibold">
                  <span className="rounded-full bg-[#E7F1EC] px-2.5 py-0.5 uppercase tracking-wide text-[#164E3F]">
                    {formatCmsTypeLabel(g.contentType, prefs.locale)}
                  </span>
                  {g.destinationNameEn && (
                    <span className="inline-flex items-center gap-1 text-[#C25E28]">
                      <MapPin className="h-3 w-3" />
                      {isVi ? g.destinationNameVi || g.destinationNameEn : g.destinationNameEn}
                    </span>
                  )}
                </div>
                <h2 className="font-serif-display text-xl font-semibold text-[#17221E] group-hover:text-[#164E3F]">
                  {isVi ? g.titleVi : g.titleEn}
                </h2>
                <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-[#53635D]">
                  {(isVi ? g.bodyVi : g.bodyEn).slice(0, 180)}
                </p>
              </div>
              <div className="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-[#164E3F]">
                {isVi ? 'Đọc tiếp' : 'Read guide'}
                <ArrowRight className="h-3.5 w-3.5" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
