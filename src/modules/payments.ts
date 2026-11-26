import crypto from 'node:crypto';
import type { SessionUser } from '@/lib/auth/session';
import { getConfig } from '@/lib/config';
import { dbQuery, dbTransaction, toNum, type DbClient } from '@/lib/db';
import { isValidUuid } from '@/lib/dates';
import { AppError } from '@/lib/errors';
import { markBookingPaidInTx } from '@/modules/bookings';
import {
  NOMAD_PASS_PRICE_VND,
  type GatewayTransactionDTO,
  type PaymentGatewayStatus,
  type PaymentProvider,
  type PaymentPurpose,
} from '@/lib/payment-types';

export {
  NOMAD_PASS_PRICE_VND,
  type GatewayTransactionDTO,
  type PaymentGatewayStatus,
  type PaymentProvider,
  type PaymentPurpose,
};

export function getPaymentGatewayStatus(): PaymentGatewayStatus {
  const cfg = getConfig();
  const stripeLive = Boolean(cfg.stripeSecretKey);
  const vietqrLive = Boolean(cfg.vietqrBankBin && cfg.vietqrAccountNo);

  return {
    stripeLive,
    vietqrLive,
    nomadPassPriceVnd: NOMAD_PASS_PRICE_VND,
    vietqrBankPreview: vietqrLive
      ? {
          bankBin: cfg.vietqrBankBin,
          accountNoMasked:
            cfg.vietqrAccountNo.length > 4
              ? `****${cfg.vietqrAccountNo.slice(-4)}`
              : cfg.vietqrAccountNo,
          accountName: cfg.vietqrAccountName || 'VIETNOMAD STAYS',
        }
      : null,
  };
}

function normalizeOrigin(rawOrigin?: string): string {
  const cfg = getConfig();
  const fallback = cfg.appBaseUrl.replace(/\/+$/, '');
  if (!rawOrigin) return fallback;
  try {
    const parsed = new URL(rawOrigin);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.origin;
    }
  } catch {
    // ignore malformed origin
  }
  return fallback;
}

function buildVietQrImageUrl(params: {
  bankBin: string;
  accountNo: string;
  accountName: string;
  amountVnd: number;
  referenceCode: string;
}): string {
  const qs = new URLSearchParams({
    amount: String(Math.round(params.amountVnd)),
    addInfo: params.referenceCode,
    accountName: params.accountName,
  });
  return `https://img.vietqr.io/image/${encodeURIComponent(params.bankBin)}-${encodeURIComponent(params.accountNo)}-compact2.png?${qs.toString()}`;
}

async function createStripeCheckoutSessionApi(params: {
  secretKey: string;
  amountVnd: number;
  title: string;
  description: string;
  referenceCode: string;
  transactionId: string;
  purpose: PaymentPurpose;
  bookingId?: string;
  customerEmail: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ sessionId: string; checkoutUrl: string }> {
  const form = new URLSearchParams();
  form.set('mode', 'payment');
  form.set('payment_method_types[]', 'card');
  form.set('customer_email', params.customerEmail);
  form.set('client_reference_id', params.transactionId);
  form.set('success_url', params.successUrl);
  form.set('cancel_url', params.cancelUrl);
  form.set('line_items[0][quantity]', '1');
  form.set('line_items[0][price_data][currency]', 'vnd');
  // VND is a zero-decimal currency in Stripe
  form.set('line_items[0][price_data][unit_amount]', String(Math.round(params.amountVnd)));
  form.set('line_items[0][price_data][product_data][name]', params.title);
  form.set('line_items[0][price_data][product_data][description]', params.description);
  form.set('metadata[transactionId]', params.transactionId);
  form.set('metadata[referenceCode]', params.referenceCode);
  form.set('metadata[purpose]', params.purpose);
  if (params.bookingId) {
    form.set('metadata[bookingId]', params.bookingId);
  }

  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form.toString(),
  });

  const data = (await res.json()) as {
    id?: string;
    url?: string;
    error?: { message?: string };
  };

  if (!res.ok || !data.id || !data.url) {
    throw new AppError(
      'PAYMENT_GATEWAY_ERROR',
      data.error?.message || 'Could not initialize Stripe Checkout session.',
      502
    );
  }

  return { sessionId: data.id, checkoutUrl: data.url };
}

