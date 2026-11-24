import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { handleApiError } from '@/lib/http';
import { restoreAdminListing } from '@/modules/admin';

export const dynamic = 'force-dynamic';

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const user = await getCurrentUser();
    const listing = await restoreAdminListing(user, id);
    return NextResponse.json({ ok: true, listing });
  } catch (err) {
    return handleApiError(err);
  }
}
