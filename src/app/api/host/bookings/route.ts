import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { handleApiError } from '@/lib/http';
import { getHostBookingRequests } from '@/modules/bookings';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await getCurrentUser();
    const bookings = await getHostBookingRequests(user);
    return NextResponse.json({ ok: true, bookings });
  } catch (err) {
    return handleApiError(err);
  }
}
