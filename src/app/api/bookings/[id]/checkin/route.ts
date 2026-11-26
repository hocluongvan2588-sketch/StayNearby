import { requireRole } from '@/lib/auth/session';
import { errJson, okJson } from '@/lib/http';
import { confirmCheckInCompleted } from '@/modules/bookings';

export async function POST(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireRole(['host', 'admin']);
    const { id } = await context.params;
    const result = await confirmCheckInCompleted(actor, id);
    return okJson({ booking: result });
  } catch (err) {
    return errJson(err);
  }
}
