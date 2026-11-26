import { NextRequest } from 'next/server';
import { z } from 'zod';
import { AppError } from '@/lib/errors';
import { errJson, okJson } from '@/lib/http';
import { requireAdminPermission } from '@/modules/admin-rbac';
import {
  createAdminPlace,
  createMarketingCampaign,
  createNeighborhood,
  createOrUpdateCmsContent,
  createPromotion,
  deleteAdminPlace,
  listAdminDestinations,
  listAdminPlaces,
  listCampaignsAndFunnel,
  listCmsContents,
  listPromotions,
  togglePromotion,
  updateAdminPlace,
  updateDestinationMeta,
} from '@/modules/admin-bos';

export async function GET(req: NextRequest) {
  try {
    const scope = req.nextUrl.searchParams.get('scope') ?? 'places';

    if (scope === 'destinations') {
      await requireAdminPermission('destinations', 'view');
      return okJson(await listAdminDestinations());
    }
    if (scope === 'content') {
      await requireAdminPermission('content', 'view');
      return okJson({ contents: await listCmsContents() });
    }
    if (scope === 'campaigns') {
      await requireAdminPermission('campaigns', 'view');
      return okJson(await listCampaignsAndFunnel());
    }
    if (scope === 'promotions') {
      await requireAdminPermission('promotions', 'view');
      return okJson({ promotions: await listPromotions() });
    }

    await requireAdminPermission('discovery', 'view');
    return okJson(
      await listAdminPlaces({
        destinationId: req.nextUrl.searchParams.get('destinationId') ?? undefined,
        category: req.nextUrl.searchParams.get('category') ?? undefined,
        q: req.nextUrl.searchParams.get('q') ?? undefined,
      })
    );
  } catch (err) {
    return errJson(err);
  }
}

const postSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('neighborhood'),
    destinationId: z.string().uuid(),
    slug: z.string().min(2).max(80),
    nameEn: z.string().min(2).max(120),
    nameVi: z.string().min(2).max(120),
    summaryEn: z.string().max(400).optional(),
    summaryVi: z.string().max(400).optional(),
  }),
  z.object({
    kind: z.literal('place'),
    destinationId: z.string().uuid(),
    neighborhoodId: z.string().nullable().optional(),
    partnerId: z.string().nullable().optional(),
    category: z.enum([
      'restaurant',
      'cafe',
      'coworking',
      'gym_yoga',
      'entertainment',
      'attraction',
      'transport',
      'essential',
      'event_venue',
    ]),
    name: z.string().min(2).max(160),
    address: z.string().min(2).max(300),
    descriptionEn: z.string().min(3).max(1000),
    descriptionVi: z.string().max(1000).optional(),
    priceRange: z.string().max(12).optional(),
    openingHours: z.string().max(80).optional(),
    isFeatured: z.boolean().optional(),
  }),
  z.object({
    kind: z.literal('content'),
    id: z.string().uuid().optional(),
    contentType: z.enum(['article', 'landing_page', 'destination_guide']),
    category: z.string().min(2).max(80),
    slug: z.string().min(2).max(140),
    titleEn: z.string().min(2).max(200),
    titleVi: z.string().min(2).max(200),
    bodyEn: z.string().min(5),
    bodyVi: z.string().optional(),
    destinationId: z.string().nullable().optional(),
    seoTitle: z.string().max(160).optional(),
    seoDescription: z.string().max(320).optional(),
    canonicalUrl: z.string().max(300).optional(),
    redirectTo: z.string().max(300).optional(),
    robotsIndex: z.boolean().optional(),
    status: z.enum(['draft', 'published', 'archived']),
  }),
  z.object({
    kind: z.literal('campaign'),
    name: z.string().min(2).max(160),
    channel: z.string().min(2).max(80),
    utmSource: z.string().min(1).max(80),
    utmMedium: z.string().min(1).max(80),
    utmCampaign: z.string().min(2).max(100),
    budgetVnd: z.number().min(0),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
  z.object({
    kind: z.literal('promotion'),
    code: z.string().min(3).max(40),
    name: z.string().min(2).max(140),
    discountType: z.enum(['percent', 'fixed_vnd']),
    discountValue: z.number().int().min(1),
    minNights: z.number().int().min(1).optional(),
    maxUses: z.number().int().min(1).nullable().optional(),
    validFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    validTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
]);

export async function POST(req: NextRequest) {
  try {
    const parsed = postSchema.safeParse(await req.json());
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', 'Invalid growth entity payload.');

    const d = parsed.data;
    if (d.kind === 'neighborhood') {
      const actor = await requireAdminPermission('destinations', 'create');
      return okJson(await createNeighborhood(actor, d), 201);
    }
    if (d.kind === 'place') {
      const actor = await requireAdminPermission('discovery', 'create');
      return okJson(await createAdminPlace(actor, d), 201);
    }
    if (d.kind === 'content') {
      const actor = await requireAdminPermission('content', 'create');
      return okJson(await createOrUpdateCmsContent(actor, d), 201);
    }
    if (d.kind === 'campaign') {
      const actor = await requireAdminPermission('campaigns', 'create');
      return okJson(await createMarketingCampaign(actor, d), 201);
    }
    const actor = await requireAdminPermission('promotions', 'create');
    return okJson(await createPromotion(actor, d), 201);
  } catch (err) {
    return errJson(err);
  }
}

const patchSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('destination'),
    destinationId: z.string().uuid(),
    taglineEn: z.string().max(400).optional(),
    taglineVi: z.string().max(400).optional(),
    avgWifiMbps: z.number().int().min(10).max(1000).optional(),
    monthlyCostUsd: z.number().int().min(200).max(5000).optional(),
    visaSummaryEn: z.string().max(240).optional(),
    climateEn: z.string().max(400).optional(),
  }),
  z.object({
    kind: z.literal('place'),
    placeId: z.string().uuid(),
    verificationStatus: z.enum(['unverified', 'verified', 'outdated']).optional(),
    isFeatured: z.boolean().optional(),
    openingHours: z.string().max(80).optional(),
    priceRange: z.string().max(12).optional(),
  }),
  z.object({
    kind: z.literal('promotion'),
    promoId: z.string().uuid(),
    isActive: z.boolean(),
  }),
]);

export async function PATCH(req: NextRequest) {
  try {
    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', 'Invalid growth update payload.');
    const d = parsed.data;

    if (d.kind === 'destination') {
      const actor = await requireAdminPermission('destinations', 'edit');
      return okJson(await updateDestinationMeta(actor, d.destinationId, d));
    }
    if (d.kind === 'place') {
      const actor = await requireAdminPermission('discovery', 'edit');
      return okJson(await updateAdminPlace(actor, d.placeId, d));
    }
    const actor = await requireAdminPermission('promotions', 'edit');
    return okJson(await togglePromotion(actor, d.promoId, d.isActive));
  } catch (err) {
    return errJson(err);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const actor = await requireAdminPermission('discovery', 'delete');
    const body = (await req.json()) as { placeId?: string };
    if (!body.placeId) throw new AppError('VALIDATION_ERROR', 'placeId is required.');
    return okJson(await deleteAdminPlace(actor, body.placeId));
  } catch (err) {
    return errJson(err);
  }
}
