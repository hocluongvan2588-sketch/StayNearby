import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth/session';
import { handleApiError, readOptionalJsonBody } from '@/lib/http';
import { updateAdminCrmProfile } from '@/modules/crm';

export const dynamic = 'force-dynamic';

const updateCrmSchema = z.object({
  crmStage: z.enum(['new', 'active', 'vip', 'follow_up', 'archived']),
  crmNote: z.string().max(2000).default(''),
});

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    const { id } = await context.params;
    const body = updateCrmSchema.parse(await readOptionalJsonBody(req));
    const contact = await updateAdminCrmProfile(user, id, body);
    return NextResponse.json({ ok: true, contact });
  } catch (err) {
    return handleApiError(err);
  }
}
