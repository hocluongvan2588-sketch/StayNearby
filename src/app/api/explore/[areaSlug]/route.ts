import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { AppError } from '@/lib/errors';
import { getClientIp, handleApiError } from '@/lib/http';
import { assertRateLimit } from '@/lib/rate-limit';
import {
  getExploreAreaDetail,
  listPublishedCoworkingForArea,
  listPublishedExploreAreas,
  listPublishedGuidesForArea,
} from '@/modules/local-guides';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
  theme: z.enum(['food', 'culture', 'leisure', 'coworking']).optional(),
  durationBucket: z.enum(['1_2_hours', 'half_day']).optional(),
  budgetTier: z.enum(['budget', 'moderate', 'splurge']).optional(),
  companion: z.enum(['solo', 'group']).optional(),
});

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ areaSlug: string }> }
) {
  try {
    assertRateLimit({
      bucket: 'explore_area',
      key: getClientIp(req),
      limit: 120,
      windowMs: 60_000,
    });

    const { areaSlug } = await context.params;
    const sp = req.nextUrl.searchParams;
    const filters = querySchema.parse({
      theme: sp.get('theme') || undefined,
      durationBucket: sp.get('durationBucket') || undefined,
      budgetTier: sp.get('budgetTier') || undefined,
      companion: sp.get('companion') || undefined,
    });

    const area = await getExploreAreaDetail(areaSlug);
    if (!area) {
      throw new AppError('NOT_FOUND', 'Neighborhood guide area not found.');
    }

    const [areas, guides, nearbyCoworking] = await Promise.all([
      listPublishedExploreAreas(),
      listPublishedGuidesForArea(area.slug, filters),
      listPublishedCoworkingForArea(area.slug),
    ]);

    return NextResponse.json(
      {
        ok: true,
        area,
        areas,
        guides,
        nearbyCoworking,
      },
      {
        headers: {
          'Cache-Control': 'public, max-age=60',
        },
      }
    );
  } catch (err) {
    return handleApiError(err);
  }
}
