import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight, BookOpen, Clock, MapPin } from 'lucide-react';
import { formatCmsTypeLabel } from '@/lib/i18n';
import { getServerPreferences } from '@/lib/preferences';
import { getPublishedCmsContents } from '@/modules/cms';
import { listCmsCategories } from '@/modules/cms-vietnomad';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Long-Stay & Living Guides in Vietnam | VietNomad Stays',
  description:
    'Neighborhood guides, arrival checklists, remote-work internet notes, and verified living advice across Da Nang, Hoi An, Hanoi, and Ho Chi Minh City.',
};

export default async function GuidesIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; destination?: string }>;
}) {
  const sp = await searchParams;
  const activeCategory = sp.category?.trim() || undefined;
  const activeDestination = sp.destination?.trim() || undefined;

  const [prefs, guides, categories] = await Promise.all([
    getServerPreferences(),
    getPublishedCmsContents({
      contentTypes: [
        'article',
        'destination_guide',
        'neighborhood_guide',
        'local_guide',
        'community_story',
        'landing_page',
        'faq',
      ],
      categorySlug: activeCategory,
      destinationSlug: activeDestination,
      limit: 60,
    }),
    listCmsCategories(),
  ]);
  const isVi = prefs.locale === 'vi';

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-12 sm:px-6 lg:px-8">
      <div className="space-y-3">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E7F1EC] px-3 py-1 text-xs font-semibold text-[#164E3F]">
          <BookOpen className="h-3.5 w-3.5" />
          {isVi ? 'Cẩm nang & Câu chuyện địa phương' : 'Guides & Local Stories'}
        </span>
        <h1 className="text-3xl font-semibold tracking-tight text-[#17221E] sm:text-4xl">
          {isVi
            ? 'Cẩm nang lưu trú dài ngày tại Việt Nam'
            : 'Long-Stay & Living Guides in Vietnam'}
        </h1>
        <p className="max-w-2xl text-sm text-[#53635D]">
          {isVi
            ? 'Hướng dẫn từng khu vực, bài kiểm tra Wi-Fi thực tế, mẹo sinh hoạt và giải đáp chi tiết từ đội ngũ VietNomad.'
            : 'Neighborhood guides, arrival checklists, internet notes, and city tips curated by the VietNomad team.'}
        </p>
      </div>

      {/* Category Filter Pills */}
      {categories.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/guides"
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
              !activeCategory
                ? 'bg-[#164E3F] text-white'
                : 'border border-[#E5DFD3] bg-white text-[#53635D] hover:border-[#164E3F]'
            }`}
          >
            {isVi ? 'Tất cả chuyên mục' : 'All categories'}
          </Link>
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={`/guides?category=${encodeURIComponent(cat.slug)}`}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                activeCategory === cat.slug
                  ? 'bg-[#164E3F] text-white'
                  : 'border border-[#E5DFD3] bg-white text-[#53635D] hover:border-[#164E3F]'
              }`}
            >
              {isVi ? cat.nameVi : cat.nameEn}
            </Link>
          ))}
        </div>
      )}

      <p className="border-t border-[#E5DFD3] pt-5 text-sm text-[#53635D]">
        <Link href="/guides/visa" className="font-semibold text-[#164E3F] hover:underline">
          {isVi ? 'Visa Việt Nam — nguồn thông tin chính thức' : 'Vietnam visa — official sources'}
        </Link>
      </p>

      {guides.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[#E5DFD3] bg-white p-10 text-center text-sm text-[#53635D]">
          {isVi ? 'Chưa có bài viết nào trong chuyên mục này.' : 'No guides published in this filter yet.'}
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {guides.map((g) => {
            const title = isVi ? g.titleVi : g.titleEn;
            const summary = (isVi ? g.excerptVi || g.bodyVi : g.excerptEn || g.bodyEn).slice(0, 175);
            return (
              <Link
                key={g.id}
                href={`/guides/${g.slug}`}
                className="group flex flex-col overflow-hidden rounded-2xl border border-[#E5DFD3] bg-white transition hover:border-[#164E3F]"
              >
                {g.featuredImageUrl && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={g.featuredImageUrl}
                    alt={title}
                    className="h-44 w-full object-cover"
                  />
                )}
                <div className="flex flex-1 flex-col justify-between p-6">
                  <div>
                    <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-medium">
                      <span className="rounded-full bg-[#E7F1EC] px-2.5 py-0.5 text-[#164E3F]">
                        {g.categoryNameEn
                          ? isVi
                            ? g.categoryNameVi || g.categoryNameEn
                            : g.categoryNameEn
                          : formatCmsTypeLabel(g.contentType, prefs.locale)}
                      </span>
                      {g.destinationNameEn && (
                        <span className="inline-flex items-center gap-1 text-[#C25E28]">
                          <MapPin className="h-3 w-3" />
                          {isVi
                            ? g.destinationNameVi || g.destinationNameEn
                            : g.destinationNameEn}
                        </span>
                      )}
                    </div>
                    <h2 className="text-lg font-semibold text-[#17221E] group-hover:text-[#164E3F]">
                      {title}
                    </h2>
                    <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-[#53635D]">
                      {summary}
                    </p>
                  </div>
                  <div className="mt-5 flex items-center justify-between text-xs font-semibold text-[#164E3F]">
                    <span className="inline-flex items-center gap-1.5">
                      {isVi ? 'Đọc tiếp' : 'Read guide'}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-normal text-[#53635D]">
                      <Clock className="h-3 w-3" />
                      {g.readingTimeMinutes} min
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