export interface CreateCheckoutInput {
  purpose: PaymentPurpose;
  provider: PaymentProvider;
  bookingId?: string;
  vatTaxId?: string;
  origin?: string;
}

export async function createGatewayCheckoutSession(
  user: SessionUser,
  input: CreateCheckoutInput
): Promise<GatewayTransactionDTO> {
  const cfg = getConfig();
  const origin = normalizeOrigin(input.origin);
  const txId = crypto.randomUUID();

  let amountVnd = 0;
  let referenceCode = '';
  let bookingId: string | null = null;
  let itemTitle = '';
  let itemDesc = '';
  const metadata: Record<string, unknown> = {};

  if (input.purpose === 'booking_fee') {
    if (!input.bookingId || !isValidUuid(input.bookingId)) {
      throw new AppError('VALIDATION_ERROR', 'Valid bookingId is required.');
    }
    const bRes = await dbQuery<{
      id: string;
      booking_code: string;
      guest_id: string;
      status: string;
      booking_fee_online_vnd: string | number;
      nights: number;
      title_en: string;
    }>(
      `SELECT b.id, b.booking_code, b.guest_id, b.status, b.booking_fee_online_vnd, b.nights, s.title_en
       FROM bookings b
       JOIN stays s ON s.id = b.stay_id
       WHERE b.id = $1`,
      [input.bookingId]
    );
    const b = bRes.rows[0];
    if (!b) throw new AppError('NOT_FOUND', 'Booking not found.');
    if (b.guest_id !== user.id && user.role !== 'admin') {
      throw new AppError('FORBIDDEN', 'You cannot pay for another member’s booking.');
    }
    if (b.status !== 'PENDING_PAYMENT') {
      throw new AppError('CONFLICT', 'This booking does not require online payment.');
    }

    bookingId = b.id;
    amountVnd = toNum(b.booking_fee_online_vnd);
    // Use clean alphanumeric transfer memo friendly to VN banking apps (e.g. VN839201)
    const compactCode = b.booking_code.replace(/[^A-Z0-9]/gi, '').toUpperCase();
    referenceCode = `${compactCode}${crypto.randomInt(10, 99)}`;
    itemTitle = `VietNomad Booking Fee (${b.booking_code})`;
    itemDesc = `12% reservation & verification fee for ${b.title_en} (${b.nights} nights)`;
    metadata.bookingCode = b.booking_code;
  } else {
    amountVnd = NOMAD_PASS_PRICE_VND;
    referenceCode = `VNM${crypto.randomInt(100000, 999999)}`;
    itemTitle = 'VietNomad Nomad Pass (1 Year)';
    itemDesc = '4% stay reward credit + VAT-free business invoicing for 12 months';
    if (input.vatTaxId?.trim()) {
      metadata.vatTaxId = input.vatTaxId.trim();
    }
  }

  let mode: 'live' | 'sandbox' = 'sandbox';
  let externalSessionId: string | null = null;
  let checkoutUrl: string | null = null;
  let qrImageUrl: string | null = null;
  let bankDetails: GatewayTransactionDTO['bankDetails'] = null;

  if (input.provider === 'stripe') {
    if (cfg.stripeSecretKey) {
      const successUrl =
        input.purpose === 'booking_fee'
          ? `${origin}/dashboard?payment=success&tx=${txId}`
          : `${origin}/membership?payment=success&tx=${txId}`;
      const cancelUrl =
        input.purpose === 'booking_fee'
          ? `${origin}/dashboard?payment=cancelled&tx=${txId}`
          : `${origin}/membership?payment=cancelled&tx=${txId}`;

      const stripeRes = await createStripeCheckoutSessionApi({
        secretKey: cfg.stripeSecretKey,
        amountVnd,
        title: itemTitle,
        description: itemDesc,
        referenceCode,
        transactionId: txId,
        purpose: input.purpose,
        bookingId: bookingId ?? undefined,
        customerEmail: user.email,
        successUrl,
        cancelUrl,
      });
      mode = 'live';
      externalSessionId = stripeRes.sessionId;
      checkoutUrl = stripeRes.checkoutUrl;
    } else {
      mode = 'sandbox';
      externalSessionId = `cs_sandbox_${crypto.randomBytes(6).toString('hex')}`;
    }
  } else {
    // VietQR
    if (cfg.vietqrBankBin && cfg.vietqrAccountNo) {
      mode = 'live';
      const accountName = cfg.vietqrAccountName || 'VIETNOMAD STAYS';
      qrImageUrl = buildVietQrImageUrl({
        bankBin: cfg.vietqrBankBin,
        accountNo: cfg.vietqrAccountNo,
        accountName,
        amountVnd,
        referenceCode,
      });
      bankDetails = {
        bankBin: cfg.vietqrBankBin,
        accountNo: cfg.vietqrAccountNo,
        accountName,
      };
    } else {
      mode = 'sandbox';
      qrImageUrl = `/api/payments/sandbox-qr?ref=${encodeURIComponent(referenceCode)}&amount=${amountVnd}`;
      bankDetails = {
        bankBin: '970422',
        accountNo: '0000000000 (Sandbox)',
        accountName: 'VIETNOMAD STAYS SANDBOX',
      };
    }
  }

  await dbTransaction(async (tx) => {
    await tx.query(
      `INSERT INTO payment_transactions (
        id, purpose, booking_id, user_id, provider, mode, status,
        amount_vnd, currency, reference_code, external_session_id,
        checkout_url, qr_image_url, metadata
      ) VALUES ($1,$2,$3,$4,$5,$6,'pending',$7,'VND',$8,$9,$10,$11,$12)`,
      [
        txId,
        input.purpose,
        bookingId,
        user.id,
        input.provider,
        mode,
        amountVnd,
        referenceCode,
        externalSessionId,
        checkoutUrl,
        qrImageUrl,
        JSON.stringify(metadata),
      ]
    );

    if (bookingId) {
      await tx.query(
        `UPDATE bookings
         SET payment_provider = $2,
             payment_reference = $3
         WHERE id = $1 AND status = 'PENDING_PAYMENT'`,
        [bookingId, input.provider, referenceCode]
      );
    }
  });

  return {
    id: txId,
    purpose: input.purpose,
    bookingId,
    provider: input.provider,
    mode,
    status: 'pending',
    amountVnd,
    currency: 'VND',
    referenceCode,
    checkoutUrl,
    qrImageUrl,
    bankDetails,
  };
}

