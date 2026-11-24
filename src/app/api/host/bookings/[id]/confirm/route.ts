import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth/session';
import {
  getClientIp,
  handleApiError,
  readOptionalJsonBody,
} from '@/lib/http';
import { assertRateLimit } from '@/lib/rate-limit';
import { confirmBookingRequest } from '@/modules/bookings';

export const dynamic = 'force-dynamic';

const confirmSchema = z
  .object({
    responseNote: z.string().max(500).optional(),
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
      bucket: 'host_booking_decision',
      key: `${getClientIp(req)}:${user?.id || 'anon'}`,
      limit: 30,
      windowMs: 60_000,
    });

    const raw = await readOptionalJsonBody(req);
    const parsed = confirmSchema.parse(raw);
    const booking = await confirmBookingRequest(user, id, parsed?.responseNote);
    return NextResponse.json({ ok: true, booking });
  } catch (err) {
    return handleApiError(err);
  }
}
