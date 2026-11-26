import { getConfig } from '@/lib/config';
import type { DbClient } from '@/lib/db';

export async function refundGatewayTransactionIfLive(
  txClient: DbClient,
  params: { bookingId: string; refundAmountVnd: number }
) {
  if (params.refundAmountVnd <= 0) return;

  const txRes = await txClient.query<{
    id: string;
    provider: string;
    mode: string;
    external_payment_id: string | null;
  }>(
    `SELECT id, provider, mode, external_payment_id
     FROM payment_transactions
     WHERE booking_id = $1 AND status = 'paid'
     ORDER BY created_at DESC LIMIT 1`,
    [params.bookingId]
  );
  const paidTx = txRes.rows[0];
  if (!paidTx) return;

  const cfg = getConfig();
  if (
    paidTx.provider === 'stripe' &&
    paidTx.mode === 'live' &&
    cfg.stripeSecretKey &&
    paidTx.external_payment_id?.startsWith('pi_')
  ) {
    const form = new URLSearchParams();
    form.set('payment_intent', paidTx.external_payment_id);
    form.set('amount', String(Math.round(params.refundAmountVnd)));
    await fetch('https://api.stripe.com/v1/refunds', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
    }).catch(() => null);
  }

  await txClient.query(
    `UPDATE payment_transactions
     SET status = 'refunded', refunded_at = NOW()
     WHERE id = $1`,
    [paidTx.id]
  );
}
