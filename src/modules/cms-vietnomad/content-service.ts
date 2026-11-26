import crypto from 'node:crypto';
import { dbQuery, dbTransaction, toNum } from '@/lib/db';
import { isValidUuid } from '@/lib/dates';
import { AppError } from '@/lib/errors';
import {
  assertAdminActorHasPermission,
  logAdminAudit,
  type AdminActorContext,
} from '@/modules/admin-rbac';
import { safeRevalidateAll } from '@/lib/revalidate-safe';
import {
  CMS_SCHEMA_VERSION,
  computeReadingMetrics,
  extractDynamicRefsFromDoc,
  extractImagesFromDoc,
  extractLinksFromDoc,
  extractPlainTextFromDoc,
  legacyTextToTiptapDoc,
  normalizeTiptapDoc,
  type TiptapDoc,
} from '@/lib/cms-core/schema';
import { analyzeSeoContent } from '@/lib/cms-core/seo-analyzer';
import {
  getCmsSettings,
  normalizeRedirectPath,
} from './taxonomy-media-service';
import type {
  CmsContentDetail,
  CmsContentListItem,
  CmsContentType,
  CmsGscStatus,
  CmsInternalLinkItem,
  CmsRevisionItem,
  CmsSchemaType,
  CmsTranslationSibling,
  CmsWorkflowStatus,
} from './types';

