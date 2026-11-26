import { getConfig } from '@/lib/config';
import { AppError } from '@/lib/errors';
import { errJson, okJson } from '@/lib/http';
import { finalizeTransactionPaid } from '@/modules/payments';

/**
 * Webhook compatible with SePay / Casso / PayOS VietQR bank transfer notifications.
 * Expects Authorization: Apikey <VIETQR_WEBHOOK_TOKEN> or Bearer <VIETQR_WEBHOOK_TOKEN>.
 */
export async function POST(req: Request) {
  try {
    const cfg = getConfig();
    if (!cfg.vietqrWebhookToken) {
      throw new AppError(
        'UNCONFIGURED',
        'VIETQR_WEBHOOK_TOKEN is not configured.',
        503
      );
    }

    const authHeader = req.headers.get('authorization') || '';
    const customToken = req.headers.get('x-vietqr-token') || '';
    const provided =
      customToken ||
      authHeader.replace(/^(Apikey|Bearer)\s+/i, '').trim();

    if (!provided || provided !== cfg.vietqrWebhookToken) {
      throw new AppError('UNAUTHORIZED', 'Invalid VietQR webhook token.', 401);
    }

    const payload = (await req.json().catch(() => ({}))) as {
      content?: string;
      description?: string;
      transferAmount?: number;
      amount?: number;
      referenceCode?: string;
      id?: string | number;
    };

    const transferText = [
      payload.referenceCode || '',
      payload.content || '',
      payload.description || '',
    ]
      .join(' ')
      .toUpperCase();

    const match = transferText.match(/\b(VNM?\d{6,10})\b/);
    if (!match) {
      return okJson({ ignored: true, reason: 'No matching VietNomad reference code found.' });
    }

    const paidAmountVnd = Number(payload.transferAmount ?? payload.amount ?? 0);
    const result = await finalizeTransactionPaid({
      referenceCode: match[1],
      externalPaymentId: payload.id ? `vietqr_${payload.id}` : undefined,
      paidAmountVnd: Number.isFinite(paidAmountVnd) && paidAmountVnd > 0 ? paidAmountVnd : undefined,
    });

    return okJson({ received: true, result });
  } catch (err) {
    return errJson(err);
  }
}
