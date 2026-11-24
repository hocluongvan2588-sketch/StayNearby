import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth/session';
import { handleApiError } from '@/lib/http';
import { requestChangesAdminListing } from '@/modules/admin';

export const dynamic = 'force-dynamic';

const reasonSchema = z.object({
  reason: z.string().min(2).max(500),
});

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const user = await getCurrentUser();
    const body = await req.json();
    const parsed = reasonSchema.parse(body);
    const listing = await requestChangesAdminListing(user, id, parsed.reason);
    return NextResponse.json({ ok: true, listing });
  } catch (err) {
    return handleApiError(err);
  }
}
