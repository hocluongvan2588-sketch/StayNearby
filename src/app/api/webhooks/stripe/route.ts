import { getConfig } from '@/lib/config';
import { AppError } from '@/lib/errors';
import { errJson, okJson } from '@/lib/http';
import {
  finalizeTransactionPaid,
  markTransactionFailedOrExpired,
  verifyStripeWebhookSignature,
} from '@/modules/payments';

export async function POST(req: Request) {
  try {
    const cfg = getConfig();
    if (!cfg.stripeWebhookSecret) {
      throw new AppError(
        'UNCONFIGURED',
        'STRIPE_WEBHOOK_SECRET is not configured.',
        503
      );
    }

    const rawBody = await req.text();
    const signature = req.headers.get('stripe-signature');
    const valid = verifyStripeWebhookSignature(rawBody, signature, cfg.stripeWebhookSecret);
    if (!valid) {
      throw new AppError('UNAUTHORIZED', 'Invalid Stripe webhook signature.', 401);
    }

    const event = JSON.parse(rawBody) as {
      type?: string;
      data?: {
        object?: {
          id?: string;
          payment_intent?: string;
          payment_status?: string;
          amount_total?: number;
          client_reference_id?: string;
          metadata?: Record<string, string>;
        };
      };
    };

    const session = event.data?.object;
    const transactionId = session?.metadata?.transactionId || session?.client_reference_id;
    const referenceCode = session?.metadata?.referenceCode;

    if (event.type === 'checkout.session.completed' && session?.payment_status === 'paid') {
      await finalizeTransactionPaid({
        transactionId,
        referenceCode,
        externalPaymentId: session.payment_intent || session.id,
        paidAmountVnd: typeof session.amount_total === 'number' ? session.amount_total : undefined,
      });
    } else if (event.type === 'checkout.session.expired') {
      await markTransactionFailedOrExpired({
        transactionId,
        referenceCode,
        nextStatus: 'expired',
        reason: 'Stripe checkout session expired',
      });
    } else if (event.type === 'payment_intent.payment_failed') {
      await markTransactionFailedOrExpired({
        transactionId,
        referenceCode,
        nextStatus: 'failed',
        reason: 'Stripe payment intent failed',
      });
    }

    return okJson({ received: true });
  } catch (err) {
    return errJson(err);
  }
}
