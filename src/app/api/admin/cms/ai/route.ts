import { NextRequest } from 'next/server';
import { z } from 'zod';
import { AppError } from '@/lib/errors';
import { errJson, okJson } from '@/lib/http';
import { requireAdminPermission } from '@/modules/admin-rbac';
import {
  getAiGatewayStatus,
  listAiUsageLogs,
  runCmsAiAssistant,
} from '@/modules/ai-gateway';

export async function GET() {
  try {
    await requireAdminPermission('content', 'view');
    const [status, logs] = await Promise.all([
      getAiGatewayStatus(),
      listAiUsageLogs(30),
    ]);
    return okJson({ status, logs });
  } catch (err) {
    return errJson(err);
  }
}

const aiRequestSchema = z.object({
  featureKey: z.enum([
    'inlineRewrite',
    'seoSuggestions',
    'translateEnVi',
    'outlineBrief',
    'faqGenerator',
    'internalLinkSuggestions',
    'contentGapAnalysis',
  ]),
  locale: z.enum(['en', 'vi']).default('en'),
  contentId: z.string().uuid().nullable().optional(),
  destinationId: z.string().uuid().nullable().optional(),
  title: z.string().max(240).optional(),
  selectedText: z.string().max(4000).optional(),
  action: z
    .enum(['rewrite', 'tone_editorial', 'shorten', 'expand', 'seo_clarity', 'translate'])
    .optional(),
  bodyExcerpt: z.string().max(4000).optional(),
  focusKeyword: z.string().max(120).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const actor = await requireAdminPermission('content', 'edit');
    const parsed = aiRequestSchema.safeParse(await req.json());
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', 'Invalid AI assistant request.');
    }
    const result = await runCmsAiAssistant(actor, parsed.data);
    return okJson({ ...result });
  } catch (err) {
    return errJson(err);
  }
}
