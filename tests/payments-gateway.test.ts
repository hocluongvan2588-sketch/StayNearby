import crypto from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SessionUser } from '@/lib/auth/session';
import { closeDb, dbQuery, ensureDbReady } from '@/lib/db';
import { createStayBooking } from '@/modules/bookings';
import { getStayDetailBySlug } from '@/modules/catalog';
import {
  confirmSandboxTransaction,
  createGatewayCheckoutSession,
  finalizeTransactionPaid,
  getPaymentGatewayStatus,
  verifyStripeWebhookSignature,
} from '@/modules/payments';

let tempDir: string;

async function fetchSessionUserByEmail(email: string): Promise<SessionUser> {
  const res = await dbQuery(
    `SELECT id, email, full_name, role, nationality, membership_tier, membership_expires_at,
            reward_credit_vnd, vat_tax_id, preferred_locale, preferred_currency, phone
     FROM users WHERE email = $1`,
    [email]
  );
  const u = res.rows[0]!;
  return {
    id: String(u.id),
    email: String(u.email),
    fullName: String(u.full_name),
    role: u.role as SessionUser['role'],
    nationality: String(u.nationality),
    membershipTier: u.membership_tier as SessionUser['membershipTier'],
    membershipExpiresAt: u.membership_expires_at ? String(u.membership_expires_at) : null,
    rewardCreditVnd: Number(u.reward_credit_vnd),
    vatTaxId: u.vat_tax_id ? String(u.vat_tax_id) : null,
    preferredLocale: u.preferred_locale === 'vi' ? 'vi' : 'en',
    preferredCurrency: 'VND',
    phone: u.phone ? String(u.phone) : null,
  };
}

beforeAll(async () => {
  tempDir = mkdtempSync(join(tmpdir(), 'vietnomad-pay-test-'));
  process.env.PGLITE_DATA_DIR = tempDir;
  process.env.VIETNOMAD_DATA_DIR = tempDir;
  process.env.DATABASE_URL = '';
  delete process.env.STRIPE_SECRET_KEY;
  delete process.env.VIETQR_BANK_BIN;
  delete process.env.VIETQR_ACCOUNT_NO;
  await closeDb();
  await ensureDbReady();
});

afterAll(async () => {
  await closeDb();
  rmSync(tempDir, { recursive: true, force: true });
});

describe('Payment Gateway Framework (VietQR + Stripe)', () => {
  it('reports sandbox status cleanly when live keys are omitted', () => {
    const status = getPaymentGatewayStatus();
    expect(status.stripeLive).toBe(false);
    expect(status.vietqrLive).toBe(false);
    expect(status.nomadPassPriceVnd).toBe(2_680_000);
  });

  it('creates VietQR sandbox checkout session and locks booking on confirmation', async () => {
    const member = await fetchSessionUserByEmail('nomad@vietnomad.demo');
    const stay = await getStayDetailBySlug('tay-ho-jade-residence-hanoi');
    const room = stay!.rooms[0];
    const pkg = room.packages[0];

    const booking = await createStayBooking(member, {
      stayId: stay!.id,
      roomId: room.id,
      packageId: pkg.id,
      checkIn: '2027-07-01',
      nights: 14,
      guestsCount: 1,
      checkoutMode: 'intent',
    });

    const tx = await createGatewayCheckoutSession(member, {
      purpose: 'booking_fee',
      provider: 'vietqr',
      bookingId: booking.bookingId,
    });

    expect(tx.provider).toBe('vietqr');
    expect(tx.mode).toBe('sandbox');
    expect(tx.amountVnd).toBe(booking.quote.feeOnlineVnd);
    expect(tx.qrImageUrl).toContain('/api/payments/sandbox-qr');

    const confirmed = await confirmSandboxTransaction(member, tx.id);
    expect(confirmed.alreadyPaid).toBe(false);
    expect(confirmed.bookingId).toBe(booking.bookingId);

    const bRes = await dbQuery<{ status: string; payment_provider: string }>(
      'SELECT status, payment_provider FROM bookings WHERE id = $1',
      [booking.bookingId]
    );
    expect(bRes.rows[0]?.status).toBe('RESERVED_LOCKED');
    expect(bRes.rows[0]?.payment_provider).toBe('vietqr');

    // Second finalize must be idempotent
    const replay = await finalizeTransactionPaid({ transactionId: tx.id });
    expect(replay.alreadyPaid).toBe(true);
  });

  it('activates Nomad Pass membership on Stripe webhook finalization', async () => {
    const member = await fetchSessionUserByEmail('nomad@vietnomad.demo');
    const tx = await createGatewayCheckoutSession(member, {
      purpose: 'membership_pass',
      provider: 'stripe',
      vatTaxId: 'VN0318889999',
    });

    expect(tx.provider).toBe('stripe');
    expect(tx.mode).toBe('sandbox');

    await finalizeTransactionPaid({
      referenceCode: tx.referenceCode,
      externalPaymentId: 'pi_test_live_123',
      paidAmountVnd: tx.amountVnd,
    });

    const userRes = await dbQuery<{ membership_tier: string; vat_tax_id: string | null }>(
      'SELECT membership_tier, vat_tax_id FROM users WHERE id = $1',
      [member.id]
    );
    expect(userRes.rows[0]?.membership_tier).toBe('premium');
    expect(userRes.rows[0]?.vat_tax_id).toBe('VN0318889999');
  });

  it('verifies Stripe webhook HMAC-SHA256 signatures strictly', () => {
    const secret = 'whsec_test_secret_123';
    const payload = JSON.stringify({ type: 'checkout.session.completed' });
    const ts = Math.floor(Date.now() / 1000);
    const sig = crypto
      .createHmac('sha256', secret)
      .update(`${ts}.${payload}`)
      .digest('hex');

    expect(verifyStripeWebhookSignature(payload, `t=${ts},v1=${sig}`, secret)).toBe(true);
    expect(verifyStripeWebhookSignature(payload, `t=${ts},v1=badhash`, secret)).toBe(false);
    expect(verifyStripeWebhookSignature(payload, `t=${ts - 600},v1=${sig}`, secret)).toBe(false);
  });
});
