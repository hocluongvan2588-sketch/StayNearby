import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth/session';
import { handleApiError, readOptionalJsonBody } from '@/lib/http';
import { createLocalPlace } from '@/modules/local-guides';

export const dynamic = 'force-dynamic';

const createPlaceSchema = z.object({
  areaId: z.string().min(1),
  nameEn: z.string().trim().min(2).max(160),
  nameVi: z.string().trim().max(160).optional(),
  theme: z.enum(['food', 'culture', 'leisure', 'coworking']),
  shortDescriptionEn: z.string().trim().min(5).max(500),
  shortDescriptionVi: z.string().trim().max(500).optional(),
  imagePath: z.string().trim().max(300).optional(),
  estimatedCostVnd: z.number().int().min(0).max(50_000_000),
  budgetTier: z.enum(['budget', 'moderate', 'splurge']),
  durationMinutes: z.number().int().min(10).max(600).optional(),
  suitableSolo: z.boolean().optional(),
  suitableGroup: z.boolean().optional(),
  hasVideoCallBooths: z.boolean().optional(),
  bookingRequired: z.boolean().optional(),
  coworkingNotesEn: z.string().trim().max(400).optional(),
  coworkingNotesVi: z.string().trim().max(400).optional(),
  directionsNoteEn: z.string().trim().max(400).optional(),
  directionsNoteVi: z.string().trim().max(400).optional(),
  mapsUrl: z.string().trim().url(),
  partnerBookingUrl: z.string().trim().url().optional().or(z.literal('')),
  source: z.string().trim().min(3).max(200),
  isPublished: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    const raw = await readOptionalJsonBody(req);
    const body = createPlaceSchema.parse(raw);
    const place = await createLocalPlace(user, {
      ...body,
      partnerBookingUrl: body.partnerBookingUrl || undefined,
    });
    return NextResponse.json({ ok: true, place }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
