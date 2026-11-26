import { dbQuery, toNum } from '@/lib/db';
import { isValidUuid } from '@/lib/dates';
import {
  legacyTextToTiptapDoc,
  normalizeTiptapDoc,
  type TiptapDoc,
} from '@/lib/cms-core/schema';
import type { CmsContentType, CmsSchemaType } from './cms-vietnomad/types';

export type { CmsContentType };

export interface PublishedCmsItem {
  id: string;
  contentType: CmsContentType;
  category: string;
  categorySlug: string | null;
  categoryNameEn: string | null;
  categoryNameVi: string | null;
  locale: 'en' | 'vi';
  translationGroupId: string;
  slug: string;
  titleEn: string;
  titleVi: string;
  excerptEn: string;
  excerptVi: string;
  bodyEn: string;
  bodyVi: string;
  docEn: TiptapDoc;
  docVi: TiptapDoc;
  featuredImageUrl: string;
  destinationId: string | null;
  destinationSlug: string | null;
  destinationNameEn: string | null;
  destinationNameVi: string | null;
  seoTitle: string;
  seoDescription: string;
  ogTitle: string;
  ogDescription: string;
  ogImageUrl: string;
  canonicalUrl: string;
  redirectTo: string;
  robotsIndex: boolean;
  robotsFollow: boolean;
  schemaType: CmsSchemaType;
  breadcrumbTitle: string;
  readingTimeMinutes: number;
  wordCount: number;
  authorName: string | null;
  publishedAt: string | null;
  updatedAt: string;
  alternates: Array<{ locale: 'en' | 'vi'; slug: string }>;
}

function resolvePublicDoc(
  publishedDoc: unknown,
  draftDoc: unknown,
  legacyBody: string | null | undefined,
  isPreview = false
): TiptapDoc {
  if (isPreview && draftDoc && typeof draftDoc === 'object') {
    return normalizeTiptapDoc(draftDoc);
  }
  if (!isPreview && publishedDoc && typeof publishedDoc === 'object') {
    return normalizeTiptapDoc(publishedDoc);
  }
  if (draftDoc && typeof draftDoc === 'object') {
    return normalizeTiptapDoc(draftDoc);
  }
  return legacyTextToTiptapDoc(legacyBody);
}

function mapCmsRow(c: Record<string, unknown>, isPreview = false): PublishedCmsItem {
  const docEn = resolvePublicDoc(c.published_doc_en, c.body_doc_en, String(c.body_en ?? ''), isPreview);
  const docVi = resolvePublicDoc(
    c.published_doc_vi,
    c.body_doc_vi,
    String(c.body_vi || c.body_en || ''),
    isPreview
  );

  return {
    id: String(c.id),
    contentType: String(c.content_type) as CmsContentType,
    category: String(c.category ?? 'living_guide'),
    categorySlug: c.category_slug ? String(c.category_slug) : null,
    categoryNameEn: c.category_name_en ? String(c.category_name_en) : null,
    categoryNameVi: c.category_name_vi ? String(c.category_name_vi) : null,
    locale: c.locale === 'vi' ? 'vi' : 'en',
    translationGroupId: c.translation_group_id ? String(c.translation_group_id) : String(c.id),
    slug: String(c.slug),
    titleEn: String(c.title_en),
    titleVi: String(c.title_vi || c.title_en),
    excerptEn: String(c.excerpt_en ?? ''),
    excerptVi: String(c.excerpt_vi || c.excerpt_en || ''),
    bodyEn: String(c.body_en ?? ''),
    bodyVi: String(c.body_vi || c.body_en || ''),
    docEn,
    docVi,
    featuredImageUrl: String(c.featured_image_url ?? ''),
    destinationId: c.destination_id ? String(c.destination_id) : null,
    destinationSlug: c.destination_slug ? String(c.destination_slug) : null,
    destinationNameEn: c.destination_name_en ? String(c.destination_name_en) : null,
    destinationNameVi: c.destination_name_vi ? String(c.destination_name_vi) : null,
    seoTitle: String(c.seo_title ?? ''),
    seoDescription: String(c.seo_description ?? ''),
    ogTitle: String(c.og_title ?? ''),
    ogDescription: String(c.og_description ?? ''),
    ogImageUrl: String(c.og_image_url ?? ''),
    canonicalUrl: String(c.canonical_url ?? ''),
    redirectTo: String(c.redirect_to ?? ''),
    robotsIndex: c.robots_index !== undefined ? Boolean(c.robots_index) : true,
    robotsFollow: c.robots_follow !== undefined ? Boolean(c.robots_follow) : true,
    schemaType: (String(c.schema_type ?? 'Article') as CmsSchemaType),
    breadcrumbTitle: String(c.breadcrumb_title ?? ''),
    readingTimeMinutes: toNum(c.reading_time_minutes, 1),
    wordCount: toNum(c.word_count, 0),
    authorName: c.author_name ? String(c.author_name) : null,
    publishedAt: c.published_at ? new Date(String(c.published_at)).toISOString() : null,
    updatedAt: new Date(String(c.updated_at)).toISOString(),
    alternates: [],
  };
}

