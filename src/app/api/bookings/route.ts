import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth/session';
import { getClientIp, handleApiError } from '@/lib/http';
import { assertRateLimit } from '@/lib/rate-limit';
import { createBookingRequest, getGuestTrips } from '@/modules/bookings';

export const dynamic = 'force-dynamic';

const createBookingSchema = z.object({
  listingId: z.string().uuid().optional(),
  listingSlug: z.string().min(1).optional(),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  guestsCount: z.coerce.number().int().min(1).max(20),
  idempotencyKey: z.string().min(1).max(128),
  expectedQuoteHash: z.string().min(10).optional(),
  guestNote: z.string().max(1000).optional(),
});

export async function GET() {
  try {
    const user = await getCurrentUser();
    const trips = await getGuestTrips(user);
    return NextResponse.json({ ok: true, trips });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    const ip = getClientIp(req);
    assertRateLimit({
      bucket: 'booking_create',
      key: `${ip}:${user?.id || 'anon'}`,
      limit: 15,
      windowMs: 60_000,
    });

    const body = await req.json();
    const parsed = createBookingSchema.parse(body);
    const result = await createBookingRequest(user, parsed);

    return NextResponse.json(
      { ok: true, ...result },
      { status: result.deduplicated ? 200 : 201 }
    );
  } catch (err) {
    return handleApiError(err);
  }
}
