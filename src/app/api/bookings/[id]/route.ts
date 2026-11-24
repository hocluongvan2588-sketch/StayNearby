import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { handleApiError } from '@/lib/http';
import { getBookingDetail } from '@/modules/bookings';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const user = await getCurrentUser();
    const booking = await getBookingDetail(user, id);
    return NextResponse.json({ ok: true, booking });
  } catch (err) {
    return handleApiError(err);
  }
}
