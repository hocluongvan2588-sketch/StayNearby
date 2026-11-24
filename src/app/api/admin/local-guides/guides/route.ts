import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth/session';
import { handleApiError, readOptionalJsonBody } from '@/lib/http';
import { createLocalGuide } from '@/modules/local-guides';

export const dynamic = 'force-dynamic';

const createGuideSchema = z.object({
  areaId: z.string().min(1),
  titleEn: z.string().trim().min(3).max(180),
  titleVi: z.string().trim().max(180).optional(),
  summaryEn: z.string().trim().min(10).max(600),
  summaryVi: z.string().trim().max(600).optional(),
  directionsSummaryEn: z.string().trim().max(400).optional(),
  directionsSummaryVi: z.string().trim().max(400).optional(),
  theme: z.enum(['food', 'culture', 'leisure', 'coworking']),
  durationBucket: z.enum(['1_2_hours', 'half_day']),
  budgetTier: z.enum(['budget', 'moderate', 'splurge']),
  estimatedTotalVnd: z.number().int().min(0).max(100_000_000),
  suitableSolo: z.boolean().optional(),
  suitableGroup: z.boolean().optional(),
  coverImagePath: z.string().trim().max(300).optional(),
  source: z.string().trim().min(3).max(200),
  isPublished: z.boolean().optional(),
  stops: z
    .array(
      z.object({
        placeId: z.string().min(1),
        recommendedItemsEn: z.string().trim().max(240).optional(),
        recommendedItemsVi: z.string().trim().max(240).optional(),
        localNotesEn: z.string().trim().max(320).optional(),
        localNotesVi: z.string().trim().max(320).optional(),
      })
    )
    .min(1)
    .max(6),
});

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    const raw = await readOptionalJsonBody(req);
    const body = createGuideSchema.parse(raw);
    const guide = await createLocalGuide(user, body);
    return NextResponse.json({ ok: true, guide }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
