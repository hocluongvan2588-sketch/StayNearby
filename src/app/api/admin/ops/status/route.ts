import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { handleApiError } from '@/lib/http';
import { getAdminOpsSnapshot } from '@/modules/ops';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await getCurrentUser();
    const snapshot = await getAdminOpsSnapshot(user);
    return NextResponse.json({ ok: true, snapshot });
  } catch (err) {
    return handleApiError(err);
  }
}
