import { requireUser } from '@/lib/auth/session';
import { errJson, okJson } from '@/lib/http';
import { cancelBookingByMember } from '@/modules/bookings';

export async function POST(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const outcome = await cancelBookingByMember(user, id);
    return okJson({ outcome });
  } catch (err) {
    return errJson(err);
  }
}
