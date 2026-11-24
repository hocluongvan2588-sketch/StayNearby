import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { handleApiError } from '@/lib/http';
import { getAdminListingQueue } from '@/modules/admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await getCurrentUser();
    const listings = await getAdminListingQueue(user);
    return NextResponse.json({ ok: true, listings });
  } catch (err) {
    return handleApiError(err);
  }
}
