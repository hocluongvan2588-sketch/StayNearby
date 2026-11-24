import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { handleApiError } from '@/lib/http';
import { getAllAdminBookings } from '@/modules/bookings';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    const status = req.nextUrl.searchParams.get('status') || undefined;
    const bookings = await getAllAdminBookings(user, status);
    return NextResponse.json({ ok: true, bookings });
  } catch (err) {
    return handleApiError(err);
  }
}
