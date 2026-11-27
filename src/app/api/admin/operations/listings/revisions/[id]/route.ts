import { NextRequest } from 'next/server';
import { z } from 'zod';
import { AppError } from '@/lib/errors';
import { errJson, okJson } from '@/lib/http';
import { requireAdminPermission } from '@/modules/admin-rbac';
import { approveStayRevision, rejectStayRevision } from '@/modules/listing-revisions';

const bodySchema = z.object({
  action: z.enum(['approve', 'reject']),
  note: z.string().max(400).optional(),
});

/** Review a pending listing revision: approve (applies to the live stay) or reject. */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const body = await req.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', 'Invalid revision review payload.');
    }
    const actor = await requireAdminPermission('listings', 'approve');
    const { id } = await context.params;
    const out =
      parsed.data.action === 'approve'
        ? await approveStayRevision(actor, id, parsed.data.note)
        : await rejectStayRevision(actor, id, parsed.data.note);
    return okJson(out);
  } catch (err) {
    return errJson(err);
  }
}
