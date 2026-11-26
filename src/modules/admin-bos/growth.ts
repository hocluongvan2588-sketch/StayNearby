import crypto from 'node:crypto';
import { isValidUuid } from '@/lib/dates';
import { dbQuery, toNum } from '@/lib/db';
import { AppError } from '@/lib/errors';
import { safeRevalidateAll } from '@/lib/revalidate-safe';
import { logAdminAudit, type AdminActorContext } from '@/modules/admin-rbac';

export async function listAdminDestinations() {
  const [destsRes, nbsRes] = await Promise.all([
    dbQuery<{
      id: string;
      slug: string;
      name_en: string;
      name_vi: string;
      tagline_en: string;
      tagline_vi: string;
      avg_wifi_mbps: number;
      monthly_cost_usd: number;
      stays_count: string | number;
      places_count: string | number;
    }>(
      `SELECT d.*,
              (SELECT COUNT(*) FROM stays s WHERE s.destination_id = d.id AND s.status IN ('live','limited')) AS stays_count,
              (SELECT COUNT(*) FROM places p WHERE p.destination_id = d.id) AS places_count
       FROM destinations d
       ORDER BY d.name_en ASC`
    ),
    dbQuery<{
      id: string;
      destination_id: string;
      slug: string;
      name_en: string;
      name_vi: string;
      summary_en: string;
    }>(`SELECT * FROM neighborhoods ORDER BY name_en ASC`),
  ]);

  return {
    destinations: destsRes.rows.map((d) => ({
      id: String(d.id),
      slug: String(d.slug),
      nameEn: String(d.name_en),
      nameVi: String(d.name_vi),
      taglineEn: String(d.tagline_en),
      taglineVi: String(d.tagline_vi),
      avgWifiMbps: toNum(d.avg_wifi_mbps),
      monthlyCostUsd: toNum(d.monthly_cost_usd),
      staysCount: toNum(d.stays_count),
      placesCount: toNum(d.places_count),
    })),
    neighborhoods: nbsRes.rows.map((n) => ({
      id: String(n.id),
      destinationId: String(n.destination_id),
      slug: String(n.slug),
      nameEn: String(n.name_en),
      nameVi: String(n.name_vi),
      summaryEn: String(n.summary_en),
    })),
  };
}

export async function updateDestinationMeta(
  actor: AdminActorContext,
  destinationId: string,
  input: {
    taglineEn?: string;
    taglineVi?: string;
    avgWifiMbps?: number;
    monthlyCostUsd?: number;
    visaSummaryEn?: string;
    climateEn?: string;
  }
) {
  if (!isValidUuid(destinationId)) throw new AppError('VALIDATION_ERROR', 'Invalid destination ID.');

  await dbQuery(
    `UPDATE destinations
     SET tagline_en = COALESCE($1, tagline_en),
         tagline_vi = COALESCE($2, tagline_vi),
         avg_wifi_mbps = COALESCE($3, avg_wifi_mbps),
         monthly_cost_usd = COALESCE($4, monthly_cost_usd),
         visa_summary_en = COALESCE($5, visa_summary_en),
         climate_en = COALESCE($6, climate_en)
     WHERE id = $7`,
    [
      input.taglineEn ?? null,
      input.taglineVi ?? null,
      input.avgWifiMbps ?? null,
      input.monthlyCostUsd ?? null,
      input.visaSummaryEn ?? null,
      input.climateEn ?? null,
      destinationId,
    ]
  );

  await logAdminAudit({
    actor,
    module: 'destinations',
    action: 'edit',
    entityType: 'destination',
    entityId: destinationId,
    after: input,
  });

  return { ok: true };
}

