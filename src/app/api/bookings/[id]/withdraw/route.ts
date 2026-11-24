import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth/session';
import {
  getClientIp,
  handleApiError,
  readOptionalJsonBody,
} from '@/lib/http';
import { assertRateLimit } from '@/lib/rate-limit';
import { withdrawBookingRequest } from '@/modules/bookings';

export const dynamic = 'force-dynamic';

const reasonSchema = z
  .object({
    reason: z.string().max(500).optional(),
  })
  .optional();

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const user = await getCurrentUser();
    assertRateLimit({
      bucket: 'booking_withdraw',
      key: `${getClientIp(req)}:${user?.id || 'anon'}`,
      limit: 20,
      windowMs: 60_000,
    });

    const raw = await readOptionalJsonBody(req);
    const parsed = reasonSchema.parse(raw);
    const booking = await withdrawBookingRequest(user, id, parsed?.reason);
    return NextResponse.json({ ok: true, booking });
  } catch (err) {
    return handleApiError(err);
  }
}
