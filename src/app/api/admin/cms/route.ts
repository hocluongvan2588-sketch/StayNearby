import { NextRequest } from 'next/server';
import { z } from 'zod';
import { AppError } from '@/lib/errors';
import { errJson, okJson } from '@/lib/http';
import { requireAdminPermission } from '@/modules/admin-rbac';
import {
  getCmsOverviewAndSeoAudit,
  listAdminCmsContents,
  saveCmsContentPro,
} from '@/modules/cms-vietnomad';

export async function GET(req: NextRequest) {
  try {
    await requireAdminPermission('content', 'view');
    const sp = req.nextUrl.searchParams;
    const scope = sp.get('scope') ?? 'list';
    if (scope === 'audit') {
      return okJson(await getCmsOverviewAndSeoAudit());
    }

    const [contents, overview] = await Promise.all([
      listAdminCmsContents({
        contentType: sp.get('contentType') ?? undefined,
        categoryId: sp.get('categoryId') ?? undefined,
        authorId: sp.get('authorId') ?? undefined,
        locale: sp.get('locale') ?? undefined,
        destinationId: sp.get('destinationId') ?? undefined,
        status: sp.get('status') ?? undefined,
        updatedFrom: sp.get('updatedFrom') ?? undefined,
        updatedTo: sp.get('updatedTo') ?? undefined,
        q: sp.get('q') ?? undefined,
      }),
      sp.get('includeOverview') === '1'
        ? getCmsOverviewAndSeoAudit()
        : Promise.resolve(null),
    ]);

    return okJson({ contents, overview });
  } catch (err) {
    return errJson(err);
  }
}

const saveSchema = z.object({
  id: z.string().uuid().optional(),
  contentType: z.enum([
    'article',
    'landing_page',
    'destination_guide',
    'neighborhood_guide',
    'local_guide',
    'faq',
    'announcement',
    'hero_banner',
    'community_story',
  ]),
  category: z.string().max(80).optional(),
  categoryId: z.string().uuid().nullable().optional(),
  locale: z.enum(['en', 'vi']).optional(),
  translationGroupId: z.string().uuid().nullable().optional(),
  slug: z.string().min(1).max(160),
  titleEn: z.string().min(1).max(240),
  titleVi: z.string().max(240).optional(),
  excerptEn: z.string().max(600).optional(),
  excerptVi: z.string().max(600).optional(),
  bodyDocEn: z.unknown().optional(),
  bodyDocVi: z.unknown().optional(),
  bodyEn: z.string().optional(),
  bodyVi: z.string().optional(),
  destinationId: z.string().uuid().nullable().optional(),
  neighborhoodId: z.string().uuid().nullable().optional(),
  featuredMediaId: z.string().uuid().nullable().optional(),
  featuredImageUrl: z.string().max(500).optional(),
  seoTitle: z.string().max(180).optional(),
  seoDescription: z.string().max(350).optional(),
  focusKeyword: z.string().max(120).optional(),
  secondaryKeywords: z.array(z.string().max(100)).max(12).optional(),
  canonicalUrl: z.string().max(400).optional(),
  redirectTo: z.string().max(400).optional(),
  ogTitle: z.string().max(180).optional(),
  ogDescription: z.string().max(350).optional(),
  ogImageUrl: z.string().max(500).optional(),
  robotsIndex: z.boolean().optional(),
  robotsFollow: z.boolean().optional(),
  schemaType: z.enum(['Article', 'Guide', 'FAQPage', 'WebPage', 'CollectionPage']).optional(),
  breadcrumbTitle: z.string().max(120).optional(),
  publishStartAt: z.string().nullable().optional(),
  publishEndAt: z.string().nullable().optional(),
  scheduledAt: z.string().nullable().optional(),
  tagIds: z.array(z.string().uuid()).optional(),
  mode: z.enum(['autosave', 'save_draft', 'publish_now']).optional(),
  createRedirectOnSlugChange: z.boolean().optional(),
  changeSummary: z.string().max(200).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const parsed = saveSchema.safeParse(await req.json());
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', 'Invalid CMS content payload.');
    }
    const actor = await requireAdminPermission(
      'content',
      parsed.data.mode === 'publish_now'
        ? 'approve'
        : parsed.data.id
          ? 'edit'
          : 'create'
    );
    const result = await saveCmsContentPro(actor, parsed.data);
    return okJson(result, parsed.data.id ? 200 : 201);
  } catch (err) {
    return errJson(err);
  }
}
