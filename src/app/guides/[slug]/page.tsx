import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect, redirect } from 'next/navigation';
import { ArrowLeft, Calendar, Clock, Eye, Languages, MapPin, User } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth/session';
import { getConfig } from '@/lib/config';
import { CmsDocRenderer } from '@/lib/cms-core/renderer';
import type { TiptapDoc, TiptapNode } from '@/lib/cms-core/schema';
import { formatCmsTypeLabel } from '@/lib/i18n';
import { getServerPreferences } from '@/lib/preferences';
import {
  assertAdminActorHasPermission,
  getAdminActorContext,
} from '@/modules/admin-rbac';
import {
  getAdminCmsPreviewByIdOrSlug,
  getPublishedCmsBySlug,
  type PublishedCmsItem,
} from '@/modules/cms';
import {
  getCmsSettings,
  hydrateDynamicBlocksForDoc,
  resolveCmsRedirect,
} from '@/modules/cms-vietnomad';
import { renderVietNomadDynamicBlock } from '@/components/cms-public/VietNomadBlockRenderer';
import { ArticleAttributionTracker } from '@/components/cms-public/ArticleAttributionTracker';

export const dynamic = 'force-dynamic';

async function canCurrentUserPreviewCms(): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') return false;
  try {
    const actor = await getAdminActorContext(user);
    assertAdminActorHasPermission(actor, 'content', 'view');
    return true;
  } catch {
    return false;
  }
}

