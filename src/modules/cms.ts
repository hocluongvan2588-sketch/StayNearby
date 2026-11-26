import { dbQuery } from '@/lib/db';

export type CmsContentType =
  | 'article'
  | 'landing_page'
  | 'destination_guide'
  | 'faq'
  | 'announcement'
  | 'hero_banner'
  | 'community_story';

export interface PublishedCmsItem {
  id: string;
  contentType: CmsContentType;
  category: string;
  slug: string;
  titleEn: string;
  titleVi: string;
  bodyEn: string;
  bodyVi: string;
  destinationId: string | null;
  destinationSlug: string | null;
  destinationNameEn: string | null;
  destinationNameVi: string | null;
  seoTitle: string;
  seoDescription: string;
  canonicalUrl: string;
  redirectTo: string;
  robotsIndex: boolean;
  publishedAt: string | null;
  updatedAt: string;
}

function mapCmsRow(c: Record<string, unknown>): PublishedCmsItem {
  return {
    id: String(c.id),
    contentType: String(c.content_type) as CmsContentType,
    category: String(c.category ?? 'living_guide'),
    slug: String(c.slug),
    titleEn: String(c.title_en),
    titleVi: String(c.title_vi || c.title_en),
    bodyEn: String(c.body_en ?? ''),
    bodyVi: String(c.body_vi || c.body_en || ''),
    destinationId: c.destination_id ? String(c.destination_id) : null,
    destinationSlug: c.destination_slug ? String(c.destination_slug) : null,
    destinationNameEn: c.destination_name_en ? String(c.destination_name_en) : null,
    destinationNameVi: c.destination_name_vi ? String(c.destination_name_vi) : null,
    seoTitle: String(c.seo_title ?? ''),
    seoDescription: String(c.seo_description ?? ''),
    canonicalUrl: String(c.canonical_url ?? ''),
    redirectTo: String(c.redirect_to ?? ''),
    robotsIndex: c.robots_index !== undefined ? Boolean(c.robots_index) : true,
    publishedAt: c.published_at ? new Date(String(c.published_at)).toISOString() : null,
    updatedAt: new Date(String(c.updated_at)).toISOString(),
  };
}

export async function getPublishedCmsContents(options?: {
  contentTypes?: CmsContentType[];
  destinationSlug?: string;
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

    const limit = Math.min(Math.max(options?.limit ?? 24, 1), 100);
    params.push(limit);

    const res = await dbQuery(
      `SELECT cc.*, d.slug AS destination_slug, d.name_en AS destination_name_en, d.name_vi AS destination_name_vi
       FROM cms_contents cc
       LEFT JOIN destinations d ON d.id = cc.destination_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY cc.published_at DESC NULLS LAST, cc.updated_at DESC
       LIMIT $${params.length}`,
      params
    );

    return res.rows.map(mapCmsRow);
  } catch {
    return [];
  }
}

export async function getPublishedCmsBySlug(slug: string): Promise<PublishedCmsItem | null> {
  const cleanSlug = slug.trim().toLowerCase();
  if (!cleanSlug) return null;

  try {
    const res = await dbQuery(
      `SELECT cc.*, d.slug AS destination_slug, d.name_en AS destination_name_en, d.name_vi AS destination_name_vi
       FROM cms_contents cc
       LEFT JOIN destinations d ON d.id = cc.destination_id
       WHERE LOWER(cc.slug) = $1
         AND cc.status = 'published'
         AND (cc.publish_start_at IS NULL OR cc.publish_start_at <= NOW())
         AND (cc.publish_end_at IS NULL OR cc.publish_end_at > NOW())
       LIMIT 1`,
      [cleanSlug]
    );
    return res.rows[0] ? mapCmsRow(res.rows[0]) : null;
  } catch {
    return null;
  }
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