export async function finalizeTransactionPaid(params: {
  transactionId?: string;
  referenceCode?: string;
  externalPaymentId?: string;
  paidAmountVnd?: number;
}) {
  return dbTransaction(async (tx) => {
    const query = params.transactionId
      ? 'SELECT * FROM payment_transactions WHERE id = $1 FOR UPDATE'
      : 'SELECT * FROM payment_transactions WHERE reference_code = $1 FOR UPDATE';
    const lookupVal = params.transactionId || params.referenceCode;
    if (!lookupVal) {
      throw new AppError('VALIDATION_ERROR', 'Missing transaction reference.');
    }

    const res = await tx.query<{
      id: string;
      purpose: PaymentPurpose;
      booking_id: string | null;
      user_id: string;
      provider: string;
      mode: 'live' | 'sandbox';
      status: string;
      amount_vnd: string | number;
      reference_code: string;
      external_payment_id: string | null;
      metadata: Record<string, unknown> | string;
    }>(query, [lookupVal]);

    const record = res.rows[0];
    if (!record) {
      throw new AppError('NOT_FOUND', 'Payment transaction not found.');
    }

    if (record.status === 'paid') {
      return {
        alreadyPaid: true,
        transactionId: record.id,
        purpose: record.purpose,
        bookingId: record.booking_id,
      };
    }

    if (
      typeof params.paidAmountVnd === 'number' &&
      params.paidAmountVnd < toNum(record.amount_vnd)
    ) {
      throw new AppError(
        'VALIDATION_ERROR',
        `Received transfer (${params.paidAmountVnd}) is below required amount (${record.amount_vnd}).`
      );
    }

    const finalExternalId =
      params.externalPaymentId ||
      record.external_payment_id ||
      `pay_${record.provider}_${crypto.randomBytes(6).toString('hex')}`;

    await tx.query(
      `UPDATE payment_transactions
       SET status = 'paid',
           external_payment_id = $2,
           paid_at = NOW()
       WHERE id = $1`,
      [record.id, finalExternalId]
    );

    if (record.purpose === 'booking_fee' && record.booking_id) {
      await markBookingPaidInTx(tx, record.booking_id, {
        provider: record.provider,
        referenceCode: record.reference_code,
        externalPaymentId: finalExternalId,
      });
    } else if (record.purpose === 'membership_pass') {
      const meta =
        typeof record.metadata === 'string'
          ? (JSON.parse(record.metadata) as Record<string, unknown>)
          : record.metadata || {};
      const vatTaxId = typeof meta.vatTaxId === 'string' ? meta.vatTaxId : null;
      const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString();

      await tx.query(
        `UPDATE users
         SET membership_tier = 'premium',
             membership_expires_at = $1,
             vat_tax_id = COALESCE($2, vat_tax_id)
         WHERE id = $3`,
        [expiresAt, vatTaxId, record.user_id]
      );
    }

    return {
      alreadyPaid: false,
      transactionId: record.id,
      purpose: record.purpose,
      bookingId: record.booking_id,
      referenceCode: record.reference_code,
    };
  });
}