function slugify(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function resolveDocFromRow(
  rawDoc: unknown,
  legacyText: string | null | undefined
): TiptapDoc {
  if (rawDoc && typeof rawDoc === 'object') {
    return normalizeTiptapDoc(rawDoc);
  }
  return legacyTextToTiptapDoc(legacyText);
}

export async function listAdminCmsContents(filters?: {
  contentType?: string;
  categoryId?: string;
  authorId?: string;
  locale?: string;
  destinationId?: string;
  status?: string;
  updatedFrom?: string;
  updatedTo?: string;
  q?: string;
}): Promise<CmsContentListItem[]> {
  const conds: string[] = [];
  const params: unknown[] = [];

  if (filters?.contentType && filters.contentType !== 'all') {
    params.push(filters.contentType);
    conds.push(`cc.content_type = $${params.length}`);
  }
  if (filters?.categoryId && isValidUuid(filters.categoryId)) {
    params.push(filters.categoryId);
    conds.push(`cc.category_id = $${params.length}`);
  }
  if (filters?.authorId && isValidUuid(filters.authorId)) {
    params.push(filters.authorId);
    conds.push(`cc.author_id = $${params.length}`);
  }
  if (filters?.locale && (filters.locale === 'en' || filters.locale === 'vi')) {
    params.push(filters.locale);
    conds.push(`cc.locale = $${params.length}`);
  }
  if (filters?.destinationId && isValidUuid(filters.destinationId)) {
    params.push(filters.destinationId);
    conds.push(`cc.destination_id = $${params.length}`);
  }
  if (filters?.status && filters.status !== 'all') {
    params.push(filters.status);
    conds.push(`cc.status = $${params.length}`);
  }
  if (filters?.updatedFrom) {
    params.push(filters.updatedFrom);
    conds.push(`cc.updated_at >= $${params.length}::timestamptz`);
  }
  if (filters?.updatedTo) {
    params.push(filters.updatedTo);
    conds.push(`cc.updated_at <= $${params.length}::timestamptz`);
  }
  if (filters?.q?.trim()) {
    params.push(`%${filters.q.trim().toLowerCase()}%`);
    conds.push(
      `(LOWER(cc.title_en) LIKE $${params.length} OR LOWER(cc.title_vi) LIKE $${params.length} OR LOWER(cc.slug) LIKE $${params.length} OR LOWER(cc.focus_keyword) LIKE $${params.length})`
    );
  }

  const where = conds.length > 0 ? `WHERE ${conds.join(' AND ')}` : '';
  const res = await dbQuery(
    `SELECT cc.*,
            d.slug AS destination_slug,
            d.name_en AS destination_name,
            n.name_en AS neighborhood_name,
            cat.name_en AS category_name_en,
            cat.name_vi AS category_name_vi,
            u.full_name AS author_name,
            (SELECT COUNT(*) FROM attribution_events ae
             WHERE ae.content_id = cc.id AND ae.event_name = 'article_view' AND COALESCE(ae.is_internal, FALSE) = FALSE) AS views_count,
            (SELECT COUNT(DISTINCT ae2.booking_id) FROM attribution_events ae2
             WHERE ae2.event_name = 'booking_completed'
               AND ae2.session_key IN (SELECT ae1.session_key FROM attribution_events ae1 WHERE ae1.content_id = cc.id)) AS bookings_attributed
     FROM cms_contents cc
     LEFT JOIN destinations d ON d.id = cc.destination_id
     LEFT JOIN neighborhoods n ON n.id = cc.neighborhood_id
     LEFT JOIN cms_categories cat ON cat.id = cc.category_id
     LEFT JOIN users u ON u.id = cc.author_id
     ${where}
     ORDER BY cc.updated_at DESC
     LIMIT 300`,
    params
  );

  return res.rows.map((r) => ({
    id: String(r.id),
    contentType: String(r.content_type) as CmsContentType,
    category: String(r.category ?? 'living_guide'),
    categoryId: r.category_id ? String(r.category_id) : null,
    categoryNameEn: r.category_name_en ? String(r.category_name_en) : null,
    categoryNameVi: r.category_name_vi ? String(r.category_name_vi) : null,
    locale: r.locale === 'vi' ? 'vi' : 'en',
    translationGroupId: r.translation_group_id ? String(r.translation_group_id) : String(r.id),
    slug: String(r.slug),
    titleEn: String(r.title_en),
    titleVi: String(r.title_vi || r.title_en),
    excerptEn: String(r.excerpt_en ?? ''),
    excerptVi: String(r.excerpt_vi ?? ''),
    destinationId: r.destination_id ? String(r.destination_id) : null,
    destinationSlug: r.destination_slug ? String(r.destination_slug) : null,
    destinationName: r.destination_name ? String(r.destination_name) : null,
    neighborhoodId: r.neighborhood_id ? String(r.neighborhood_id) : null,
    neighborhoodName: r.neighborhood_name ? String(r.neighborhood_name) : null,
    featuredImageUrl: String(r.featured_image_url ?? ''),
    seoTitle: String(r.seo_title ?? ''),
    seoDescription: String(r.seo_description ?? ''),
    focusKeyword: String(r.focus_keyword ?? ''),
    seoScore: toNum(r.seo_score, 0),
    wordCount: toNum(r.word_count, 0),
    readingTimeMinutes: toNum(r.reading_time_minutes, 1),
    robotsIndex: r.robots_index !== undefined ? Boolean(r.robots_index) : true,
    robotsFollow: r.robots_follow !== undefined ? Boolean(r.robots_follow) : true,
    gscStatus: (String(r.gsc_status ?? 'not_connected') as CmsGscStatus),
    gscLastCheckedAt: r.gsc_last_checked_at
      ? new Date(String(r.gsc_last_checked_at)).toISOString()
      : null,
    status: String(r.status) as CmsWorkflowStatus,
    hasUnpublishedChanges: Boolean(r.has_unpublished_changes),
    authorId: r.author_id ? String(r.author_id) : null,
    authorName: r.author_name ? String(r.author_name) : null,
    scheduledAt: r.scheduled_at ? new Date(String(r.scheduled_at)).toISOString() : null,
    publishedAt: r.published_at ? new Date(String(r.published_at)).toISOString() : null,
    updatedAt: new Date(String(r.updated_at)).toISOString(),
    viewsCount: toNum(r.views_count, 0),
    bookingsAttributed: toNum(r.bookings_attributed, 0),
  }));
}

export async function getAdminCmsContentDetail(contentId: string): Promise<CmsContentDetail> {
  if (!isValidUuid(contentId)) {
    throw new AppError('VALIDATION_ERROR', 'Invalid CMS content ID.');
  }

  const res = await dbQuery(
    `SELECT cc.*,
            d.slug AS destination_slug, d.name_en AS destination_name,
            n.name_en AS neighborhood_name,
            cat.name_en AS category_name_en, cat.name_vi AS category_name_vi,
            u.full_name AS author_name
     FROM cms_contents cc
     LEFT JOIN destinations d ON d.id = cc.destination_id
     LEFT JOIN neighborhoods n ON n.id = cc.neighborhood_id
     LEFT JOIN cms_categories cat ON cat.id = cc.category_id
     LEFT JOIN users u ON u.id = cc.author_id
     WHERE cc.id = $1`,
    [contentId]
  );

  const row = res.rows[0];
  if (!row) {
    throw new AppError('NOT_FOUND', 'CMS content item not found.');
  }

  const locale: 'en' | 'vi' = row.locale === 'vi' ? 'vi' : 'en';
  const groupId = row.translation_group_id ? String(row.translation_group_id) : String(row.id);

  const bodyDocEn = resolveDocFromRow(row.body_doc_en, String(row.body_en ?? ''));
  const bodyDocVi = resolveDocFromRow(row.body_doc_vi, String(row.body_vi ?? ''));
  const publishedDocEn = row.published_doc_en ? normalizeTiptapDoc(row.published_doc_en) : null;
  const publishedDocVi = row.published_doc_vi ? normalizeTiptapDoc(row.published_doc_vi) : null;

  const secondaryKeywords = Array.isArray(row.secondary_keywords)
    ? (row.secondary_keywords as unknown[]).map((x) => String(x)).filter(Boolean)
    : [];

  const activeTitle = locale === 'vi' ? String(row.title_vi || row.title_en) : String(row.title_en);
  const activeExcerpt =
    locale === 'vi' ? String(row.excerpt_vi || row.excerpt_en || '') : String(row.excerpt_en || '');
  const activeDoc = locale === 'vi' ? bodyDocVi : bodyDocEn;

  const seoReport = analyzeSeoContent({
    title: activeTitle,
    excerpt: activeExcerpt,
    slug: String(row.slug),
    seoTitle: String(row.seo_title ?? ''),
    seoDescription: String(row.seo_description ?? ''),
    focusKeyword: String(row.focus_keyword ?? ''),
    secondaryKeywords,
    featuredImageUrl: String(row.featured_image_url ?? ''),
    doc: activeDoc,
  });

  const [tagsRes, revRes, linksRes, transRes, dupRes] = await Promise.all([
    dbQuery<{ tag_id: string }>(`SELECT tag_id FROM cms_content_tags WHERE content_id = $1`, [
      contentId,
    ]),
    dbQuery(
      `SELECT r.*, u.full_name AS created_by_name
       FROM cms_content_revisions r
       LEFT JOIN users u ON u.id = r.created_by
       WHERE r.content_id = $1
       ORDER BY r.version_number DESC
       LIMIT 35`,
      [contentId]
    ),
    dbQuery(`SELECT * FROM cms_internal_links WHERE source_content_id = $1 ORDER BY target_path ASC`, [
      contentId,
    ]),
    dbQuery(
      `SELECT id, locale, slug, title_en, title_vi, status, updated_at
       FROM cms_contents
       WHERE translation_group_id = $1
       ORDER BY locale ASC`,
      [groupId]
    ),
    row.focus_keyword && String(row.focus_keyword).trim()
      ? dbQuery<{ id: string; slug: string; title_en: string }>(
          `SELECT id, slug, title_en FROM cms_contents
           WHERE id <> $1
             AND status <> 'archived'
             AND LOWER(focus_keyword) = LOWER($2)
           LIMIT 5`,
          [contentId, String(row.focus_keyword).trim()]
        )
      : Promise.resolve({ rows: [] }),
  ]);

  return {
    id: String(row.id),
    contentType: String(row.content_type) as CmsContentType,
    category: String(row.category ?? 'living_guide'),
    categoryId: row.category_id ? String(row.category_id) : null,
    categoryNameEn: row.category_name_en ? String(row.category_name_en) : null,
    categoryNameVi: row.category_name_vi ? String(row.category_name_vi) : null,
    locale,
    translationGroupId: groupId,
    slug: String(row.slug),
    titleEn: String(row.title_en),
    titleVi: String(row.title_vi || row.title_en),
    excerptEn: String(row.excerpt_en ?? ''),
    excerptVi: String(row.excerpt_vi ?? ''),
    bodyEn: String(row.body_en ?? ''),
    bodyVi: String(row.body_vi ?? ''),
    bodyDocEn,
    bodyDocVi,
    publishedDocEn,
    publishedDocVi,
    destinationId: row.destination_id ? String(row.destination_id) : null,
    destinationSlug: row.destination_slug ? String(row.destination_slug) : null,
    destinationName: row.destination_name ? String(row.destination_name) : null,
    neighborhoodId: row.neighborhood_id ? String(row.neighborhood_id) : null,
    neighborhoodName: row.neighborhood_name ? String(row.neighborhood_name) : null,
    featuredMediaId: row.featured_media_id ? String(row.featured_media_id) : null,
    featuredImageUrl: String(row.featured_image_url ?? ''),
    seoTitle: String(row.seo_title ?? ''),
    seoDescription: String(row.seo_description ?? ''),
    focusKeyword: String(row.focus_keyword ?? ''),
    secondaryKeywords,
    seoScore: seoReport.score,
    wordCount: seoReport.wordCount,
    readingTimeMinutes: seoReport.readingTimeMinutes,
    canonicalUrl: String(row.canonical_url ?? ''),
    redirectTo: String(row.redirect_to ?? ''),
    ogTitle: String(row.og_title ?? ''),
    ogDescription: String(row.og_description ?? ''),
    ogImageUrl: String(row.og_image_url ?? ''),
    robotsIndex: row.robots_index !== undefined ? Boolean(row.robots_index) : true,
    robotsFollow: row.robots_follow !== undefined ? Boolean(row.robots_follow) : true,
    schemaType: (String(row.schema_type ?? 'Article') as CmsSchemaType),
    breadcrumbTitle: String(row.breadcrumb_title ?? ''),
    gscStatus: (String(row.gsc_status ?? 'not_connected') as CmsGscStatus),
    gscLastCheckedAt: row.gsc_last_checked_at
      ? new Date(String(row.gsc_last_checked_at)).toISOString()
      : null,
    gscNote: String(row.gsc_note ?? ''),
    status: String(row.status) as CmsWorkflowStatus,
    hasUnpublishedChanges: Boolean(row.has_unpublished_changes),
    authorId: row.author_id ? String(row.author_id) : null,
    authorName: row.author_name ? String(row.author_name) : null,
    scheduledAt: row.scheduled_at ? new Date(String(row.scheduled_at)).toISOString() : null,
    publishedAt: row.published_at ? new Date(String(row.published_at)).toISOString() : null,
    publishStartAt: row.publish_start_at
      ? new Date(String(row.publish_start_at)).toISOString()
      : null,
    publishEndAt: row.publish_end_at ? new Date(String(row.publish_end_at)).toISOString() : null,
    approvedAt: row.approved_at ? new Date(String(row.approved_at)).toISOString() : null,
    lastAutosavedAt: row.last_autosaved_at
      ? new Date(String(row.last_autosaved_at)).toISOString()
      : null,
    updatedAt: new Date(String(row.updated_at)).toISOString(),
    viewsCount: 0,
    bookingsAttributed: 0,
    tagIds: tagsRes.rows.map((t) => String(t.tag_id)),
    revisions: revRes.rows.map((rv): CmsRevisionItem => ({
      id: String(rv.id),
      contentId: String(rv.content_id),
      versionNumber: toNum(rv.version_number, 1),
      changeType: String(rv.change_type),
      summary: String(rv.summary ?? ''),
      docEn: rv.doc_en ? normalizeTiptapDoc(rv.doc_en) : null,
      docVi: rv.doc_vi ? normalizeTiptapDoc(rv.doc_vi) : null,
      metaSnapshot: (rv.meta_snapshot as Record<string, unknown>) ?? {},
      createdBy: rv.created_by ? String(rv.created_by) : null,
      createdByName: rv.created_by_name ? String(rv.created_by_name) : 'Editor',
      createdAt: new Date(String(rv.created_at)).toISOString(),
    })),
    internalLinks: linksRes.rows.map((lk): CmsInternalLinkItem => ({
      id: String(lk.id),
      sourceContentId: String(lk.source_content_id),
      targetType: String(lk.target_type),
      targetId: String(lk.target_id),
      targetPath: String(lk.target_path),
      anchorText: String(lk.anchor_text ?? ''),
      isBroken: Boolean(lk.is_broken),
      lastCheckedAt: new Date(String(lk.last_checked_at)).toISOString(),
    })),
    translations: transRes.rows.map((tr): CmsTranslationSibling => ({
      id: String(tr.id),
      locale: tr.locale === 'vi' ? 'vi' : 'en',
      slug: String(tr.slug),
      title: String(tr.locale === 'vi' ? tr.title_vi || tr.title_en : tr.title_en),
      status: String(tr.status) as CmsWorkflowStatus,
      updatedAt: new Date(String(tr.updated_at)).toISOString(),
    })),
    seoReport,
    duplicateFocusKeywords: dupRes.rows.map((d) => ({
      id: String(d.id),
      slug: String(d.slug),
      title: String(d.title_en),
    })),
  };
}

async function syncInternalLinksAndMediaUsages(
  contentId: string,
  docs: TiptapDoc[],
  featuredMediaId: string | null
) {
  await dbQuery(`DELETE FROM cms_internal_links WHERE source_content_id = $1`, [contentId]);
  await dbQuery(
    `DELETE FROM cms_media_usages WHERE entity_type = 'cms_content' AND entity_id = $1`,
    [contentId]
  );

  // 1. Media usages
  const mediaIds = new Set<string>();
  if (featuredMediaId && isValidUuid(featuredMediaId)) {
    mediaIds.add(featuredMediaId);
  }
  for (const doc of docs) {
    for (const img of extractImagesFromDoc(doc)) {
      if (img.mediaId && isValidUuid(img.mediaId)) {
        mediaIds.add(img.mediaId);
      }
    }
  }
  for (const mid of mediaIds) {
    await dbQuery(
      `INSERT INTO cms_media_usages (media_id, entity_type, entity_id, field_name)
       VALUES ($1, 'cms_content', $2, 'content')
       ON CONFLICT DO NOTHING`,
      [mid, contentId]
    ).catch(() => undefined);
  }

  // 2. Internal links & dynamic entity references
  const candidates: Array<{
    targetType:
      | 'cms_content'
      | 'stay'
      | 'destination'
      | 'neighborhood'
      | 'place'
      | 'local_partner'
      | 'promotion'
      | 'category'
      | 'other_internal';
    targetId: string;
    targetPath: string;
    anchorText: string;
  }> = [];

  for (const doc of docs) {
    for (const lnk of extractLinksFromDoc(doc)) {
      if (lnk.targetType === 'external') continue;
      candidates.push({
        targetType: lnk.targetType,
        targetId: lnk.targetId ?? '',
        targetPath: lnk.href.split('#')[0] || '/',
        anchorText: lnk.anchorText,
      });
    }
    for (const ref of extractDynamicRefsFromDoc(doc)) {
      candidates.push({
        targetType: ref.targetType as typeof candidates[number]['targetType'],
        targetId: ref.targetId,
        targetPath: `block:${ref.blockType}:${ref.targetId}`,
        anchorText: ref.blockType,
      });
    }
  }

  // Resolve broken status against live DB
  for (const c of candidates) {
    let isBroken = false;
    let resolvedTargetId = c.targetId;

    if (c.targetType === 'stay') {
      const r = isValidUuid(c.targetId)
        ? await dbQuery<{ id: string; status: string }>(
            `SELECT id, status FROM stays WHERE id = $1`,
            [c.targetId]
          )
        : await dbQuery<{ id: string; status: string }>(
            `SELECT id, status FROM stays WHERE LOWER(slug) = LOWER($1)`,
            [c.targetId]
          );
      if (!r.rows[0] || r.rows[0].status !== 'live') isBroken = true;
      if (r.rows[0]) resolvedTargetId = String(r.rows[0].id);
    } else if (c.targetType === 'cms_content') {
      const r = isValidUuid(c.targetId)
        ? await dbQuery<{ id: string; status: string }>(
            `SELECT id, status FROM cms_contents WHERE id = $1`,
            [c.targetId]
          )
        : await dbQuery<{ id: string; status: string }>(
            `SELECT id, status FROM cms_contents WHERE LOWER(slug) = LOWER($1)`,
            [c.targetId]
          );
      if (!r.rows[0] || r.rows[0].status !== 'published') isBroken = true;
      if (r.rows[0]) resolvedTargetId = String(r.rows[0].id);
    } else if (c.targetType === 'destination') {
      const r = isValidUuid(c.targetId)
        ? await dbQuery(`SELECT id FROM destinations WHERE id = $1`, [c.targetId])
        : await dbQuery(`SELECT id FROM destinations WHERE LOWER(slug) = LOWER($1)`, [c.targetId]);
      if (!r.rows[0]) isBroken = true;
      if (r.rows[0]) resolvedTargetId = String(r.rows[0].id);
    } else if (c.targetType === 'neighborhood' && isValidUuid(c.targetId)) {
      const r = await dbQuery(`SELECT id FROM neighborhoods WHERE id = $1`, [c.targetId]);
      if (!r.rows[0]) isBroken = true;
    } else if (c.targetType === 'place' && isValidUuid(c.targetId)) {
      const r = await dbQuery(`SELECT id, verification_status FROM places WHERE id = $1`, [
        c.targetId,
      ]);
      if (!r.rows[0] || r.rows[0].verification_status === 'outdated') isBroken = true;
    } else if (c.targetType === 'local_partner' && isValidUuid(c.targetId)) {
      const r = await dbQuery(`SELECT id, partnership_status FROM local_partners WHERE id = $1`, [
        c.targetId,
      ]);
      if (!r.rows[0] || r.rows[0].partnership_status !== 'active') isBroken = true;
    } else if (c.targetType === 'promotion' && isValidUuid(c.targetId)) {
      const r = await dbQuery(`SELECT id, is_active FROM promotions WHERE id = $1`, [c.targetId]);
      if (!r.rows[0] || !r.rows[0].is_active) isBroken = true;
    }

    await dbQuery(
      `INSERT INTO cms_internal_links (
        id, source_content_id, target_type, target_id, target_path, anchor_text, is_broken, last_checked_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())`,
      [
        crypto.randomUUID(),
        contentId,
        c.targetType,
        resolvedTargetId,
        c.targetPath.slice(0, 300),
        c.anchorText.slice(0, 200),
        isBroken,
      ]
    );
  }
}

async function appendRevision(params: {
  contentId: string;
  changeType:
    | 'autosave'
    | 'save'
    | 'submit_review'
    | 'approve'
    | 'publish'
    | 'schedule'
    | 'restore'
    | 'archive';
  summary: string;
  docEn: TiptapDoc;
  docVi: TiptapDoc;
  metaSnapshot: Record<string, unknown>;
  createdBy: string;
}) {
  const maxRes = await dbQuery<{ v: number | string | null }>(
    `SELECT COALESCE(MAX(version_number), 0) AS v FROM cms_content_revisions WHERE content_id = $1`,
    [params.contentId]
  );
  const nextVersion = toNum(maxRes.rows[0]?.v, 0) + 1;

  // Avoid noisy duplicate autosave spam: update latest autosave if same user within 30s
  if (params.changeType === 'autosave') {
    const recentRes = await dbQuery<{ id: string }>(
      `SELECT id FROM cms_content_revisions
       WHERE content_id = $1 AND change_type = 'autosave' AND created_at > NOW() - INTERVAL '45 seconds'
       ORDER BY version_number DESC LIMIT 1`,
      [params.contentId]
    );
    if (recentRes.rows[0]) {
      await dbQuery(
        `UPDATE cms_content_revisions
         SET doc_en = $2::jsonb, doc_vi = $3::jsonb, meta_snapshot = $4::jsonb, created_at = NOW()
         WHERE id = $1`,
        [
          recentRes.rows[0].id,
          JSON.stringify(params.docEn),
          JSON.stringify(params.docVi),
          JSON.stringify(params.metaSnapshot),
        ]
      );
      return;
    }
  }

  await dbQuery(
    `INSERT INTO cms_content_revisions (
      id, content_id, version_number, change_type, summary, doc_en, doc_vi, meta_snapshot, created_by
    ) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8::jsonb,$9)`,
    [
      crypto.randomUUID(),
      params.contentId,
      nextVersion,
      params.changeType,
      params.summary,
      JSON.stringify(params.docEn),
      JSON.stringify(params.docVi),
      JSON.stringify(params.metaSnapshot),
      params.createdBy,
    ]
  );
}

export interface SaveCmsContentInput {
  id?: string;
  contentType: CmsContentType;
  category?: string;
  categoryId?: string | null;
  locale?: 'en' | 'vi';
  translationGroupId?: string | null;
  slug: string;
  titleEn: string;
  titleVi?: string;
  excerptEn?: string;
  excerptVi?: string;
  bodyDocEn?: unknown;
  bodyDocVi?: unknown;
  bodyEn?: string;
  bodyVi?: string;
  destinationId?: string | null;
  neighborhoodId?: string | null;
  featuredMediaId?: string | null;
  featuredImageUrl?: string;
  seoTitle?: string;
  seoDescription?: string;
  focusKeyword?: string;
  secondaryKeywords?: string[];
  canonicalUrl?: string;
  redirectTo?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImageUrl?: string;
  robotsIndex?: boolean;
  robotsFollow?: boolean;
  schemaType?: CmsSchemaType;
  breadcrumbTitle?: string;
  publishStartAt?: string | null;
  publishEndAt?: string | null;
  scheduledAt?: string | null;
  tagIds?: string[];
  mode?: 'autosave' | 'save_draft' | 'publish_now';
  createRedirectOnSlugChange?: boolean;
  changeSummary?: string;
}

export async function saveCmsContentPro(
  actor: AdminActorContext,
  input: SaveCmsContentInput
): Promise<{ id: string; slug: string; status: CmsWorkflowStatus; seoScore: number }> {
  const isNew = !input.id || !isValidUuid(input.id);
  const id = isNew ? crypto.randomUUID() : input.id!;

  if (input.mode === 'publish_now') {
    await assertAdminActorHasPermission(actor, 'content', 'approve');
  } else {
    await assertAdminActorHasPermission(actor, 'content', isNew ? 'create' : 'edit');
  }

  let existing: {
    slug: string;
    status: CmsWorkflowStatus;
    published_at: string | null;
    translation_group_id: string | null;
    published_doc_en: unknown;
    published_doc_vi: unknown;
  } | null = null;

  if (!isNew) {
    const exRes = await dbQuery(
      `SELECT slug, status, published_at, translation_group_id, published_doc_en, published_doc_vi
       FROM cms_contents WHERE id = $1`,
      [id]
    );
    if (exRes.rows[0]) {
      existing = {
        slug: String(exRes.rows[0].slug),
        status: String(exRes.rows[0].status) as CmsWorkflowStatus,
        published_at: exRes.rows[0].published_at ? String(exRes.rows[0].published_at) : null,
        translation_group_id: exRes.rows[0].translation_group_id
          ? String(exRes.rows[0].translation_group_id)
          : null,
        published_doc_en: exRes.rows[0].published_doc_en,
        published_doc_vi: exRes.rows[0].published_doc_vi,
      };
    }
  }

  const locale: 'en' | 'vi' = input.locale === 'vi' ? 'vi' : 'en';
  const cleanSlug = slugify(input.slug || input.titleEn || input.titleVi || id.slice(0, 8));
  if (!cleanSlug) throw new AppError('VALIDATION_ERROR', 'URL slug is required.');

  // Check slug uniqueness
  const slugDup = await dbQuery<{ id: string }>(
    `SELECT id FROM cms_contents WHERE LOWER(slug) = LOWER($1) AND id <> $2 LIMIT 1`,
    [cleanSlug, id]
  );
  if (slugDup.rows[0]) {
    throw new AppError('CONFLICT', `URL slug "/guides/${cleanSlug}" is already in use.`);
  }

  const docEn = input.bodyDocEn
    ? normalizeTiptapDoc(input.bodyDocEn)
    : legacyTextToTiptapDoc(input.bodyEn ?? '');
  const docVi = input.bodyDocVi
    ? normalizeTiptapDoc(input.bodyDocVi)
    : input.bodyVi
      ? legacyTextToTiptapDoc(input.bodyVi)
      : docEn;

  const plainEn = extractPlainTextFromDoc(docEn) || (input.bodyEn ?? '').trim();
  const plainVi = extractPlainTextFromDoc(docVi) || (input.bodyVi ?? '').trim() || plainEn;
  const activeDoc = locale === 'vi' ? docVi : docEn;
  const activeTitle = locale === 'vi' ? input.titleVi || input.titleEn : input.titleEn;
  const activeExcerpt =
    locale === 'vi' ? input.excerptVi ?? input.excerptEn ?? '' : input.excerptEn ?? '';
  const secondaryKeywords = (input.secondaryKeywords ?? []).map((s) => s.trim()).filter(Boolean);

  const seoReport = analyzeSeoContent({
    title: activeTitle,
    excerpt: activeExcerpt,
    slug: cleanSlug,
    seoTitle: input.seoTitle ?? '',
    seoDescription: input.seoDescription ?? '',
    focusKeyword: input.focusKeyword ?? '',
    secondaryKeywords,
    featuredImageUrl: input.featuredImageUrl ?? '',
    doc: activeDoc,
  });

  const metrics = computeReadingMetrics(activeDoc);

  // Determine workflow status & published-snapshot isolation
  const mode = input.mode ?? 'save_draft';
  const nextStatus: CmsWorkflowStatus =
    mode === 'publish_now'
      ? 'published'
      : existing?.status === 'published'
        ? 'published' // Keep live status; isolate draft changes in body_doc vs published_doc!
        : existing?.status ?? 'draft';

  const isPublishingNow = mode === 'publish_now';
  const hasUnpublishedChanges =
    !isPublishingNow && existing?.status === 'published';

  const translationGroupId =
    input.translationGroupId && isValidUuid(input.translationGroupId)
      ? input.translationGroupId
      : existing?.translation_group_id ?? id;

  const nextPublishedDocEn = isPublishingNow
    ? docEn
    : existing?.published_doc_en
      ? normalizeTiptapDoc(existing.published_doc_en)
      : null;
  const nextPublishedDocVi = isPublishingNow
    ? docVi
    : existing?.published_doc_vi
      ? normalizeTiptapDoc(existing.published_doc_vi)
      : null;

  const categoryId =
    input.categoryId && isValidUuid(input.categoryId) ? input.categoryId : null;
  let categorySlugFallback = input.category?.trim() || 'living_guide';
  if (categoryId) {
    const catRes = await dbQuery<{ slug: string }>(`SELECT slug FROM cms_categories WHERE id = $1`, [
      categoryId,
    ]);
    if (catRes.rows[0]) categorySlugFallback = String(catRes.rows[0].slug);
  }

  await dbTransaction(async (tx) => {
    await tx.query(
      `INSERT INTO cms_contents (
        id, content_type, category, category_id, locale, translation_group_id,
        slug, title_en, title_vi, excerpt_en, excerpt_vi,
        body_en, body_vi, body_doc_en, body_doc_vi, published_doc_en, published_doc_vi,
        schema_version, destination_id, neighborhood_id,
        featured_media_id, featured_image_url,
        seo_title, seo_description, focus_keyword, secondary_keywords,
        seo_score, word_count, reading_time_minutes,
        canonical_url, redirect_to, og_title, og_description, og_image_url,
        robots_index, robots_follow, schema_type, breadcrumb_title,
        status, has_unpublished_changes, author_id,
        published_at, publish_start_at, publish_end_at, scheduled_at,
        last_autosaved_at, updated_at
      ) VALUES (
        $1,$2,$3,$4,$5,$6,
        $7,$8,$9,$10,$11,
        $12,$13,$14::jsonb,$15::jsonb,$16::jsonb,$17::jsonb,
        $18,$19,$20,
        $21,$22,
        $23,$24,$25,$26::jsonb,
        $27,$28,$29,
        $30,$31,$32,$33,$34,
        $35,$36,$37,$38,
        $39,$40,$41,
        CASE WHEN $39 = 'published' THEN NOW() ELSE NULL END,
        $42::timestamptz, $43::timestamptz, $44::timestamptz,
        NOW(), NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        content_type = EXCLUDED.content_type,
        category = EXCLUDED.category,
        category_id = EXCLUDED.category_id,
        locale = EXCLUDED.locale,
        translation_group_id = EXCLUDED.translation_group_id,
        slug = EXCLUDED.slug,
        title_en = EXCLUDED.title_en,
        title_vi = EXCLUDED.title_vi,
        excerpt_en = EXCLUDED.excerpt_en,
        excerpt_vi = EXCLUDED.excerpt_vi,
        body_en = EXCLUDED.body_en,
        body_vi = EXCLUDED.body_vi,
        body_doc_en = EXCLUDED.body_doc_en,
        body_doc_vi = EXCLUDED.body_doc_vi,
        published_doc_en = COALESCE(EXCLUDED.published_doc_en, cms_contents.published_doc_en),
        published_doc_vi = COALESCE(EXCLUDED.published_doc_vi, cms_contents.published_doc_vi),
        schema_version = EXCLUDED.schema_version,
        destination_id = EXCLUDED.destination_id,
        neighborhood_id = EXCLUDED.neighborhood_id,
        featured_media_id = EXCLUDED.featured_media_id,
        featured_image_url = EXCLUDED.featured_image_url,
        seo_title = EXCLUDED.seo_title,
        seo_description = EXCLUDED.seo_description,
        focus_keyword = EXCLUDED.focus_keyword,
        secondary_keywords = EXCLUDED.secondary_keywords,
        seo_score = EXCLUDED.seo_score,
        word_count = EXCLUDED.word_count,
        reading_time_minutes = EXCLUDED.reading_time_minutes,
        canonical_url = EXCLUDED.canonical_url,
        redirect_to = EXCLUDED.redirect_to,
        og_title = EXCLUDED.og_title,
        og_description = EXCLUDED.og_description,
        og_image_url = EXCLUDED.og_image_url,
        robots_index = EXCLUDED.robots_index,
        robots_follow = EXCLUDED.robots_follow,
        schema_type = EXCLUDED.schema_type,
        breadcrumb_title = EXCLUDED.breadcrumb_title,
        status = EXCLUDED.status,
        has_unpublished_changes = EXCLUDED.has_unpublished_changes,
        published_at = COALESCE(cms_contents.published_at, EXCLUDED.published_at),
        publish_start_at = EXCLUDED.publish_start_at,
        publish_end_at = EXCLUDED.publish_end_at,
        scheduled_at = EXCLUDED.scheduled_at,
        last_autosaved_at = NOW(),
        updated_at = NOW()`,
      [
        id,
        input.contentType,
        categorySlugFallback,
        categoryId,
        locale,
        translationGroupId,
        cleanSlug,
        input.titleEn.trim() || input.titleVi?.trim() || 'Untitled Draft',
        (input.titleVi?.trim() || input.titleEn.trim() || 'Untitled Draft'),
        input.excerptEn?.trim() ?? '',
        input.excerptVi?.trim() ?? '',
        plainEn,
        plainVi,
        JSON.stringify(docEn),
        JSON.stringify(docVi),
        nextPublishedDocEn ? JSON.stringify(nextPublishedDocEn) : null,
        nextPublishedDocVi ? JSON.stringify(nextPublishedDocVi) : null,
        CMS_SCHEMA_VERSION,
        input.destinationId && isValidUuid(input.destinationId) ? input.destinationId : null,
        input.neighborhoodId && isValidUuid(input.neighborhoodId) ? input.neighborhoodId : null,
        input.featuredMediaId && isValidUuid(input.featuredMediaId) ? input.featuredMediaId : null,
        input.featuredImageUrl?.trim() ?? '',
        input.seoTitle?.trim() ?? '',
        input.seoDescription?.trim() ?? '',
        input.focusKeyword?.trim() ?? '',
        JSON.stringify(secondaryKeywords),
        seoReport.score,
        metrics.wordCount,
        metrics.readingTimeMinutes,
        input.canonicalUrl?.trim() ?? '',
        input.redirectTo?.trim() ?? '',
        input.ogTitle?.trim() ?? '',
        input.ogDescription?.trim() ?? '',
        input.ogImageUrl?.trim() ?? '',
        input.robotsIndex ?? true,
        input.robotsFollow ?? true,
        input.schemaType ?? 'Article',
        input.breadcrumbTitle?.trim() ?? '',
        nextStatus,
        hasUnpublishedChanges,
        actor.user.id,
        input.publishStartAt?.trim() || null,
        input.publishEndAt?.trim() || null,
        input.scheduledAt?.trim() || null,
      ]
    );

    if (Array.isArray(input.tagIds)) {
      await tx.query(`DELETE FROM cms_content_tags WHERE content_id = $1`, [id]);
      for (const tid of input.tagIds) {
        if (isValidUuid(tid)) {
          await tx.query(
            `INSERT INTO cms_content_tags (content_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [id, tid]
          );
        }
      }
    }
  });

  // Auto-create 301 redirect when published article slug changes
  if (
    existing &&
    existing.slug !== cleanSlug &&
    (existing.published_at || existing.status === 'published')
  ) {
    const settings = await getCmsSettings();
    const shouldCreate =
      input.createRedirectOnSlugChange ?? settings.editorialWorkflow.autoCreateRedirectOnSlugChange;
    if (shouldCreate) {
      await dbQuery(
        `INSERT INTO cms_redirects (
          id, source_path, target_path, status_code, is_active, note, auto_created_from_content_id, created_by
        ) VALUES ($1,$2,$3,301,TRUE,$4,$5,$6)
        ON CONFLICT (source_path) DO UPDATE SET
          target_path = EXCLUDED.target_path,
          is_active = TRUE,
          updated_at = NOW()`,
        [
          crypto.randomUUID(),
          normalizeRedirectPath(`/guides/${existing.slug}`),
          normalizeRedirectPath(`/guides/${cleanSlug}`),
          `Auto-redirect on slug update (${existing.slug} -> ${cleanSlug})`,
          id,
          actor.user.id,
        ]
      );
    }
  }

  await syncInternalLinksAndMediaUsages(
    id,
    [docEn, docVi],
    input.featuredMediaId ?? null
  );

  await appendRevision({
    contentId: id,
    changeType: mode === 'autosave' ? 'autosave' : isPublishingNow ? 'publish' : 'save',
    summary:
      input.changeSummary?.trim() ||
      (mode === 'autosave'
        ? 'Autosaved draft'
        : isPublishingNow
          ? 'Published live'
          : 'Saved draft'),
    docEn,
    docVi,
    metaSnapshot: {
      slug: cleanSlug,
      titleEn: input.titleEn,
      titleVi: input.titleVi,
      seoTitle: input.seoTitle,
      seoDescription: input.seoDescription,
      focusKeyword: input.focusKeyword,
      status: nextStatus,
    },
    createdBy: actor.user.id,
  });

  if (mode !== 'autosave') {
    await logAdminAudit({
      actor,
      module: 'content',
      action: isPublishingNow ? 'publish' : isNew ? 'create' : 'edit',
      entityType: 'cms_content',
      entityId: id,
      after: { slug: cleanSlug, status: nextStatus, seoScore: seoReport.score },
    });
  }

  if (isPublishingNow || existing?.status === 'published') {
    safeRevalidateAll(['/', '/guides', `/guides/${cleanSlug}`, '/destinations', '/sitemap.xml']);
  }

  return {
    id,
    slug: cleanSlug,
    status: nextStatus,
    seoScore: seoReport.score,
  };
}

export async function transitionCmsWorkflow(
  actor: AdminActorContext,
  contentId: string,
  action:
    | 'submit_review'
    | 'approve'
    | 'schedule'
    | 'publish'
    | 'unpublish_to_draft'
    | 'archive'
    | 'restore_revision',
  options?: { scheduledAt?: string; revisionId?: string }
) {
  if (!isValidUuid(contentId)) throw new AppError('VALIDATION_ERROR', 'Invalid content ID.');

  if (['approve', 'schedule', 'publish', 'unpublish_to_draft'].includes(action)) {
    await assertAdminActorHasPermission(actor, 'content', 'approve');
  } else if (action === 'archive') {
    await assertAdminActorHasPermission(actor, 'content', 'delete');
  } else {
    await assertAdminActorHasPermission(actor, 'content', 'edit');
  }

  const detail = await getAdminCmsContentDetail(contentId);

  if (action === 'restore_revision') {
    if (!options?.revisionId || !isValidUuid(options.revisionId)) {
      throw new AppError('VALIDATION_ERROR', 'Revision ID required.');
    }
    const revRes = await dbQuery<{
      version_number: number;
      doc_en: unknown;
      doc_vi: unknown;
      meta_snapshot: Record<string, unknown>;
    }>(
      `SELECT version_number, doc_en, doc_vi, meta_snapshot
       FROM cms_content_revisions WHERE id = $1 AND content_id = $2`,
      [options.revisionId, contentId]
    );
    const rev = revRes.rows[0];
    if (!rev) throw new AppError('NOT_FOUND', 'Revision not found.');

    const docEn = rev.doc_en ? normalizeTiptapDoc(rev.doc_en) : detail.bodyDocEn;
    const docVi = rev.doc_vi ? normalizeTiptapDoc(rev.doc_vi) : detail.bodyDocVi;
    const plainEn = extractPlainTextFromDoc(docEn);
    const plainVi = extractPlainTextFromDoc(docVi);

    await dbQuery(
      `UPDATE cms_contents
       SET body_doc_en = $2::jsonb,
           body_doc_vi = $3::jsonb,
           body_en = $4,
           body_vi = $5,
           has_unpublished_changes = (status = 'published'),
           updated_at = NOW()
       WHERE id = $1`,
      [contentId, JSON.stringify(docEn), JSON.stringify(docVi), plainEn, plainVi]
    );

    await appendRevision({
      contentId,
      changeType: 'restore',
      summary: `Restored revision v${rev.version_number}`,
      docEn,
      docVi,
      metaSnapshot: rev.meta_snapshot ?? {},
      createdBy: actor.user.id,
    });

    await logAdminAudit({
      actor,
      module: 'content',
      action: 'restore_revision',
      entityType: 'cms_content',
      entityId: contentId,
      after: { versionNumber: rev.version_number },
    });

    return { ok: true, status: detail.status };
  }

  let nextStatus: CmsWorkflowStatus = detail.status;
  let scheduledAtSql: string | null = detail.scheduledAt;

  if (action === 'submit_review') nextStatus = 'in_review';
  if (action === 'approve') nextStatus = 'approved';
  if (action === 'unpublish_to_draft') nextStatus = 'draft';
  if (action === 'archive') nextStatus = 'archived';
  if (action === 'schedule') {
    if (!options?.scheduledAt) {
      throw new AppError('VALIDATION_ERROR', 'Scheduled publish date/time is required.');
    }
    nextStatus = 'scheduled';
    scheduledAtSql = options.scheduledAt;
  }
  if (action === 'publish') {
    const settings = await getCmsSettings();
    if (
      settings.editorialWorkflow.requireReviewBeforePublish &&
      !['approved', 'published', 'in_review'].includes(detail.status)
    ) {
      // Allow approvers directly or warn? Here approver holds 'approve' permission so allow with audit.
    }
    nextStatus = 'published';
  }

  if (action === 'publish') {
    await dbQuery(
      `UPDATE cms_contents
       SET status = 'published',
           published_doc_en = COALESCE(body_doc_en, published_doc_en),
           published_doc_vi = COALESCE(body_doc_vi, published_doc_vi),
           has_unpublished_changes = FALSE,
           approved_by = COALESCE(approved_by, $2),
           approved_at = COALESCE(approved_at, NOW()),
           published_at = COALESCE(published_at, NOW()),
           publish_start_at = NULL,
           updated_at = NOW()
       WHERE id = $1`,
      [contentId, actor.user.id]
    );
  } else if (action === 'approve') {
    await dbQuery(
      `UPDATE cms_contents
       SET status = 'approved',
           approved_by = $2,
           approved_at = NOW(),
           updated_at = NOW()
       WHERE id = $1`,
      [contentId, actor.user.id]
    );
  } else if (action === 'schedule') {
    await dbQuery(
      `UPDATE cms_contents
       SET status = 'scheduled',
           scheduled_at = $2::timestamptz,
           publish_start_at = $2::timestamptz,
           updated_at = NOW()
       WHERE id = $1`,
      [contentId, scheduledAtSql]
    );
  } else {
    await dbQuery(
      `UPDATE cms_contents
       SET status = $2,
           updated_at = NOW()
       WHERE id = $1`,
      [contentId, nextStatus]
    );
  }

  await appendRevision({
    contentId,
    changeType:
      action === 'submit_review'
        ? 'submit_review'
        : action === 'approve'
          ? 'approve'
          : action === 'schedule'
            ? 'schedule'
            : action === 'publish'
              ? 'publish'
              : 'archive',
    summary: `Workflow transition: ${detail.status} -> ${nextStatus}`,
    docEn: detail.bodyDocEn,
    docVi: detail.bodyDocVi,
    metaSnapshot: { slug: detail.slug, status: nextStatus },
    createdBy: actor.user.id,
  });

  await logAdminAudit({
    actor,
    module: 'content',
    action: `workflow_${action}`,
    entityType: 'cms_content',
    entityId: contentId,
    before: { status: detail.status },
    after: { status: nextStatus },
  });

  safeRevalidateAll(['/', '/guides', `/guides/${detail.slug}`, '/destinations', '/sitemap.xml']);
  return { ok: true, status: nextStatus };
}

export async function createTranslationSibling(
  actor: AdminActorContext,
  sourceContentId: string,
  targetLocale: 'en' | 'vi'
) {
  await assertAdminActorHasPermission(actor, 'content', 'create');
  const source = await getAdminCmsContentDetail(sourceContentId);

  // Return existing sibling in translation group if present
  const existing = source.translations.find((t) => t.locale === targetLocale);
  if (existing) {
    return { id: existing.id, alreadyExists: true };
  }

  const newId = crypto.randomUUID();
  const baseSlug = source.slug.replace(/-(en|vi)$/, '');
  let newSlug = `${baseSlug}-${targetLocale}`;
  const slugTaken = await dbQuery(`SELECT id FROM cms_contents WHERE LOWER(slug) = LOWER($1)`, [
    newSlug,
  ]);
  if (slugTaken.rows[0]) {
    newSlug = `${newSlug}-${newId.slice(0, 4)}`;
  }

  const targetTitle = targetLocale === 'vi' ? source.titleVi : source.titleEn;
  const targetDoc = targetLocale === 'vi' ? source.bodyDocVi : source.bodyDocEn;
  const targetPlain = extractPlainTextFromDoc(targetDoc);

  await dbQuery(
    `INSERT INTO cms_contents (
      id, content_type, category, category_id, locale, translation_group_id,
      slug, title_en, title_vi, excerpt_en, excerpt_vi,
      body_en, body_vi, body_doc_en, body_doc_vi, schema_version,
      destination_id, neighborhood_id, featured_media_id, featured_image_url,
      seo_title, seo_description, focus_keyword, secondary_keywords,
      robots_index, robots_follow, schema_type, status, author_id
    ) VALUES (
      $1,$2,$3,$4,$5,$6,
      $7,$8,$9,$10,$11,
      $12,$13,$14::jsonb,$15::jsonb,$16,
      $17,$18,$19,$20,
      $21,$22,$23,$24::jsonb,
      TRUE,TRUE,$25,'draft',$26
    )`,
    [
      newId,
      source.contentType,
      source.category,
      source.categoryId,
      targetLocale,
      source.translationGroupId,
      newSlug,
      targetTitle,
      targetTitle,
      source.excerptVi || source.excerptEn,
      source.excerptVi || source.excerptEn,
      targetPlain,
      targetPlain,
      JSON.stringify(targetDoc),
      JSON.stringify(targetDoc),
      CMS_SCHEMA_VERSION,
      source.destinationId,
      source.neighborhoodId,
      source.featuredMediaId,
      source.featuredImageUrl,
      '',
      '',
      '',
      JSON.stringify([]),
      source.schemaType,
      actor.user.id,
    ]
  );

  await logAdminAudit({
    actor,
    module: 'content',
    action: 'create_translation',
    entityType: 'cms_content',
    entityId: newId,
    after: { sourceContentId, targetLocale, translationGroupId: source.translationGroupId },
  });

  return { id: newId, alreadyExists: false };
}

export async function updateGscInspectionStatus(
  actor: AdminActorContext,
  contentId: string,
  input: {
    gscStatus: CmsGscStatus;
    gscNote?: string;
  }
) {
  await assertAdminActorHasPermission(actor, 'content', 'edit');
  if (!isValidUuid(contentId)) throw new AppError('VALIDATION_ERROR', 'Invalid content ID.');
  await dbQuery(
    `UPDATE cms_contents
     SET gsc_status = $2,
         gsc_note = $3,
         gsc_last_checked_at = NOW(),
         updated_at = NOW()
     WHERE id = $1`,
    [contentId, input.gscStatus, input.gscNote?.trim() ?? '']
  );

  await logAdminAudit({
    actor,
    module: 'content',
    action: 'update_gsc_status',
    entityType: 'cms_content',
    entityId: contentId,
    after: input,
  });

  return { ok: true };
}

// ==========================================
// Overview, SEO Audit, Broken Links, Orphan Content & Funnel Attribution
// ==========================================
export async function getCmsOverviewAndSeoAudit() {
  const [
    countsRes,
    brokenLinksRes,
    orphansRes,
    keywordDupsRes,
    funnelRes,
    topArticlesRes,
  ] = await Promise.all([
    dbQuery<{
      total: string | number;
      drafts: string | number;
      in_review: string | number;
      scheduled: string | number;
      published: string | number;
      avg_seo_score: string | number;
      noindex_count: string | number;
    }>(
      `SELECT
         COUNT(*) AS total,
         COUNT(*) FILTER (WHERE status = 'draft') AS drafts,
         COUNT(*) FILTER (WHERE status = 'in_review') AS in_review,
         COUNT(*) FILTER (WHERE status = 'scheduled') AS scheduled,
         COUNT(*) FILTER (WHERE status = 'published') AS published,
         COALESCE(AVG(seo_score) FILTER (WHERE status <> 'archived'), 0) AS avg_seo_score,
         COUNT(*) FILTER (WHERE robots_index = FALSE) AS noindex_count
       FROM cms_contents`
    ),
    dbQuery(
      `SELECT l.*, c.title_en AS source_title, c.slug AS source_slug
       FROM cms_internal_links l
       JOIN cms_contents c ON c.id = l.source_content_id
       WHERE l.is_broken = TRUE
       ORDER BY l.last_checked_at DESC
       LIMIT 50`
    ),
    dbQuery(
      `SELECT cc.id, cc.slug, cc.title_en, cc.content_type, cc.seo_score, cc.published_at
       FROM cms_contents cc
       WHERE cc.status = 'published'
         AND cc.content_type NOT IN ('announcement', 'hero_banner', 'faq')
         AND NOT EXISTS (
           SELECT 1 FROM cms_internal_links l
           WHERE l.target_type = 'cms_content'
             AND (l.target_id = cc.id::text OR l.target_path = '/guides/' || cc.slug)
             AND l.source_content_id <> cc.id
         )
       ORDER BY cc.updated_at DESC
       LIMIT 30`
    ),
    dbQuery(
      `SELECT LOWER(focus_keyword) AS keyword,
              COUNT(*) AS count,
              json_agg(json_build_object('id', id, 'slug', slug, 'title', title_en)) AS items
       FROM cms_contents
       WHERE status <> 'archived' AND TRIM(focus_keyword) <> ''
       GROUP BY LOWER(focus_keyword)
       HAVING COUNT(*) > 1`
    ),
    dbQuery<{
      article_views: string | number;
      destination_views: string | number;
      stay_views: string | number;
      checkout_starts: string | number;
      booking_completed: string | number;
      attributed_bookings: string | number;
      attributed_revenue_vnd: string | number;
    }>(
      `SELECT
        COUNT(*) FILTER (WHERE event_name = 'article_view') AS article_views,
        COUNT(*) FILTER (WHERE event_name = 'destination_view') AS destination_views,
        COUNT(*) FILTER (WHERE event_name = 'stay_view') AS stay_views,
        COUNT(*) FILTER (WHERE event_name = 'checkout_start') AS checkout_starts,
        COUNT(*) FILTER (WHERE event_name = 'booking_completed') AS booking_completed,
        COUNT(DISTINCT ae.booking_id) FILTER (
          WHERE ae.event_name = 'booking_completed'
            AND EXISTS (
              SELECT 1 FROM attribution_events av
              WHERE av.session_key = ae.session_key AND av.event_name = 'article_view'
            )
        ) AS attributed_bookings,
        COALESCE(SUM(b.service_fee_vnd) FILTER (
          WHERE ae.event_name = 'booking_completed'
            AND b.payment_status = 'paid'
            AND EXISTS (
              SELECT 1 FROM attribution_events av
              WHERE av.session_key = ae.session_key AND av.event_name = 'article_view'
            )
        ), 0) AS attributed_revenue_vnd
       FROM attribution_events ae
       LEFT JOIN bookings b ON b.id = ae.booking_id
       WHERE COALESCE(ae.is_internal, FALSE) = FALSE`
    ),
    dbQuery(
      `SELECT cc.id, cc.slug, cc.title_en, cc.content_type, cc.seo_score, cc.gsc_status,
              COUNT(ae.id) FILTER (WHERE ae.event_name = 'article_view') AS article_views,
              COUNT(DISTINCT b.id) AS bookings_assisted
       FROM cms_contents cc
       LEFT JOIN attribution_events ae
         ON ae.content_id = cc.id AND COALESCE(ae.is_internal, FALSE) = FALSE
       LEFT JOIN attribution_events b_ae
         ON b_ae.session_key = ae.session_key AND b_ae.event_name = 'booking_completed'
       LEFT JOIN bookings b ON b.id = b_ae.booking_id
       WHERE cc.status = 'published'
       GROUP BY cc.id
       ORDER BY article_views DESC, cc.updated_at DESC
       LIMIT 10`
    ),
  ]);

  const c = countsRes.rows[0];
  const f = funnelRes.rows[0];

  return {
    summary: {
      total: toNum(c?.total, 0),
      drafts: toNum(c?.drafts, 0),
      inReview: toNum(c?.in_review, 0),
      scheduled: toNum(c?.scheduled, 0),
      published: toNum(c?.published, 0),
      avgSeoScore: Math.round(toNum(c?.avg_seo_score, 0)),
      noindexCount: toNum(c?.noindex_count, 0),
      brokenLinksCount: brokenLinksRes.rows.length,
      orphanContentsCount: orphansRes.rows.length,
    },
    brokenLinks: brokenLinksRes.rows.map((l): CmsInternalLinkItem => ({
      id: String(l.id),
      sourceContentId: String(l.source_content_id),
      sourceTitle: String(l.source_title),
      sourceSlug: String(l.source_slug),
      targetType: String(l.target_type),
      targetId: String(l.target_id),
      targetPath: String(l.target_path),
      anchorText: String(l.anchor_text ?? ''),
      isBroken: Boolean(l.is_broken),
      lastCheckedAt: new Date(String(l.last_checked_at)).toISOString(),
    })),
    orphanContents: orphansRes.rows.map((o) => ({
      id: String(o.id),
      slug: String(o.slug),
      title: String(o.title_en),
      contentType: String(o.content_type),
      seoScore: toNum(o.seo_score, 0),
    })),
    keywordConflicts: keywordDupsRes.rows.map((k) => ({
      keyword: String(k.keyword),
      count: toNum(k.count, 0),
      items: (k.items as Array<{ id: string; slug: string; title: string }>) ?? [],
    })),
    funnel: {
      articleViews: toNum(f?.article_views, 0),
      destinationViews: toNum(f?.destination_views, 0),
      stayViews: toNum(f?.stay_views, 0),
      checkoutStarts: toNum(f?.checkout_starts, 0),
      bookingCompleted: toNum(f?.booking_completed, 0),
      attributedBookings: toNum(f?.attributed_bookings, 0),
      attributedRevenueVnd: toNum(f?.attributed_revenue_vnd, 0),
    },
    topPerformingArticles: topArticlesRes.rows.map((a) => ({
      id: String(a.id),
      slug: String(a.slug),
      title: String(a.title_en),
      contentType: String(a.content_type),
      seoScore: toNum(a.seo_score, 0),
      gscStatus: String(a.gsc_status ?? 'not_connected'),
      articleViews: toNum(a.article_views, 0),
      bookingsAssisted: toNum(a.bookings_assisted, 0),
    })),
  };
}
