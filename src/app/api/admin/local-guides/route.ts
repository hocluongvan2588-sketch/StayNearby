import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { handleApiError } from '@/lib/http';
import { getAdminLocalGuidesData } from '@/modules/local-guides';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await getCurrentUser();
    const data = await getAdminLocalGuidesData(user);
    return NextResponse.json({ ok: true, ...data });
  } catch (err) {
    return handleApiError(err);
  }
}
