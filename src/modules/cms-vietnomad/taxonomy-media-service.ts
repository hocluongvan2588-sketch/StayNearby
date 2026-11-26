import crypto from 'node:crypto';
import { dbQuery, toNum } from '@/lib/db';
import { isValidUuid } from '@/lib/dates';
import { AppError } from '@/lib/errors';
import { logAdminAudit, type AdminActorContext } from '@/modules/admin-rbac';
import { safeRevalidateAll } from '@/lib/revalidate-safe';
import { deleteCmsUploadedMedia } from '@/lib/storage';
import type {
  CmsCategoryItem,
  CmsMediaItem,
  CmsRedirectItem,
  CmsSettingsBundle,
  CmsTagItem,
} from './types';

function cleanSlug(raw: string): string {
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

export function normalizeRedirectPath(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '/';
  const withoutOrigin = trimmed.replace(/^https?:\/\/[^/]+/i, '');
  const withSlash = withoutOrigin.startsWith('/') ? withoutOrigin : `/${withoutOrigin}`;
  return withSlash.replace(/\/{2,}/g, '/').replace(/\/$/, '') || '/';
}

// ==========================================
// Categories & Tags
// ==========================================
export async function listCmsCategories(): Promise<CmsCategoryItem[]> {
  const res = await dbQuery(
    `SELECT c.*,
            (SELECT COUNT(*) FROM cms_contents cc WHERE cc.category_id = c.id) AS article_count
     FROM cms_categories c
     ORDER BY c.sort_order ASC, c.name_en ASC`
  );
  return res.rows.map((r) => ({
    id: String(r.id),
    slug: String(r.slug),
    nameEn: String(r.name_en),
    nameVi: String(r.name_vi),
    descriptionEn: String(r.description_en ?? ''),
    descriptionVi: String(r.description_vi ?? ''),
    parentId: r.parent_id ? String(r.parent_id) : null,
    sortOrder: toNum(r.sort_order, 0),
    seoTitle: String(r.seo_title ?? ''),
    seoDescription: String(r.seo_description ?? ''),
    robotsIndex: r.robots_index !== undefined ? Boolean(r.robots_index) : true,
    articleCount: toNum(r.article_count, 0),
  }));
}

export async function upsertCmsCategory(
  actor: AdminActorContext,
  input: {
    id?: string;
    slug: string;
    nameEn: string;
    nameVi: string;
    descriptionEn?: string;
    descriptionVi?: string;
    parentId?: string | null;
    sortOrder?: number;
    seoTitle?: string;
    seoDescription?: string;
    robotsIndex?: boolean;
  }
) {
  const id = input.id && isValidUuid(input.id) ? input.id : crypto.randomUUID();
  const slug = cleanSlug(input.slug || input.nameEn);
  if (!slug) throw new AppError('VALIDATION_ERROR', 'Invalid category slug.');

  await dbQuery(
    `INSERT INTO cms_categories (
      id, slug, name_en, name_vi, description_en, description_vi, parent_id,
      sort_order, seo_title, seo_description, robots_index, updated_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())
    ON CONFLICT (id) DO UPDATE SET
      slug = EXCLUDED.slug,
      name_en = EXCLUDED.name_en,
      name_vi = EXCLUDED.name_vi,
      description_en = EXCLUDED.description_en,
      description_vi = EXCLUDED.description_vi,
      parent_id = EXCLUDED.parent_id,
      sort_order = EXCLUDED.sort_order,
      seo_title = EXCLUDED.seo_title,
      seo_description = EXCLUDED.seo_description,
      robots_index = EXCLUDED.robots_index,
      updated_at = NOW()`,
    [
      id,
      slug,
      input.nameEn.trim(),
      input.nameVi.trim() || input.nameEn.trim(),
      input.descriptionEn?.trim() ?? '',
      input.descriptionVi?.trim() ?? '',
      input.parentId && isValidUuid(input.parentId) && input.parentId !== id
        ? input.parentId
        : null,
      Math.round(input.sortOrder ?? 0),
      input.seoTitle?.trim() ?? '',
      input.seoDescription?.trim() ?? '',
      input.robotsIndex ?? true,
    ]
  );

  await logAdminAudit({
    actor,
    module: 'content',
    action: input.id ? 'edit_category' : 'create_category',
    entityType: 'cms_category',
    entityId: id,
    after: { slug, nameEn: input.nameEn },
  });

  safeRevalidateAll(['/guides', '/sitemap.xml']);
  return { id, slug };
}

export async function deleteCmsCategory(actor: AdminActorContext, categoryId: string) {
  if (!isValidUuid(categoryId)) throw new AppError('VALIDATION_ERROR', 'Invalid category ID.');
  await dbQuery(`UPDATE cms_contents SET category_id = NULL WHERE category_id = $1`, [categoryId]);
  await dbQuery(`DELETE FROM cms_categories WHERE id = $1`, [categoryId]);
  await logAdminAudit({
    actor,
    module: 'content',
    action: 'delete_category',
    entityType: 'cms_category',
    entityId: categoryId,
  });
  return { ok: true };
}

export async function listCmsTags(): Promise<CmsTagItem[]> {
  const res = await dbQuery(
    `SELECT t.*,
            (SELECT COUNT(*) FROM cms_content_tags ct WHERE ct.tag_id = t.id) AS article_count
     FROM cms_tags t
     ORDER BY t.name_en ASC`
  );
  return res.rows.map((r) => ({
    id: String(r.id),
    slug: String(r.slug),
    nameEn: String(r.name_en),
    nameVi: String(r.name_vi),
    articleCount: toNum(r.article_count, 0),
  }));
}

export async function upsertCmsTag(
  actor: AdminActorContext,
  input: { id?: string; slug: string; nameEn: string; nameVi?: string }
) {
  const id = input.id && isValidUuid(input.id) ? input.id : crypto.randomUUID();
  const slug = cleanSlug(input.slug || input.nameEn);
  if (!slug) throw new AppError('VALIDATION_ERROR', 'Invalid tag slug.');

  await dbQuery(
    `INSERT INTO cms_tags (id, slug, name_en, name_vi)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (id) DO UPDATE SET
       slug = EXCLUDED.slug,
       name_en = EXCLUDED.name_en,
       name_vi = EXCLUDED.name_vi`,
    [id, slug, input.nameEn.trim(), input.nameVi?.trim() || input.nameEn.trim()]
  );

  await logAdminAudit({
    actor,
    module: 'content',
    action: input.id ? 'edit_tag' : 'create_tag',
    entityType: 'cms_tag',
    entityId: id,
    after: { slug },
  });

  return { id, slug };
}

export async function deleteCmsTag(actor: AdminActorContext, tagId: string) {
  if (!isValidUuid(tagId)) throw new AppError('VALIDATION_ERROR', 'Invalid tag ID.');
  await dbQuery(`DELETE FROM cms_tags WHERE id = $1`, [tagId]);
  await logAdminAudit({
    actor,
    module: 'content',
    action: 'delete_tag',
    entityType: 'cms_tag',
    entityId: tagId,
  });
  return { ok: true };
}

// ==========================================
// Shared Media Library
// ==========================================
export async function listCmsMedia(options?: {
  folder?: string;
  q?: string;
}): Promise<CmsMediaItem[]> {
  const conds: string[] = [];
  const params: unknown[] = [];

  if (options?.folder && options.folder !== 'all') {
    params.push(options.folder);
    conds.push(`m.folder = $${params.length}`);
  }
  if (options?.q?.trim()) {
    params.push(`%${options.q.trim().toLowerCase()}%`);
    conds.push(
      `(LOWER(m.filename) LIKE $${params.length} OR LOWER(m.alt_en) LIKE $${params.length} OR LOWER(m.alt_vi) LIKE $${params.length})`
    );
  }

  const where = conds.length > 0 ? `WHERE ${conds.join(' AND ')}` : '';
  const res = await dbQuery(
    `SELECT m.*,
            (SELECT COUNT(*) FROM cms_media_usages u WHERE u.media_id = m.id) AS usage_count
     FROM cms_media m
     ${where}
     ORDER BY m.created_at DESC
     LIMIT 200`,
    params
  );

  return res.rows.map((r) => ({
    id: String(r.id),
    storageMode: String(r.storage_mode) as CmsMediaItem['storageMode'],
    objectPath: String(r.object_path ?? ''),
    url: String(r.url),
    filename: String(r.filename),
    mimeType: String(r.mime_type ?? 'image/jpeg'),
    sizeBytes: toNum(r.size_bytes, 0),
    width: r.width !== null && r.width !== undefined ? toNum(r.width) : null,
    height: r.height !== null && r.height !== undefined ? toNum(r.height) : null,
    altEn: String(r.alt_en ?? ''),
    altVi: String(r.alt_vi ?? ''),
    captionEn: String(r.caption_en ?? ''),
    captionVi: String(r.caption_vi ?? ''),
    credit: String(r.credit ?? ''),
    license: String(r.license ?? ''),
    focalX: toNum(r.focal_x, 50),
    focalY: toNum(r.focal_y, 50),
    folder: String(r.folder ?? 'editorial'),
    usageCount: toNum(r.usage_count, 0),
    createdAt: new Date(String(r.created_at)).toISOString(),
  }));
}

export async function createCmsMediaRecord(
  actor: AdminActorContext,
  input: {
    storageMode: 'supabase' | 'local' | 'external';
    objectPath: string;
    url: string;
    filename: string;
    mimeType: string;
    sizeBytes: number;
    width?: number;
    height?: number;
    altEn?: string;
    altVi?: string;
    captionEn?: string;
    captionVi?: string;
    credit?: string;
    license?: string;
    folder?: string;
  }
): Promise<CmsMediaItem> {
  const id = crypto.randomUUID();
  await dbQuery(
    `INSERT INTO cms_media (
      id, storage_mode, object_path, url, filename, mime_type, size_bytes,
      width, height, alt_en, alt_vi, caption_en, caption_vi, credit, license,
      folder, uploaded_by
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
    [
      id,
      input.storageMode,
      input.objectPath,
      input.url,
      input.filename.slice(0, 240),
      input.mimeType,
      Math.max(0, Math.round(input.sizeBytes)),
      input.width ?? null,
      input.height ?? null,
      input.altEn?.trim() ?? '',
      input.altVi?.trim() ?? '',
      input.captionEn?.trim() ?? '',
      input.captionVi?.trim() ?? '',
      input.credit?.trim() ?? '',
      input.license?.trim() || 'VietNomad Editorial',
      input.folder?.trim() || 'editorial',
      actor.user.id,
    ]
  );

  await logAdminAudit({
    actor,
    module: 'content',
    action: 'upload_media',
    entityType: 'cms_media',
    entityId: id,
    after: { filename: input.filename, url: input.url },
  });

  const rows = await listCmsMedia();
  return rows.find((m) => m.id === id)!;
}

export async function updateCmsMediaMetadata(
  actor: AdminActorContext,
  mediaId: string,
  input: {
    altEn?: string;
    altVi?: string;
    captionEn?: string;
    captionVi?: string;
    credit?: string;
    license?: string;
    focalX?: number;
    focalY?: number;
    folder?: string;
  }
) {
  if (!isValidUuid(mediaId)) throw new AppError('VALIDATION_ERROR', 'Invalid media ID.');
  await dbQuery(
    `UPDATE cms_media
     SET alt_en = COALESCE($2, alt_en),
         alt_vi = COALESCE($3, alt_vi),
         caption_en = COALESCE($4, caption_en),
         caption_vi = COALESCE($5, caption_vi),
         credit = COALESCE($6, credit),
         license = COALESCE($7, license),
         focal_x = COALESCE($8, focal_x),
         focal_y = COALESCE($9, focal_y),
         folder = COALESCE($10, folder),
         updated_at = NOW()
     WHERE id = $1`,
    [
      mediaId,
      input.altEn ?? null,
      input.altVi ?? null,
      input.captionEn ?? null,
      input.captionVi ?? null,
      input.credit ?? null,
      input.license ?? null,
      typeof input.focalX === 'number' ? Math.min(100, Math.max(0, input.focalX)) : null,
      typeof input.focalY === 'number' ? Math.min(100, Math.max(0, input.focalY)) : null,
      input.folder ?? null,
    ]
  );

  await logAdminAudit({
    actor,
    module: 'content',
    action: 'edit_media',
    entityType: 'cms_media',
    entityId: mediaId,
  });

  return { ok: true };
}

export async function deleteCmsMediaRecord(
  actor: AdminActorContext,
  mediaId: string,
  force = false
) {
  if (!isValidUuid(mediaId)) throw new AppError('VALIDATION_ERROR', 'Invalid media ID.');
  const usageRes = await dbQuery<{ entity_type: string; entity_id: string }>(
    `SELECT entity_type, entity_id FROM cms_media_usages WHERE media_id = $1`,
    [mediaId]
  );
  if (usageRes.rows.length > 0 && !force) {
    throw new AppError(
      'CONFLICT',
      `This media asset is currently referenced in ${usageRes.rows.length} content placement(s). Confirm force removal if you still want to delete it.`,
      409
    );
  }

  const mediaRes = await dbQuery<{ object_path: string }>(
    `SELECT object_path FROM cms_media WHERE id = $1`,
    [mediaId]
  );
  const objectPath = mediaRes.rows[0]?.object_path ?? '';

  await dbQuery(`UPDATE cms_contents SET featured_media_id = NULL WHERE featured_media_id = $1`, [
    mediaId,
  ]);
  await dbQuery(`DELETE FROM cms_media WHERE id = $1`, [mediaId]);

  if (objectPath) {
    await deleteCmsUploadedMedia(objectPath);
  }

  await logAdminAudit({
    actor,
    module: 'content',
    action: 'delete_media',
    entityType: 'cms_media',
    entityId: mediaId,
  });

  return { ok: true };
}

// ==========================================
// URL Redirects Manager (301/302)
// ==========================================
export async function listCmsRedirects(): Promise<CmsRedirectItem[]> {
  const res = await dbQuery(
    `SELECT * FROM cms_redirects ORDER BY updated_at DESC, created_at DESC`
  );
  return res.rows.map((r) => ({
    id: String(r.id),
    sourcePath: String(r.source_path),
    targetPath: String(r.target_path),
    statusCode: Number(r.status_code) === 302 ? 302 : 301,
    isActive: Boolean(r.is_active),
    hitCount: toNum(r.hit_count, 0),
    note: String(r.note ?? ''),
    autoCreatedFromContentId: r.auto_created_from_content_id
      ? String(r.auto_created_from_content_id)
      : null,
    createdAt: new Date(String(r.created_at)).toISOString(),
  }));
}

export async function upsertCmsRedirect(
  actor: AdminActorContext,
  input: {
    id?: string;
    sourcePath: string;
    targetPath: string;
    statusCode?: 301 | 302;
    isActive?: boolean;
    note?: string;
    autoCreatedFromContentId?: string | null;
  }
) {
  const sourcePath = normalizeRedirectPath(input.sourcePath);
  const targetPath = normalizeRedirectPath(input.targetPath);
  if (sourcePath === targetPath) {
    throw new AppError('VALIDATION_ERROR', 'Redirect source and target paths cannot match.');
  }

  const id = input.id && isValidUuid(input.id) ? input.id : crypto.randomUUID();
  await dbQuery(
    `INSERT INTO cms_redirects (
      id, source_path, target_path, status_code, is_active, note, auto_created_from_content_id, created_by, updated_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
    ON CONFLICT (source_path) DO UPDATE SET
      target_path = EXCLUDED.target_path,
      status_code = EXCLUDED.status_code,
      is_active = EXCLUDED.is_active,
      note = EXCLUDED.note,
      updated_at = NOW()`,
    [
      id,
      sourcePath,
      targetPath,
      input.statusCode === 302 ? 302 : 301,
      input.isActive ?? true,
      input.note?.trim() ?? '',
      input.autoCreatedFromContentId && isValidUuid(input.autoCreatedFromContentId)
        ? input.autoCreatedFromContentId
        : null,
      actor.user.id,
    ]
  );

  await logAdminAudit({
    actor,
    module: 'content',
    action: 'upsert_redirect',
    entityType: 'cms_redirect',
    entityId: id,
    after: { sourcePath, targetPath, statusCode: input.statusCode ?? 301 },
  });

  safeRevalidateAll(['/sitemap.xml']);
  return { id, sourcePath, targetPath };
}

export async function deleteCmsRedirect(actor: AdminActorContext, redirectId: string) {
  if (!isValidUuid(redirectId)) throw new AppError('VALIDATION_ERROR', 'Invalid redirect ID.');
  await dbQuery(`DELETE FROM cms_redirects WHERE id = $1`, [redirectId]);
  await logAdminAudit({
    actor,
    module: 'content',
    action: 'delete_redirect',
    entityType: 'cms_redirect',
    entityId: redirectId,
  });
  return { ok: true };
}

export async function resolveCmsRedirect(
  path: string
): Promise<{ targetPath: string; statusCode: 301 | 302 } | null> {
  const clean = normalizeRedirectPath(path);
  try {
    const res = await dbQuery<{ id: string; target_path: string; status_code: number }>(
      `SELECT id, target_path, status_code
       FROM cms_redirects
       WHERE source_path = $1 AND is_active = TRUE
       LIMIT 1`,
      [clean]
    );
    const row = res.rows[0];
    if (!row) return null;
    await dbQuery(`UPDATE cms_redirects SET hit_count = hit_count + 1 WHERE id = $1`, [
      row.id,
    ]).catch(() => undefined);
    return {
      targetPath: String(row.target_path),
      statusCode: Number(row.status_code) === 302 ? 302 : 301,
    };
  } catch {
    return null;
  }
}

// ==========================================
// CMS Settings
// ==========================================
const DEFAULT_CMS_SETTINGS: CmsSettingsBundle = {
  seoDefaults: {
    siteName: 'VietNomad Stays',
    titleSeparator: '|',
    defaultRobotsIndex: true,
    defaultRobotsFollow: true,
    includeCategoriesInSitemap: false,
    gscPropertyUrl: '',
    gscConnected: false,
  },
  editorialWorkflow: {
    requireReviewBeforePublish: false,
    autosaveIntervalMs: 2500,
    autoCreateRedirectOnSlugChange: true,
  },
};

export async function getCmsSettings(): Promise<CmsSettingsBundle> {
  try {
    const res = await dbQuery<{ key: string; value_json: Record<string, unknown> }>(
      `SELECT key, value_json FROM cms_settings`
    );
    const map = new Map(res.rows.map((r) => [r.key, r.value_json]));
    return {
      seoDefaults: {
        ...DEFAULT_CMS_SETTINGS.seoDefaults,
        ...(map.get('seo_defaults') ?? {}),
      } as CmsSettingsBundle['seoDefaults'],
      editorialWorkflow: {
        ...DEFAULT_CMS_SETTINGS.editorialWorkflow,
        ...(map.get('editorial_workflow') ?? {}),
      } as CmsSettingsBundle['editorialWorkflow'],
    };
  } catch {
    return DEFAULT_CMS_SETTINGS;
  }
}

export async function updateCmsSettings(
  actor: AdminActorContext,
  input: Partial<CmsSettingsBundle>
): Promise<CmsSettingsBundle> {
  const current = await getCmsSettings();
  if (input.seoDefaults) {
    const nextSeo = { ...current.seoDefaults, ...input.seoDefaults };
    await dbQuery(
      `INSERT INTO cms_settings (key, value_json, updated_by, updated_at)
       VALUES ('seo_defaults', $1::jsonb, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value_json = EXCLUDED.value_json, updated_by = EXCLUDED.updated_by, updated_at = NOW()`,
      [JSON.stringify(nextSeo), actor.user.id]
    );
  }
  if (input.editorialWorkflow) {
    const nextWf = { ...current.editorialWorkflow, ...input.editorialWorkflow };
    await dbQuery(
      `INSERT INTO cms_settings (key, value_json, updated_by, updated_at)
       VALUES ('editorial_workflow', $1::jsonb, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value_json = EXCLUDED.value_json, updated_by = EXCLUDED.updated_by, updated_at = NOW()`,
      [JSON.stringify(nextWf), actor.user.id]
    );
  }
  await logAdminAudit({
    actor,
    module: 'content',
    action: 'update_cms_settings',
    entityType: 'cms_settings',
    entityId: 'global',
    after: input,
  });
  return getCmsSettings();
}

// ==========================================
// Live Entity Search for Editor Pickers & Internal Links
// ==========================================
export interface EntityPickerItem {
  id: string;
  slug: string;
  label: string;
  subtitle: string;
  path: string;
  status: string;
  kind: string;
}

export async function searchCmsEntityPicker(params: {
  type:
    | 'stay'
    | 'destination'
    | 'neighborhood'
    | 'place'
    | 'partner'
    | 'promotion'
    | 'guide'
    | 'category'
    | 'all';
  q?: string;
}): Promise<EntityPickerItem[]> {
  const qLike = `%${(params.q ?? '').trim().toLowerCase()}%`;

  if (params.type === 'stay') {
    const res = await dbQuery(
      `SELECT s.id, s.slug, s.title_en, s.status, d.name_en AS dest_name, s.wifi_download_mbps
       FROM stays s
       JOIN destinations d ON d.id = s.destination_id
       WHERE ($1 = '%%' OR LOWER(s.title_en) LIKE $1 OR LOWER(s.slug) LIKE $1 OR LOWER(d.name_en) LIKE $1)
       ORDER BY (s.status = 'live') DESC, s.is_featured DESC, s.created_at DESC
       LIMIT 25`,
      [qLike]
    );
    return res.rows.map((r) => ({
      id: String(r.id),
      slug: String(r.slug),
      label: String(r.title_en),
      subtitle: `${String(r.dest_name)} · ${toNum(r.wifi_download_mbps)} Mbps · /stays/${String(r.slug)}`,
      path: `/stays/${String(r.slug)}`,
      status: String(r.status),
      kind: 'stay',
    }));
  }

  if (params.type === 'destination') {
    const res = await dbQuery(
      `SELECT id, slug, name_en, avg_wifi_mbps, monthly_cost_usd
       FROM destinations
       WHERE ($1 = '%%' OR LOWER(name_en) LIKE $1 OR LOWER(slug) LIKE $1)
       ORDER BY name_en ASC LIMIT 20`,
      [qLike]
    );
    return res.rows.map((r) => ({
      id: String(r.id),
      slug: String(r.slug),
      label: String(r.name_en),
      subtitle: `~${toNum(r.avg_wifi_mbps)} Mbps · ~$${toNum(r.monthly_cost_usd)}/mo · /destinations/${String(r.slug)}`,
      path: `/destinations/${String(r.slug)}`,
      status: 'active',
      kind: 'destination',
    }));
  }

  if (params.type === 'neighborhood') {
    const res = await dbQuery(
      `SELECT n.id, n.slug, n.name_en, d.name_en AS dest_name, d.slug AS dest_slug
       FROM neighborhoods n
       JOIN destinations d ON d.id = n.destination_id
       WHERE ($1 = '%%' OR LOWER(n.name_en) LIKE $1 OR LOWER(d.name_en) LIKE $1)
       ORDER BY d.name_en, n.name_en LIMIT 25`,
      [qLike]
    );
    return res.rows.map((r) => ({
      id: String(r.id),
      slug: String(r.slug),
      label: String(r.name_en),
      subtitle: `${String(r.dest_name)} · /destinations/${String(r.dest_slug)}`,
      path: `/destinations/${String(r.dest_slug)}`,
      status: 'active',
      kind: 'neighborhood',
    }));
  }

  if (params.type === 'place') {
    const res = await dbQuery(
      `SELECT p.id, p.slug, p.name, p.category, p.verification_status, d.name_en AS dest_name, d.slug AS dest_slug
       FROM places p
       JOIN destinations d ON d.id = p.destination_id
       WHERE ($1 = '%%' OR LOWER(p.name) LIKE $1 OR LOWER(p.category) LIKE $1 OR LOWER(d.name_en) LIKE $1)
       ORDER BY (p.verification_status = 'verified') DESC, p.is_featured DESC LIMIT 25`,
      [qLike]
    );
    return res.rows.map((r) => ({
      id: String(r.id),
      slug: String(r.slug),
      label: String(r.name),
      subtitle: `${String(r.category)} · ${String(r.dest_name)}`,
      path: `/destinations/${String(r.dest_slug)}`,
      status: String(r.verification_status),
      kind: 'place',
    }));
  }

  if (params.type === 'partner') {
    const res = await dbQuery(
      `SELECT lp.id, lp.business_name, lp.category, lp.perk_offer, lp.partnership_status, d.slug AS dest_slug
       FROM local_partners lp
       LEFT JOIN destinations d ON d.id = lp.destination_id
       WHERE ($1 = '%%' OR LOWER(lp.business_name) LIKE $1 OR LOWER(lp.perk_offer) LIKE $1)
       ORDER BY (lp.partnership_status = 'active') DESC LIMIT 25`,
      [qLike]
    );
    return res.rows.map((r) => ({
      id: String(r.id),
      slug: String(r.id),
      label: String(r.business_name),
      subtitle: `${String(r.category)} · ${String(r.perk_offer || 'Partner offer')}`,
      path: r.dest_slug ? `/destinations/${String(r.dest_slug)}` : '/deals',
      status: String(r.partnership_status),
      kind: 'partner',
    }));
  }

  if (params.type === 'promotion') {
    const res = await dbQuery(
      `SELECT id, code, name, discount_type, discount_value, is_active, valid_to
       FROM promotions
       WHERE ($1 = '%%' OR LOWER(code) LIKE $1 OR LOWER(name) LIKE $1)
       ORDER BY is_active DESC, valid_to DESC LIMIT 20`,
      [qLike]
    );
    return res.rows.map((r) => ({
      id: String(r.id),
      slug: String(r.code),
      label: `${String(r.code)} — ${String(r.name)}`,
      subtitle: `Valid until ${String(r.valid_to).slice(0, 10)}`,
      path: '/deals',
      status: r.is_active ? 'active' : 'inactive',
      kind: 'promotion',
    }));
  }

  if (params.type === 'category') {
    const res = await dbQuery(
      `SELECT id, slug, name_en, name_vi FROM cms_categories
       WHERE ($1 = '%%' OR LOWER(name_en) LIKE $1 OR LOWER(slug) LIKE $1)
       ORDER BY sort_order ASC`,
      [qLike]
    );
    return res.rows.map((r) => ({
      id: String(r.id),
      slug: String(r.slug),
      label: String(r.name_en),
      subtitle: `/guides?category=${String(r.slug)}`,
      path: `/guides?category=${String(r.slug)}`,
      status: 'active',
      kind: 'category',
    }));
  }

  if (params.type === 'guide') {
    const res = await dbQuery(
      `SELECT id, slug, title_en, content_type, status, locale
       FROM cms_contents
       WHERE content_type NOT IN ('announcement', 'hero_banner')
         AND ($1 = '%%' OR LOWER(title_en) LIKE $1 OR LOWER(slug) LIKE $1)
       ORDER BY (status = 'published') DESC, updated_at DESC LIMIT 30`,
      [qLike]
    );
    return res.rows.map((r) => ({
      id: String(r.id),
      slug: String(r.slug),
      label: String(r.title_en),
      subtitle: `[${String(r.locale).toUpperCase()}] /guides/${String(r.slug)}`,
      path: `/guides/${String(r.slug)}`,
      status: String(r.status),
      kind: 'guide',
    }));
  }

  // 'all' — combined internal link picker (Stays, Destinations, Guides, Categories)
  const [stays, dests, guides, cats] = await Promise.all([
    searchCmsEntityPicker({ type: 'stay', q: params.q }),
    searchCmsEntityPicker({ type: 'destination', q: params.q }),
    searchCmsEntityPicker({ type: 'guide', q: params.q }),
    searchCmsEntityPicker({ type: 'category', q: params.q }),
  ]);
  return [
    ...guides.slice(0, 8),
    ...stays.slice(0, 8),
    ...dests.slice(0, 6),
    ...cats.slice(0, 4),
  ];
}