export async function createNeighborhood(
  actor: AdminActorContext,
  input: {
    destinationId: string;
    slug: string;
    nameEn: string;
    nameVi: string;
    summaryEn?: string;
    summaryVi?: string;
  }
) {
  if (!isValidUuid(input.destinationId)) {
    throw new AppError('VALIDATION_ERROR', 'Invalid destination ID.');
  }
  const id = crypto.randomUUID();
  const slug = input.slug
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/(^-|-$)/g, '');

  await dbQuery(
    `INSERT INTO neighborhoods (id, destination_id, slug, name_en, name_vi, summary_en, summary_vi)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [
      id,
      input.destinationId,
      slug,
      input.nameEn.trim(),
      input.nameVi.trim(),
      input.summaryEn?.trim() ?? '',
      input.summaryVi?.trim() ?? '',
    ]
  );

  await logAdminAudit({
    actor,
    module: 'destinations',
    action: 'create',
    entityType: 'neighborhood',
    entityId: id,
    after: input,
  });

  safeRevalidateAll(['/destinations']);
  return { id };
}

export async function listAdminPlaces(filters?: { destinationId?: string; category?: string; q?: string }) {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters?.destinationId && filters.destinationId !== 'all') {
    params.push(filters.destinationId);
    conditions.push(`p.destination_id = $${params.length}`);
  }
  if (filters?.category && filters.category !== 'all') {
    params.push(filters.category);
    conditions.push(`p.category = $${params.length}`);
  }
  if (filters?.q?.trim()) {
    params.push(`%${filters.q.trim()}%`);
    conditions.push(`(p.name ILIKE $${params.length} OR p.address ILIKE $${params.length})`);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const [placesRes, destsRes, nbsRes, partnersRes] = await Promise.all([
    dbQuery<{
      id: string;
      destination_id: string;
      destination_name: string;
      neighborhood_id: string | null;
      neighborhood_name: string | null;
      partner_id: string | null;
      partner_name: string | null;
      category: string;
      slug: string;
      name: string;
      address: string;
      description_en: string;
      description_vi: string;
      price_range: string;
      opening_hours: string;
      verification_status: string;
      is_featured: boolean;
    }>(
      `SELECT p.*, d.name_en AS destination_name, n.name_en AS neighborhood_name, lp.business_name AS partner_name
       FROM places p
       JOIN destinations d ON d.id = p.destination_id
       LEFT JOIN neighborhoods n ON n.id = p.neighborhood_id
       LEFT JOIN local_partners lp ON lp.id = p.partner_id
       ${where}
       ORDER BY p.is_featured DESC, p.created_at DESC`,
      params
    ),
    dbQuery<{ id: string; slug: string; name_en: string }>(
      `SELECT id, slug, name_en FROM destinations ORDER BY name_en ASC`
    ),
    dbQuery<{ id: string; destination_id: string; name_en: string }>(
      `SELECT id, destination_id, name_en FROM neighborhoods ORDER BY name_en ASC`
    ),
    dbQuery<{ id: string; business_name: string }>(
      `SELECT id, business_name FROM local_partners ORDER BY business_name ASC`
    ),
  ]);

  return {
    places: placesRes.rows.map((p) => ({
      id: String(p.id),
      destinationId: String(p.destination_id),
      destinationName: String(p.destination_name),
      neighborhoodId: p.neighborhood_id ? String(p.neighborhood_id) : null,
      neighborhoodName: p.neighborhood_name ? String(p.neighborhood_name) : null,
      partnerId: p.partner_id ? String(p.partner_id) : null,
      partnerName: p.partner_name ? String(p.partner_name) : null,
      category: String(p.category),
      slug: String(p.slug),
      name: String(p.name),
      address: String(p.address),
      descriptionEn: String(p.description_en),
      descriptionVi: String(p.description_vi),
      priceRange: String(p.price_range),
      openingHours: String(p.opening_hours),
      verificationStatus: String(p.verification_status),
      isFeatured: Boolean(p.is_featured),
    })),
    destinations: destsRes.rows.map((d) => ({ id: String(d.id), slug: String(d.slug), nameEn: String(d.name_en) })),
    neighborhoods: nbsRes.rows.map((n) => ({ id: String(n.id), destinationId: String(n.destination_id), nameEn: String(n.name_en) })),
    partners: partnersRes.rows.map((lp) => ({ id: String(lp.id), businessName: String(lp.business_name) })),
  };
}

export async function createAdminPlace(
  actor: AdminActorContext,
  input: {
    destinationId: string;
    neighborhoodId?: string | null;
    partnerId?: string | null;
    category: string;
    name: string;
    address: string;
    descriptionEn: string;
    descriptionVi?: string;
    priceRange?: string;
    openingHours?: string;
    isFeatured?: boolean;
  }
) {
  if (!isValidUuid(input.destinationId)) {
    throw new AppError('VALIDATION_ERROR', 'Valid destination is required.');
  }
  const id = crypto.randomUUID();
  const slugBase = input.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  const slug = `${slugBase}-${id.slice(0, 6)}`;

  await dbQuery(
    `INSERT INTO places (
      id, destination_id, neighborhood_id, partner_id, category, slug, name, address,
      description_en, description_vi, price_range, opening_hours, verification_status, is_featured
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'verified',$13)`,
    [
      id,
      input.destinationId,
      input.neighborhoodId && isValidUuid(input.neighborhoodId) ? input.neighborhoodId : null,
      input.partnerId && isValidUuid(input.partnerId) ? input.partnerId : null,
      input.category,
      slug,
      input.name.trim(),
      input.address.trim(),
      input.descriptionEn.trim(),
      input.descriptionVi?.trim() ?? '',
      input.priceRange ?? '$$',
      input.openingHours ?? '08:00 - 22:00',
      Boolean(input.isFeatured),
    ]
  );

  await logAdminAudit({
    actor,
    module: 'discovery',
    action: 'create',
    entityType: 'place',
    entityId: id,
    after: { name: input.name, category: input.category },
  });

  safeRevalidateAll(['/destinations']);
  return { id, slug };
}

export async function updateAdminPlace(
  actor: AdminActorContext,
  placeId: string,
  input: {
    verificationStatus?: 'unverified' | 'verified' | 'outdated';
    isFeatured?: boolean;
    openingHours?: string;
    priceRange?: string;
  }
) {
  if (!isValidUuid(placeId)) throw new AppError('VALIDATION_ERROR', 'Invalid place ID.');

  await dbQuery(
    `UPDATE places
     SET verification_status = COALESCE($1, verification_status),
         is_featured = COALESCE($2, is_featured),
         opening_hours = COALESCE($3, opening_hours),
         price_range = COALESCE($4, price_range),
         last_verified_at = CASE WHEN $1 = 'verified' THEN NOW() ELSE last_verified_at END,
         updated_at = NOW()
     WHERE id = $5`,
    [
      input.verificationStatus ?? null,
      input.isFeatured ?? null,
      input.openingHours ?? null,
      input.priceRange ?? null,
      placeId,
    ]
  );

  await logAdminAudit({
    actor,
    module: 'discovery',
    action: 'edit',
    entityType: 'place',
    entityId: placeId,
    after: input,
  });

  safeRevalidateAll(['/destinations']);
  return { ok: true };
}

export async function deleteAdminPlace(actor: AdminActorContext, placeId: string) {
  if (!isValidUuid(placeId)) throw new AppError('VALIDATION_ERROR', 'Invalid place ID.');
  await dbQuery('DELETE FROM places WHERE id = $1', [placeId]);
  await logAdminAudit({
    actor,
    module: 'discovery',
    action: 'delete',
    entityType: 'place',
    entityId: placeId,
  });
  safeRevalidateAll(['/destinations']);
  return { ok: true };
}

export async function listCmsContents() {
  const res = await dbQuery<{
    id: string;
    content_type: string;
    category: string;
    slug: string;
    title_en: string;
    title_vi: string;
    body_en: string;
    destination_id: string | null;
    destination_name: string | null;
    seo_title: string;
    seo_description: string;
    canonical_url: string;
    redirect_to: string;
    robots_index: boolean;
    status: string;
    published_at: string | null;
    updated_at: string;
  }>(
    `SELECT cc.*, d.name_en AS destination_name
     FROM cms_contents cc
     LEFT JOIN destinations d ON d.id = cc.destination_id
     ORDER BY cc.updated_at DESC`
  );

  return res.rows.map((c) => ({
    id: String(c.id),
    contentType: String(c.content_type),
    category: String(c.category),
    slug: String(c.slug),
    titleEn: String(c.title_en),
    titleVi: String(c.title_vi),
    bodyEn: String(c.body_en),
    destinationId: c.destination_id ? String(c.destination_id) : null,
    destinationName: c.destination_name ? String(c.destination_name) : null,
    seoTitle: String(c.seo_title),
    seoDescription: String(c.seo_description),
    canonicalUrl: String(c.canonical_url),
    redirectTo: String(c.redirect_to),
    robotsIndex: Boolean(c.robots_index),
    status: String(c.status),
    publishedAt: c.published_at ? new Date(String(c.published_at)).toISOString() : null,
    updatedAt: new Date(String(c.updated_at)).toISOString(),
  }));
}

export async function createOrUpdateCmsContent(
  actor: AdminActorContext,
  input: {
    id?: string;
    contentType:
      | 'article'
      | 'landing_page'
      | 'destination_guide'
      | 'faq'
      | 'announcement'
      | 'hero_banner'
      | 'community_story';
    category: string;
    slug: string;
    titleEn: string;
    titleVi: string;
    bodyEn: string;
    bodyVi?: string;
    destinationId?: string | null;
    seoTitle?: string;
    seoDescription?: string;
    canonicalUrl?: string;
    redirectTo?: string;
    robotsIndex?: boolean;
    publishStartAt?: string | null;
    publishEndAt?: string | null;
    status: 'draft' | 'published' | 'archived';
  }
) {
  const id = input.id && isValidUuid(input.id) ? input.id : crypto.randomUUID();
  const slug = input.slug
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/(^-|-$)/g, '');

  await dbQuery(
    `INSERT INTO cms_contents (
      id, content_type, category, slug, title_en, title_vi, body_en, body_vi,
      destination_id, seo_title, seo_description, canonical_url, redirect_to,
      robots_index, status, author_id, published_at, publish_start_at, publish_end_at, updated_at
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,
      CASE WHEN $15 = 'published' THEN NOW() ELSE NULL END,
      $17::timestamptz, $18::timestamptz, NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      content_type = EXCLUDED.content_type,
      category = EXCLUDED.category,
      slug = EXCLUDED.slug,
      title_en = EXCLUDED.title_en,
      title_vi = EXCLUDED.title_vi,
      body_en = EXCLUDED.body_en,
      body_vi = EXCLUDED.body_vi,
      destination_id = EXCLUDED.destination_id,
      seo_title = EXCLUDED.seo_title,
      seo_description = EXCLUDED.seo_description,
      canonical_url = EXCLUDED.canonical_url,
      redirect_to = EXCLUDED.redirect_to,
      robots_index = EXCLUDED.robots_index,
      status = EXCLUDED.status,
      published_at = COALESCE(cms_contents.published_at, EXCLUDED.published_at),
      publish_start_at = EXCLUDED.publish_start_at,
      publish_end_at = EXCLUDED.publish_end_at,
      updated_at = NOW()`,
    [
      id,
      input.contentType,
      input.category.trim(),
      slug,
      input.titleEn.trim(),
      input.titleVi.trim(),
      input.bodyEn.trim(),
      input.bodyVi?.trim() ?? '',
      input.destinationId && isValidUuid(input.destinationId) ? input.destinationId : null,
      input.seoTitle?.trim() ?? '',
      input.seoDescription?.trim() ?? '',
      input.canonicalUrl?.trim() ?? '',
      input.redirectTo?.trim() ?? '',
      input.robotsIndex ?? true,
      input.status,
      actor.user.id,
      input.publishStartAt?.trim() || null,
      input.publishEndAt?.trim() || null,
    ]
  );

  await logAdminAudit({
    actor,
    module: 'content',
    action: input.id ? 'edit' : 'create',
    entityType: 'cms_content',
    entityId: id,
    after: { slug, status: input.status },
  });

  safeRevalidateAll(['/', '/community', '/destinations', `/guides/${slug}`, '/sitemap.xml']);
  return { id, slug };
}

export async function listCampaignsAndFunnel() {
  const [campaignsRes, funnelSummaryRes] = await Promise.all([
    dbQuery<{
      id: string;
      name: string;
      channel: string;
      utm_source: string;
      utm_medium: string;
      utm_campaign: string;
      budget_vnd: string | number;
      start_date: string;
      end_date: string | null;
      status: string;
      events_count: string | number;
      bookings_count: string | number;
      revenue_vnd: string | number;
    }>(
      `SELECT mc.*,
              COUNT(ae.id) AS events_count,
              COUNT(DISTINCT ae.booking_id) FILTER (WHERE ae.event_name = 'booking_completed') AS bookings_count,
              COALESCE(SUM(b.service_fee_vnd) FILTER (WHERE b.payment_status = 'paid'), 0) AS revenue_vnd
       FROM marketing_campaigns mc
       LEFT JOIN attribution_events ae
         ON ae.utm_campaign = mc.utm_campaign
        AND COALESCE(ae.is_internal, FALSE) = FALSE
       LEFT JOIN bookings b ON b.id = ae.booking_id
       GROUP BY mc.id
       ORDER BY mc.created_at DESC`
    ),
    dbQuery<{
      page_views: string | number;
      searches: string | number;
      stay_views: string | number;
      checkout_starts: string | number;
      booking_completed: string | number;
    }>(
      `SELECT
        COUNT(*) FILTER (WHERE event_name = 'page_view') AS page_views,
        COUNT(*) FILTER (WHERE event_name = 'search') AS searches,
        COUNT(*) FILTER (WHERE event_name = 'stay_view') AS stay_views,
        COUNT(*) FILTER (WHERE event_name = 'checkout_start') AS checkout_starts,
        COUNT(*) FILTER (WHERE event_name = 'booking_completed') AS booking_completed
       FROM attribution_events
       WHERE COALESCE(is_internal, FALSE) = FALSE`
    ),
  ]);

  const f = funnelSummaryRes.rows[0];

  return {
    campaigns: campaignsRes.rows.map((c) => ({
      id: String(c.id),
      name: String(c.name),
      channel: String(c.channel),
      utmSource: String(c.utm_source),
      utmMedium: String(c.utm_medium),
      utmCampaign: String(c.utm_campaign),
      budgetVnd: toNum(c.budget_vnd),
      startDate: String(c.start_date).slice(0, 10),
      endDate: c.end_date ? String(c.end_date).slice(0, 10) : null,
      status: String(c.status),
      eventsCount: toNum(c.events_count),
      bookingsCount: toNum(c.bookings_count),
      revenueVnd: toNum(c.revenue_vnd),
    })),
    funnel: {
      pageViews: toNum(f?.page_views),
      searches: toNum(f?.searches),
      stayViews: toNum(f?.stay_views),
      checkoutStarts: toNum(f?.checkout_starts),
      bookingCompleted: toNum(f?.booking_completed),
    },
  };
}

export async function createMarketingCampaign(
  actor: AdminActorContext,
  input: {
    name: string;
    channel: string;
    utmSource: string;
    utmMedium: string;
    utmCampaign: string;
    budgetVnd: number;
    startDate: string;
  }
) {
  const id = crypto.randomUUID();
  await dbQuery(
    `INSERT INTO marketing_campaigns (
      id, name, channel, utm_source, utm_medium, utm_campaign, budget_vnd, start_date, status
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::date,'active')`,
    [
      id,
      input.name.trim(),
      input.channel.trim(),
      input.utmSource.trim(),
      input.utmMedium.trim(),
      input.utmCampaign.trim(),
      Math.max(0, Math.round(input.budgetVnd)),
      input.startDate,
    ]
  );

  await logAdminAudit({
    actor,
    module: 'campaigns',
    action: 'create',
    entityType: 'marketing_campaign',
    entityId: id,
    after: input,
  });

  return { id };
}

export async function listPromotions() {
  const res = await dbQuery<{
    id: string;
    code: string;
    name: string;
    discount_type: string;
    discount_value: number;
    min_nights: number;
    max_uses: number | null;
    used_count: number;
    valid_from: string;
    valid_to: string;
    is_active: boolean;
    is_public: boolean;
    funding_source: string | null;
    description_en: string | null;
    description_vi: string | null;
  }>(`SELECT * FROM promotions ORDER BY created_at DESC`);

  return res.rows.map((p) => ({
    id: String(p.id),
    code: String(p.code),
    name: String(p.name),
    discountType: String(p.discount_type),
    discountValue: toNum(p.discount_value),
    minNights: toNum(p.min_nights, 7),
    maxUses: p.max_uses ? toNum(p.max_uses) : null,
    usedCount: toNum(p.used_count),
    validFrom: String(p.valid_from).slice(0, 10),
    validTo: String(p.valid_to).slice(0, 10),
    isActive: Boolean(p.is_active),
    isPublic: p.is_public === undefined ? true : Boolean(p.is_public),
    fundingSource:
      p.funding_source === 'host' || p.funding_source === 'shared'
        ? p.funding_source
        : 'vietnomad',
    descriptionEn: String(p.description_en ?? ''),
    descriptionVi: String(p.description_vi ?? ''),
  }));
}

export async function createPromotion(
  actor: AdminActorContext,
  input: {
    code: string;
    name: string;
    discountType: 'percent' | 'fixed_vnd';
    discountValue: number;
    minNights?: number;
    maxUses?: number | null;
    validFrom: string;
    validTo: string;
    isPublic?: boolean;
    fundingSource?: 'vietnomad' | 'host' | 'shared';
    descriptionEn?: string;
    descriptionVi?: string;
  }
) {
  const id = crypto.randomUUID();
  const code = input.code.trim().toUpperCase();
  const isPublic = input.isPublic ?? true;
  const fundingSource = input.fundingSource ?? 'vietnomad';

  await dbQuery(
    `INSERT INTO promotions (
      id, code, name, discount_type, discount_value, min_nights, max_uses,
      valid_from, valid_to, is_active, is_public, funding_source, description_en, description_vi
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::date,$9::date,TRUE,$10,$11,$12,$13)`,
    [
      id,
      code,
      input.name.trim(),
      input.discountType,
      Math.max(1, Math.round(input.discountValue)),
      Math.max(1, input.minNights ?? 7),
      input.maxUses ?? null,
      input.validFrom,
      input.validTo,
      isPublic,
      fundingSource,
      input.descriptionEn?.trim() ?? '',
      input.descriptionVi?.trim() ?? '',
    ]
  );

  await logAdminAudit({
    actor,
    module: 'promotions',
    action: 'create',
    entityType: 'promotion',
    entityId: id,
    after: { ...input, code, isPublic, fundingSource },
  });

  safeRevalidateAll(['/deals', '/stays']);
  return { id, code };
}

export async function togglePromotion(
  actor: AdminActorContext,
  promoId: string,
  isActive: boolean
) {
  if (!isValidUuid(promoId)) throw new AppError('VALIDATION_ERROR', 'Invalid promotion ID.');
  await dbQuery('UPDATE promotions SET is_active = $1 WHERE id = $2', [isActive, promoId]);
  await logAdminAudit({
    actor,
    module: 'promotions',
    action: 'edit',
    entityType: 'promotion',
    entityId: promoId,
    after: { isActive },
  });
  safeRevalidateAll(['/deals', '/stays']);
  return { ok: true };
}
