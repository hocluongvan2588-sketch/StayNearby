import { requireUser } from '@/lib/auth/session';
import { AppError } from '@/lib/errors';
import { errJson, okJson } from '@/lib/http';
import { confirmBookingFeePayment } from '@/modules/bookings';
import { getPaymentGatewayStatus } from '@/modules/payments';

export async function POST(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const gw = getPaymentGatewayStatus();
    if (gw.stripeLive || gw.vietqrLive) {
      throw new AppError(
        'FORBIDDEN',
        'Direct payment bypass is disabled when live payment gateways are active. Use /api/payments/checkout.'
      );
    }
    const result = await confirmBookingFeePayment(user, id);
    return okJson({ payment: result });
  } catch (err) {
    return errJson(err);
  }
}
