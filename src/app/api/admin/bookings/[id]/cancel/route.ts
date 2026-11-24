import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/rbac';
import { getCurrentUser } from '@/lib/auth/session';
import {
  getClientIp,
  handleApiError,
  readOptionalJsonBody,
} from '@/lib/http';
import { assertRateLimit } from '@/lib/rate-limit';
import { cancelConfirmedBooking } from '@/modules/bookings';

export const dynamic = 'force-dynamic';

const adminCancelSchema = z.object({
  reason: z.string().trim().min(2, 'Vui lòng nhập lý do hủy đơn.').max(500),
});

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const user = await getCurrentUser();
    const admin = requireRole(user, 'admin');
    assertRateLimit({
      bucket: 'admin_booking_cancel',
      key: `${getClientIp(req)}:${admin.id}`,
      limit: 30,
      windowMs: 60_000,
    });

    const raw = await readOptionalJsonBody(req);
    const parsed = adminCancelSchema.parse(raw);
    const booking = await cancelConfirmedBooking(admin, id, parsed.reason);
    return NextResponse.json({ ok: true, booking });
  } catch (err) {
    return handleApiError(err);
  }
}
