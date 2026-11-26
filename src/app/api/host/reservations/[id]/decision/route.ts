import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { AppError } from '@/lib/errors';
import { errJson, okJson } from '@/lib/http';
import { respondToPendingBooking } from '@/modules/bookings';

const schema = z.object({
  decision: z.enum(['approve', 'decline']),
  note: z.string().max(500).optional(),
});

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireRole(['host', 'admin']);
    const { id } = await context.params;
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', 'Invalid booking decision payload.');
    }
    const result = await respondToPendingBooking(
      user,
      id,
      parsed.data.decision,
      parsed.data.note
    );
    return okJson({ booking: result });
  } catch (err) {
    return errJson(err);
  }
}
