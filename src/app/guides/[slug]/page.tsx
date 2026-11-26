import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, Calendar, MapPin } from 'lucide-react';
import { formatCmsTypeLabel } from '@/lib/i18n';
import { getServerPreferences } from '@/lib/preferences';
import { getPublishedCmsBySlug } from '@/modules/cms';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const item = await getPublishedCmsBySlug(slug);
  if (!item) {
    return { title: 'Guide Not Found | VietNomad Stays' };
  }
  return {
    title: item.seoTitle || `${item.titleEn} | VietNomad Stays`,
    description: item.seoDescription || item.bodyEn.slice(0, 155),
    alternates: item.canonicalUrl ? { canonical: item.canonicalUrl } : undefined,
    robots: { index: item.robotsIndex, follow: item.robotsIndex },
  };
}

export default async function GuideDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [prefs, item] = await Promise.all([
    getServerPreferences(),
    getPublishedCmsBySlug(slug),
  ]);

  if (!item) notFound();
  if (item.redirectTo) {
    redirect(item.redirectTo);
  }

  const isVi = prefs.locale === 'vi';
  const title = isVi ? item.titleVi : item.titleEn;
  const body = isVi ? item.bodyVi : item.bodyEn;
  const paragraphs = body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <article className="mx-auto max-w-4xl space-y-8 px-4 py-12 sm:px-6 lg:px-8">
      <Link
        href="/guides"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#164E3F] hover:underline"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {isVi ? 'Xem tất cả cẩm nang' : 'All guides & stories'}
      </Link>

      <header className="space-y-4 rounded-3xl border border-[#E5DFD3] bg-white p-8 lacquer-shadow">
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
          <span className="rounded-full bg-[#E7F1EC] px-3 py-1 uppercase tracking-wide text-[#164E3F]">
            {formatCmsTypeLabel(item.contentType, prefs.locale)}
          </span>
          {item.category && (
            <span className="rounded-full bg-[#FAF8F3] px-3 py-1 text-[#53635D]">
              {item.category.replace(/_/g, ' ')}
            </span>
          )}
          {item.destinationSlug && item.destinationNameEn && (
            <Link
              href={`/destinations/${item.destinationSlug}`}
              className="inline-flex items-center gap-1 rounded-full bg-[#FAEDE5] px-3 py-1 text-[#C25E28] hover:underline"
            >
              <MapPin className="h-3.5 w-3.5" />
              {isVi ? item.destinationNameVi || item.destinationNameEn : item.destinationNameEn}
            </Link>
          )}
          {item.publishedAt && (
            <span className="inline-flex items-center gap-1 text-[#53635D]">
              <Calendar className="h-3.5 w-3.5" />
              {item.publishedAt.slice(0, 10)}
            </span>
          )}
        </div>

        <h1 className="font-serif-display text-3xl font-semibold leading-tight text-[#17221E] sm:text-4xl">
          {title}
        </h1>
      </header>

      <div className="space-y-5 rounded-3xl border border-[#E5DFD3] bg-white p-8 text-base leading-relaxed text-[#17221E]">
        {paragraphs.length > 0 ? (
          paragraphs.map((para, idx) => (
            <p key={idx} className="whitespace-pre-line">
              {para}
            </p>
          ))
        ) : (
          <p className="whitespace-pre-line">{body}</p>
        )}
      </div>

      {item.destinationSlug && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-[#0F392E] p-6 text-white">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-[#E6B87A]">
              {isVi ? 'Khám phá chỗ ở' : 'Explore verified stays'}
            </div>
            <div className="font-serif-display mt-1 text-2xl font-semibold">
              {isVi
                ? `Xem căn hộ dài ngày tại ${item.destinationNameVi || item.destinationNameEn}`
                : `Browse long-stay homes in ${item.destinationNameEn}`}
            </div>
          </div>
          <Link
            href={`/destinations/${item.destinationSlug}`}
            className="rounded-xl bg-[#E6B87A] px-5 py-2.5 text-sm font-bold text-[#0F392E] hover:bg-[#dfb06d]"
          >
            {isVi ? 'Xem ngay' : 'Browse stays'}
          </Link>
        </div>
      )}
    </article>
  );
}
