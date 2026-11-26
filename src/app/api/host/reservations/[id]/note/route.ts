import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { AppError } from '@/lib/errors';
import { errJson, okJson } from '@/lib/http';
import { updateHostBookingNote } from '@/modules/bookings';

const schema = z.object({
  note: z.string().max(1500),
});

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireRole(['host', 'admin']);
    const { id } = await context.params;
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', 'Invalid note payload.');
    }
    const result = await updateHostBookingNote(user, id, parsed.data.note);
    return okJson(result);
  } catch (err) {
    return errJson(err);
  }
}
