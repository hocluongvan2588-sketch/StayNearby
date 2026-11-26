import { requireUser } from '@/lib/auth/session';
import { errJson, okJson } from '@/lib/http';
import { confirmBookingFeePayment } from '@/modules/bookings';

export async function POST(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const result = await confirmBookingFeePayment(user, id);
    return okJson({ payment: result });
  } catch (err) {
    return errJson(err);
  }
}
