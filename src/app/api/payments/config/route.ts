import { okJson } from '@/lib/http';
import { getPaymentGatewayStatus } from '@/modules/payments';

export async function GET() {
  return okJson({ gateway: getPaymentGatewayStatus() });
}