export async function getPublishedCmsContents(options?: {
  contentTypes?: CmsContentType[];
  destinationSlug?: string;
  categorySlug?: string;
  locale?: 'en' | 'vi';
  limit?: number;
}): Promise<PublishedCmsItem[]> {
  try {
    const conditions: string[] = [
      `cc.status = 'published'`,
      `(cc.publish_start_at IS NULL OR cc.publish_start_at <= NOW())`,
      `(cc.publish_end_at IS NULL OR cc.publish_end_at > NOW())`,
    ];
    const params: unknown[] = [];

    if (options?.contentTypes && options.contentTypes.length > 0) {
      params.push(options.contentTypes);
      conditions.push(`cc.content_type = ANY($${params.length}::text[])`);
    }
    if (options?.destinationSlug) {
      params.push(options.destinationSlug);
      conditions.push(`d.slug = $${params.length}`);
    }
    if (options?.categorySlug) {
      params.push(options.categorySlug);
      conditions.push(`(cat.slug = $${params.length} OR cc.category = $${params.length})`);
    }

    const limit = Math.min(Math.max(options?.limit ?? 24, 1), 100);
    params.push(limit);

    const res = await dbQuery(
      `SELECT cc.*,
              d.slug AS destination_slug, d.name_en AS destination_name_en, d.name_vi AS destination_name_vi,
              cat.slug AS category_slug, cat.name_en AS category_name_en, cat.name_vi AS category_name_vi,
              u.full_name AS author_name
       FROM cms_contents cc
       LEFT JOIN destinations d ON d.id = cc.destination_id
       LEFT JOIN cms_categories cat ON cat.id = cc.category_id
       LEFT JOIN users u ON u.id = cc.author_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY cc.published_at DESC NULLS LAST, cc.updated_at DESC
       LIMIT $${params.length}`,
      params
    );

    return res.rows.map((r) => mapCmsRow(r, false));
  } catch {
    return [];
  }
}

export async function getPublishedCmsBySlug(slug: string): Promise<PublishedCmsItem | null> {
  const cleanSlug = slug.trim().toLowerCase();
  if (!cleanSlug) return null;

  try {
    const res = await dbQuery(
      `SELECT cc.*,
              d.slug AS destination_slug, d.name_en AS destination_name_en, d.name_vi AS destination_name_vi,
              cat.slug AS category_slug, cat.name_en AS category_name_en, cat.name_vi AS category_name_vi,
              u.full_name AS author_name
       FROM cms_contents cc
       LEFT JOIN destinations d ON d.id = cc.destination_id
       LEFT JOIN cms_categories cat ON cat.id = cc.category_id
       LEFT JOIN users u ON u.id = cc.author_id
       WHERE LOWER(cc.slug) = $1
         AND (
           (cc.status = 'published'
             AND (cc.publish_start_at IS NULL OR cc.publish_start_at <= NOW())
             AND (cc.publish_end_at IS NULL OR cc.publish_end_at > NOW()))
           OR (cc.status = 'scheduled' AND cc.scheduled_at IS NOT NULL AND cc.scheduled_at <= NOW())
         )
       LIMIT 1`,
      [cleanSlug]
    );
    const row = res.rows[0];
    if (!row) return null;

    const item = mapCmsRow(row, false);
    const altRes = await dbQuery<{ locale: string; slug: string }>(
      `SELECT locale, slug FROM cms_contents
       WHERE translation_group_id = $1
         AND status = 'published'
         AND (publish_start_at IS NULL OR publish_start_at <= NOW())
         AND (publish_end_at IS NULL OR publish_end_at > NOW())`,
      [item.translationGroupId]
    );
    item.alternates = altRes.rows.map((a) => ({
      locale: a.locale === 'vi' ? 'vi' : 'en',
      slug: String(a.slug),
    }));
    return item;
  } catch {
    return null;
  }
}

export async function getAdminCmsPreviewByIdOrSlug(
  idOrSlug: string
): Promise<PublishedCmsItem | null> {
  const clean = idOrSlug.trim();
  if (!clean) return null;
  const where = isValidUuid(clean) ? `cc.id = $1` : `LOWER(cc.slug) = LOWER($1)`;
  const res = await dbQuery(
    `SELECT cc.*,
            d.slug AS destination_slug, d.name_en AS destination_name_en, d.name_vi AS destination_name_vi,
            cat.slug AS category_slug, cat.name_en AS category_name_en, cat.name_vi AS category_name_vi,
            u.full_name AS author_name
     FROM cms_contents cc
     LEFT JOIN destinations d ON d.id = cc.destination_id
     LEFT JOIN cms_categories cat ON cat.id = cc.category_id
     LEFT JOIN users u ON u.id = cc.author_id
     WHERE ${where}
     LIMIT 1`,
    [clean]
  );
  return res.rows[0] ? mapCmsRow(res.rows[0], true) : null;
}

export async function getIndexableCmsSlugs(): Promise<
  Array<{ slug: string; updatedAt: string }>
> {
  try {
    const res = await dbQuery<{ slug: string; updated_at: string }>(
      `SELECT slug, updated_at
       FROM cms_contents
       WHERE status = 'published'
         AND robots_index = TRUE
         AND COALESCE(redirect_to, '') = ''
         AND content_type NOT IN ('announcement', 'hero_banner')
         AND (publish_start_at IS NULL OR publish_start_at <= NOW())
         AND (publish_end_at IS NULL OR publish_end_at > NOW())
       ORDER BY updated_at DESC`
    );
    return res.rows.map((r) => ({
      slug: String(r.slug),
      updatedAt: new Date(String(r.updated_at)).toISOString(),
    }));
  } catch {
    return [];
  }
}
