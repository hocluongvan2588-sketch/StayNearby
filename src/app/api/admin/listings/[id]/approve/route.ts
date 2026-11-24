import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth/session';
import { handleApiError } from '@/lib/http';
import { approveAdminListing } from '@/modules/admin';

export const dynamic = 'force-dynamic';

const noteSchema = z
  .object({
    note: z.string().max(500).optional(),
  })
  .optional();

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const user = await getCurrentUser();
    const raw = await req.json().catch(() => ({}));
    const parsed = noteSchema.parse(raw);
    const listing = await approveAdminListing(user, id, parsed?.note);
    return NextResponse.json({ ok: true, listing });
  } catch (err) {
    return handleApiError(err);
  }
}
