import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth/session';
import { handleApiError } from '@/lib/http';
import { getHostListingDetail, updateHostListing } from '@/modules/host';

export const dynamic = 'force-dynamic';

const hostListingPatchSchema = z.object({
  areaId: z.string().uuid(),
  propertyType: z.enum(['apartment', 'studio', 'villa', 'house', 'homestay']),
  maxGuests: z.coerce.number().int().min(1).max(20),
  bedrooms: z.coerce.number().int().min(0).max(20),
  beds: z.coerce.number().int().min(1).max(30),
  bathrooms: z.coerce.number().min(0.5).max(20),
  minNights: z.coerce.number().int().min(1).max(180),
  maxNights: z.coerce.number().int().min(1).max(365),
  baseNightlyRateVnd: z.coerce.number().int().positive(),
  cleaningFeeVnd: z.coerce.number().int().min(0),
  cancellationPolicyVersion: z.enum(['flexible_24h', 'moderate_5d']).optional(),
  titleEn: z.string().min(3).max(160),
  summaryEn: z.string().min(5).max(300),
  descriptionEn: z.string().min(10).max(5000),
  houseRulesEn: z.array(z.string().max(300)).default([]),
  hasDedicatedDesk: z.coerce.boolean().default(false),
  workspaceNotesEn: z.string().max(500).optional(),
  checkinConditionsEn: z.string().max(500).optional(),
  lateCheckinAvailable: z.coerce.boolean().optional(),
  exactAddress: z.string().min(3).max(400),
  checkinInstructionsEn: z.string().max(2000).default(''),
  hostContactPhone: z.string().max(40).optional(),
  amenityCodes: z.array(z.string()).optional(),
});

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const user = await getCurrentUser();
    const listing = await getHostListingDetail(user, id);
    return NextResponse.json({ ok: true, listing });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const user = await getCurrentUser();
    const body = await req.json();
    const parsed = hostListingPatchSchema.parse(body);
    const listing = await updateHostListing(user, id, parsed);
    return NextResponse.json({ ok: true, listing });
  } catch (err) {
    return handleApiError(err);
  }
}
