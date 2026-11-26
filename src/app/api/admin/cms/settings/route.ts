import { NextRequest } from 'next/server';
import { z } from 'zod';
import { AppError } from '@/lib/errors';
import { errJson, okJson } from '@/lib/http';
import { requireAdminPermission } from '@/modules/admin-rbac';
import { getCmsSettings, updateCmsSettings } from '@/modules/cms-vietnomad';
import { getAiGatewayStatus, updateAiGatewayConfig } from '@/modules/ai-gateway';

export async function GET() {
  try {
    await requireAdminPermission('content', 'view');
    const [settings, aiGateway] = await Promise.all([
      getCmsSettings(),
      getAiGatewayStatus(),
    ]);
    return okJson({ settings, aiGateway });
  } catch (err) {
    return errJson(err);
  }
}

const patchSchema = z.object({
  seoDefaults: z
    .object({
      siteName: z.string().min(1).max(120).optional(),
      titleSeparator: z.string().min(1).max(8).optional(),
      defaultRobotsIndex: z.boolean().optional(),
      defaultRobotsFollow: z.boolean().optional(),
      includeCategoriesInSitemap: z.boolean().optional(),
      gscPropertyUrl: z.string().max(240).optional(),
      gscConnected: z.boolean().optional(),
    })
    .optional(),
  editorialWorkflow: z
    .object({
      requireReviewBeforePublish: z.boolean().optional(),
      autosaveIntervalMs: z.number().int().min(1000).max(30000).optional(),
      autoCreateRedirectOnSlugChange: z.boolean().optional(),
    })
    .optional(),
  aiGateway: z
    .object({
      model: z.string().min(2).max(80).optional(),
      isEnabled: z.boolean().optional(),
      monthlyBudgetUsd: z.number().min(0).max(5000).optional(),
      rateLimitPerHour: z.number().int().min(1).max(1000).optional(),
      featureFlags: z
        .record(
          z.enum([
            'inlineRewrite',
            'seoSuggestions',
            'translateEnVi',
            'outlineBrief',
            'faqGenerator',
            'internalLinkSuggestions',
            'contentGapAnalysis',
          ]),
          z.boolean()
        )
        .optional(),
    })
    .optional(),
});

export async function PATCH(req: NextRequest) {
  try {
    const actor = await requireAdminPermission('content', 'approve');
    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', 'Invalid CMS settings payload.');

    const settings = await updateCmsSettings(actor, {
      seoDefaults: parsed.data.seoDefaults as never,
      editorialWorkflow: parsed.data.editorialWorkflow as never,
    });
    const aiGateway = parsed.data.aiGateway
      ? await updateAiGatewayConfig(actor, parsed.data.aiGateway)
      : await getAiGatewayStatus();

    return okJson({ settings, aiGateway });
  } catch (err) {
    return errJson(err);
  }
}
