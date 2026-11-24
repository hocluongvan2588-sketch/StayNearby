import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getClientIp, handleApiError } from '@/lib/http';
import { assertRateLimit } from '@/lib/rate-limit';
import { searchPublishedStays } from '@/modules/catalog';

export const dynamic = 'force-dynamic';

const searchSchema = z.object({
  area: z.string().optional(),
  q: z.string().optional(),
  checkIn: z.string().optional(),
  checkOut: z.string().optional(),
  guests: z.coerce.number().int().min(1).max(20).optional(),
  propertyType: z.string().optional(),
  amenity: z.string().optional(),
  lateCheckin: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(24).optional(),
});

export async function GET(req: NextRequest) {
  try {
    assertRateLimit({
      bucket: 'catalog_search',
      key: getClientIp(req),
      limit: 120,
      windowMs: 60_000,
    });

    const sp = req.nextUrl.searchParams;
    const parsed = searchSchema.parse({
      area: sp.get('area') || undefined,
      q: sp.get('q') || undefined,
      checkIn: sp.get('checkIn') || undefined,
      checkOut: sp.get('checkOut') || undefined,
      guests: sp.get('guests') || undefined,
      propertyType: sp.get('propertyType') || undefined,
      amenity: sp.get('amenity') || undefined,
      lateCheckin: sp.get('lateCheckin') || undefined,
      page: sp.get('page') || undefined,
      pageSize: sp.get('pageSize') || undefined,
    });

    const result = await searchPublishedStays({
      area: parsed.area,
      q: parsed.q,
      checkIn: parsed.checkIn,
      checkOut: parsed.checkOut,
      guests: parsed.guests,
      propertyType: parsed.propertyType,
      amenity: parsed.amenity,
      lateCheckin: parsed.lateCheckin === 'true',
      page: parsed.page,
      pageSize: parsed.pageSize,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return handleApiError(err);
  }
}