export async function confirmSandboxTransaction(user: SessionUser, transactionId: string) {
  if (!isValidUuid(transactionId)) {
    throw new AppError('VALIDATION_ERROR', 'Invalid transaction id.');
  }

  const checkRes = await dbQuery<{
    id: string;
    user_id: string;
    mode: 'live' | 'sandbox';
  }>('SELECT id, user_id, mode FROM payment_transactions WHERE id = $1', [transactionId]);

  const txRow = checkRes.rows[0];
  if (!txRow) {
    throw new AppError('NOT_FOUND', 'Payment transaction not found.');
  }
  if (txRow.user_id !== user.id && user.role !== 'admin') {
    throw new AppError('FORBIDDEN', 'You cannot confirm another user’s payment.');
  }
  if (txRow.mode === 'live') {
    throw new AppError(
      'FORBIDDEN',
      'Live payment transactions must be confirmed automatically by payment gateway webhook.'
    );
  }

  return finalizeTransactionPaid({ transactionId: txRow.id });
}

export async function getTransactionStatusForUser(user: SessionUser, transactionId: string) {
  if (!isValidUuid(transactionId)) {
    throw new AppError('VALIDATION_ERROR', 'Invalid transaction id.');
  }
  const res = await dbQuery<{
    id: string;
    user_id: string;
    purpose: PaymentPurpose;
    booking_id: string | null;
    provider: string;
    mode: string;
    status: string;
    amount_vnd: string | number;
    reference_code: string;
    paid_at: string | null;
  }>('SELECT * FROM payment_transactions WHERE id = $1', [transactionId]);

  const row = res.rows[0];
  if (!row) throw new AppError('NOT_FOUND', 'Transaction not found.');
  if (row.user_id !== user.id && user.role !== 'admin') {
    throw new AppError('FORBIDDEN', 'Forbidden');
  }
  return {
    id: row.id,
    purpose: row.purpose,
    bookingId: row.booking_id,
    provider: row.provider,
    mode: row.mode,
    status: row.status,
    amountVnd: toNum(row.amount_vnd),
    referenceCode: row.reference_code,
    paidAt: row.paid_at,
  };
}

export function verifyStripeWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  webhookSecret: string
): boolean {
  if (!signatureHeader || !webhookSecret) return false;
  const parts = signatureHeader.split(',').map((s) => s.trim());
  const timestamp = parts.find((p) => p.startsWith('t='))?.slice(2);
  const v1Signatures = parts.filter((p) => p.startsWith('v1=')).map((p) => p.slice(3));

  if (!timestamp || v1Signatures.length === 0) return false;
  const ageSec = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (!Number.isFinite(ageSec) || ageSec > 300) return false;

  const expected = crypto
    .createHmac('sha256', webhookSecret)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex');

  const expectedBuf = Buffer.from(expected, 'utf8');
  return v1Signatures.some((sig) => {
    const sigBuf = Buffer.from(sig, 'utf8');
    if (sigBuf.length !== expectedBuf.length) return false;
    return crypto.timingSafeEqual(sigBuf, expectedBuf);
  });
}

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
