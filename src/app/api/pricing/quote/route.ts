import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth/session';
import { getClientIp, handleApiError } from '@/lib/http';
import { assertRateLimit } from '@/lib/rate-limit';
import { calculateStayQuote } from '@/modules/pricing';

export const dynamic = 'force-dynamic';

const quoteSchema = z.object({
  listingId: z.string().uuid().optional(),
  listingSlug: z.string().min(1).optional(),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  guestsCount: z.coerce.number().int().min(1).max(20).default(1),
});

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    const ip = getClientIp(req);
    assertRateLimit({
      bucket: 'pricing_quote',
      key: user?.id || ip,
      limit: 60,
      windowMs: 60_000,
    });

    const sp = req.nextUrl.searchParams;
    const parsed = quoteSchema.parse({
      listingId: sp.get('listingId') || undefined,
      listingSlug: sp.get('listingSlug') || undefined,
      checkIn: sp.get('checkIn') || '',
      checkOut: sp.get('checkOut') || '',
      guestsCount: sp.get('guests') || sp.get('guestsCount') || 1,
    });

    const quote = await calculateStayQuote(parsed);
    return NextResponse.json({ ok: true, quote });
  } catch (err) {
    return handleApiError(err);
  }
}