function extractFaqItemsFromDoc(doc: TiptapDoc): Array<{ question: string; answer: string }> {
  const out: Array<{ question: string; answer: string }> = [];
  for (const node of doc.content ?? []) {
    if (node.type === 'faqGroup' && Array.isArray(node.attrs?.items)) {
      for (const row of node.attrs.items as Array<{ question?: string; answer?: string }>) {
        if (row.question && row.answer) {
          out.push({ question: row.question, answer: row.answer });
        }
      }
    }
  }
  return out;
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preview?: string }>;
}): Promise<Metadata> {
  const [{ slug }, sp, settings] = await Promise.all([
    params,
    searchParams,
    getCmsSettings(),
  ]);
  const isPreview = sp.preview === '1' && (await canCurrentUserPreviewCms());
  const item = isPreview
    ? await getAdminCmsPreviewByIdOrSlug(slug)
    : await getPublishedCmsBySlug(slug);

  const siteSuffix = `${settings.seoDefaults.titleSeparator} ${settings.seoDefaults.siteName}`;
  if (!item) {
    return { title: `Guide Not Found ${siteSuffix}` };
  }

  const baseUrl = getConfig().appBaseUrl.replace(/\/$/, '');
  const title = item.seoTitle || `${item.titleEn} ${siteSuffix}`;
  const description =
    item.seoDescription || item.excerptEn || item.bodyEn.slice(0, 155);
  const ogImage = item.ogImageUrl || item.featuredImageUrl || '';

  const langAlternates: Record<string, string> = {};
  for (const alt of item.alternates) {
    langAlternates[alt.locale] = `${baseUrl}/guides/${alt.slug}`;
  }

  return {
    title,
    description,
    alternates: {
      canonical: item.canonicalUrl || `${baseUrl}/guides/${item.slug}`,
      languages: Object.keys(langAlternates).length > 0 ? langAlternates : undefined,
    },
    openGraph: {
      type: 'article',
      title: item.ogTitle || title,
      description: item.ogDescription || description,
      url: `${baseUrl}/guides/${item.slug}`,
      images: ogImage ? [{ url: ogImage }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: item.ogTitle || title,
      description: item.ogDescription || description,
      images: ogImage ? [ogImage] : undefined,
    },
    robots: isPreview
      ? { index: false, follow: false }
      : { index: item.robotsIndex, follow: item.robotsFollow },
  };
}

export default async function GuideDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const [{ slug }, sp, prefs, settings] = await Promise.all([
    params,
    searchParams,
    getServerPreferences(),
    getCmsSettings(),
  ]);

  const allowPreview = sp.preview === '1' && (await canCurrentUserPreviewCms());
  const item: PublishedCmsItem | null = allowPreview
    ? await getAdminCmsPreviewByIdOrSlug(slug)
    : await getPublishedCmsBySlug(slug);

  if (!item) {
    const redir = await resolveCmsRedirect(`/guides/${slug}`);
    if (redir) {
      if (redir.statusCode === 301) permanentRedirect(redir.targetPath);
      redirect(redir.targetPath);
    }
    notFound();
  }

  if (!allowPreview && item.redirectTo) {
    redirect(item.redirectTo);
  }

  const isVi = prefs.locale === 'vi';
  const title = isVi ? item.titleVi : item.titleEn;
  const excerpt = isVi ? item.excerptVi : item.excerptEn;
  const activeDoc = isVi ? item.docVi : item.docEn;

  // Hydrate all VietNomad dynamic blocks embedded inside the article in a single batched DB lookup
  const hydratorCtx = await hydrateDynamicBlocksForDoc(activeDoc, {
    excludeContentId: item.id,
  });

  const baseUrl = getConfig().appBaseUrl.replace(/\/$/, '');
  const faqs = extractFaqItemsFromDoc(activeDoc);
  const orgName = settings.seoDefaults.siteName || 'VietNomad Editorial Team';

  const jsonLd: Record<string, unknown>[] = [
    {
      '@context': 'https://schema.org',
      '@type': item.schemaType === 'FAQPage' ? 'Article' : item.schemaType,
      headline: title,
      description: item.seoDescription || excerpt || item.bodyEn.slice(0, 155),
      image: item.ogImageUrl || item.featuredImageUrl || undefined,
      datePublished: item.publishedAt ?? item.updatedAt,
      dateModified: item.updatedAt,
      author: {
        '@type': 'Organization',
        name: item.authorName || orgName,
      },
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': `${baseUrl}/guides/${item.slug}`,
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: baseUrl },
        { '@type': 'ListItem', position: 2, name: 'Guides', item: `${baseUrl}/guides` },
        {
          '@type': 'ListItem',
          position: 3,
          name: item.breadcrumbTitle || title,
          item: `${baseUrl}/guides/${item.slug}`,
        },
      ],
    },
  ];

  if (faqs.length > 0) {
    jsonLd.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqs.map((f) => ({
        '@type': 'Question',
        name: f.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: f.answer,
        },
      })),
    });
  }

  return (
    <article className="mx-auto max-w-4xl space-y-8 px-4 py-12 sm:px-6 lg:px-8">
      {!allowPreview && (
        <ArticleAttributionTracker
          eventType="article_view"
          contentId={item.id}
          contentSlug={item.slug}
          destinationSlug={item.destinationSlug ?? undefined}
        />
      )}

      {jsonLd.map((schemaObj, idx) => (
        <script
          key={idx}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaObj) }}
        />
      ))}

      {allowPreview && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#E6B87A] bg-[#FEF7EC] px-4 py-3 text-xs font-semibold text-[#6B4211]">
          <span className="inline-flex items-center gap-1.5">
            <Eye className="h-4 w-4" />
            Admin Draft Preview — Showing unpublished draft blocks &amp; status warnings.
          </span>
          <Link
            href={`/admin/growth/content/${item.id}`}
            className="rounded-lg bg-[#164E3F] px-3 py-1 text-white hover:bg-[#0F392E]"
          >
            Back to Studio Editor
          </Link>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/guides"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#164E3F] hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {isVi ? 'Xem tất cả cẩm nang' : 'All guides & stories'}
        </Link>

        {item.alternates.length > 1 && (
          <div className="inline-flex items-center gap-2 text-xs">
            <Languages className="h-3.5 w-3.5 text-[#53635D]" />
            {item.alternates.map((alt) => (
              <Link
                key={alt.locale}
                href={`/guides/${alt.slug}`}
                className={`rounded-full px-2.5 py-0.5 font-semibold uppercase ${
                  alt.slug === item.slug
                    ? 'bg-[#164E3F] text-white'
                    : 'border border-[#E5DFD3] bg-white text-[#53635D] hover:border-[#164E3F]'
                }`}
              >
                {alt.locale}
              </Link>
            ))}
          </div>
        )}
      </div>

      <header className="space-y-4 rounded-2xl border border-[#E5DFD3] bg-white p-7 sm:p-9">
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
          <span className="rounded-full bg-[#E7F1EC] px-3 py-1 font-semibold text-[#164E3F]">
            {item.categoryNameEn
              ? isVi
                ? item.categoryNameVi || item.categoryNameEn
                : item.categoryNameEn
              : formatCmsTypeLabel(item.contentType, prefs.locale)}
          </span>
          {item.destinationSlug && item.destinationNameEn && (
            <Link
              href={`/destinations/${item.destinationSlug}`}
              className="inline-flex items-center gap-1 rounded-full bg-[#FAEDE5] px-3 py-1 font-semibold text-[#C25E28] hover:underline"
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
          <span className="inline-flex items-center gap-1 text-[#53635D]">
            <Clock className="h-3.5 w-3.5" />
            {item.readingTimeMinutes} min read
          </span>
          <span className="inline-flex items-center gap-1 text-[#53635D]">
            <User className="h-3.5 w-3.5" />
            {item.authorName || orgName}
          </span>
        </div>

        <h1 className="font-serif-display text-3xl font-semibold leading-tight text-[#17221E] sm:text-4xl">
          {title}
        </h1>

        {excerpt && (
          <p className="text-base leading-relaxed text-[#53635D]">{excerpt}</p>
        )}

        {item.featuredImageUrl && (
          <figure className="pt-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.featuredImageUrl}
              alt={title}
              className="max-h-[420px] w-full rounded-2xl border border-[#E5DFD3] object-cover"
            />
          </figure>
        )}
      </header>

      <div className="rounded-2xl border border-[#E5DFD3] bg-white p-7 sm:p-9">
        <CmsDocRenderer
          doc={activeDoc}
          locale={prefs.locale}
          renderCustomBlock={(node: TiptapNode, key: string) =>
            renderVietNomadDynamicBlock({
              node,
              key,
              ctx: hydratorCtx,
              locale: prefs.locale,
              currency: prefs.currency,
              isPreview: allowPreview,
              sourceContentId: item.id,
            })
          }
        />
      </div>

      {item.destinationSlug && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-[#0F392E] p-6 text-white">
          <div>
            <div className="text-xs font-semibold text-[#E6B87A]">
              {isVi ? 'Khám phá chỗ ở' : 'Explore stays'}
            </div>
            <div className="mt-1 text-xl font-semibold">
              {isVi
                ? `Xem chỗ ở dài ngày tại ${item.destinationNameVi || item.destinationNameEn}`
                : `Browse long-stay homes in ${item.destinationNameEn}`}
            </div>
          </div>
          <Link
            href={`/destinations/${item.destinationSlug}`}
            className="inline-flex items-center gap-1.5 rounded-xl bg-white px-5 py-2.5 text-xs font-semibold text-[#0F392E] hover:bg-[#FAF8F3]"
          >
            {isVi ? 'Xem danh sách chỗ ở' : 'Browse stays'}
          </Link>
        </div>
      )}
    </article>
  );
}
