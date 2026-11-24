import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth/session';
import { handleApiError, readOptionalJsonBody } from '@/lib/http';
import { setLocalGuidePublished } from '@/modules/local-guides';

export const dynamic = 'force-dynamic';

const toggleSchema = z.object({
  isPublished: z.boolean(),
});

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    const { id } = await context.params;
    const raw = await readOptionalJsonBody(req);
    const body = toggleSchema.parse(raw);
    const guide = await setLocalGuidePublished(user, id, body.isPublished);
    return NextResponse.json({ ok: true, guide });
  } catch (err) {
    return handleApiError(err);
  }
}
