import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { AppError } from '@/lib/errors';
import { errJson, okJson } from '@/lib/http';
import { unlinkStayLocalPlace, updateStayLocalLinkNote } from '@/modules/host-local-places';

const noteSchema = z.object({ hostNote: z.string().max(500) });

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string; placeId: string }> }
) {
  try {
    const user = await requireRole(['host', 'admin']);
    const { id, placeId } = await context.params;
    const body = await req.json().catch(() => null);
    const parsed = noteSchema.safeParse(body);
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', 'Invalid note payload.');
    const out = await updateStayLocalLinkNote(user, id, placeId, parsed.data.hostNote);
    return okJson(out);
  } catch (err) {
    return errJson(err);
  }
}

export async function DELETE(_req: Request, context: { params: Promise<{ id: string; placeId: string }> }) {
  try {
    const user = await requireRole(['host', 'admin']);
    const { id, placeId } = await context.params;
    const out = await unlinkStayLocalPlace(user, id, placeId);
    return okJson(out);
  } catch (err) {
    return errJson(err);
  }
}
