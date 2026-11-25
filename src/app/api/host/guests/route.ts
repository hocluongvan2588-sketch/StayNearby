import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { handleApiError } from '@/lib/http';
import { getHostGuestsCrm } from '@/modules/host';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await getCurrentUser();
    const guests = await getHostGuestsCrm(user);
    return NextResponse.json({ ok: true, guests });
  } catch (err) {
    return handleApiError(err);
  }
}
