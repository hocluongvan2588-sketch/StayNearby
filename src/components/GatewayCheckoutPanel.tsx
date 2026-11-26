'use client';

import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Copy,
  CreditCard,
  ExternalLink,
  Loader2,
  QrCode,
  RefreshCw,
} from 'lucide-react';
import { formatMoneyFromVnd, formatVndExact } from '@/lib/i18n';
import type { GatewayTransactionDTO, PaymentProvider, PaymentPurpose } from '@/lib/payment-types';
import { usePreferences } from './PreferencesProvider';

interface GatewayCheckoutPanelProps {
  purpose: PaymentPurpose;
  amountVnd: number;
  bookingId?: string;
  vatTaxId?: string;
  title: string;
  subtitle: string;
  onPaid: (info: { bookingId?: string | null; referenceCode?: string }) => void;
}

export function GatewayCheckoutPanel({
  purpose,
  amountVnd,
  bookingId,
  vatTaxId,
  title,
  subtitle,
  onPaid,
}: GatewayCheckoutPanelProps) {
  const { locale, currency } = usePreferences();
  const isVi = locale === 'vi';

  const [provider, setProvider] = useState<PaymentProvider>('vietqr');
  const [creating, setCreating] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [tx, setTx] = useState<GatewayTransactionDTO | null>(null);

  useEffect(() => {
    if (!tx || tx.mode !== 'live' || tx.status === 'paid') return;
    const timer = window.setInterval(async () => {
      try {
        const res = await fetch(`/api/payments/status?transactionId=${tx.id}`);
        const json = await res.json();
        if (json.ok && json.transaction?.status === 'paid') {
          window.clearInterval(timer);
          onPaid({
            bookingId: json.transaction.bookingId,
            referenceCode: json.transaction.referenceCode,
          });
        }
      } catch {
        // retry on next interval
      }
    }, 3000);

    return () => window.clearInterval(timer);
  }, [onPaid, tx]);

  async function handleStartSession() {
    setCreating(true);
    setError('');
    try {
      const res = await fetch('/api/payments/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purpose,
          provider,
          bookingId,
          vatTaxId,
        }),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(
          json.error?.message ??
            (isVi ? 'Không thể khởi tạo phiên thanh toán.' : 'Could not start checkout session.')
        );
        return;
      }
      const created = json.transaction as GatewayTransactionDTO;
      setTx(created);
      if (created.provider === 'stripe' && created.mode === 'live' && created.checkoutUrl) {
        window.location.assign(created.checkoutUrl);
      }
    } finally {
      setCreating(false);
    }
  }

  async function handleConfirmSandbox() {
    if (!tx) return;
    setConfirming(true);
    setError('');
    try {
      const res = await fetch('/api/payments/confirm-sandbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId: tx.id }),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(
          json.error?.message ??
            (isVi ? 'Không thể xác nhận thanh toán.' : 'Payment confirmation failed.')
        );
        return;
      }
      onPaid({
        bookingId: json.payment?.bookingId ?? bookingId,
        referenceCode: tx.referenceCode,
      });
    } finally {
      setConfirming(false);
    }
  }

  async function handleCheckNow() {
    if (!tx) return;
    const res = await fetch(`/api/payments/status?transactionId=${tx.id}`);
    const json = await res.json();
    if (json.ok && json.transaction?.status === 'paid') {
      onPaid({
        bookingId: json.transaction.bookingId,
        referenceCode: json.transaction.referenceCode,
      });
    } else {
      setError(
        isVi
          ? 'Hệ thống chưa ghi nhận tiền về, vui lòng chờ vài giây sau khi chuyển khoản.'
          : 'Transfer not detected yet. Please check again in a few seconds.'
      );
    }
  }

  function handleCopyRef() {
    if (!tx) return;
    navigator.clipboard?.writeText(tx.referenceCode).catch(() => {});
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="space-y-3 rounded-2xl border-2 border-[#164E3F] bg-[#FAF8F3] p-4 text-xs">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-bold text-[#164E3F]">{title}</div>
          <p className="mt-0.5 text-[#53635D]">{subtitle}</p>
        </div>
        <span className="shrink-0 rounded-full bg-[#E7F1EC] px-2.5 py-0.5 font-bold text-[#164E3F]">
          {formatMoneyFromVnd(amountVnd, currency)}
        </span>
      </div>

      {!tx ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setProvider('vietqr')}
              className={`flex flex-col items-start gap-1 rounded-xl border p-2.5 text-left transition ${
                provider === 'vietqr'
                  ? 'border-[#164E3F] bg-[#E7F1EC] text-[#164E3F]'
                  : 'border-[#E5DFD3] bg-white text-[#17221E] hover:border-[#164E3F]/40'
              }`}
            >
              <span className="inline-flex items-center gap-1.5 font-bold">
                <QrCode className="h-4 w-4" />
                VietQR
              </span>
              <span className="text-[10px] text-[#53635D]">
                {isVi ? 'Chuyển khoản QR 24/7' : 'Bank QR transfer'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setProvider('stripe')}
              className={`flex flex-col items-start gap-1 rounded-xl border p-2.5 text-left transition ${
                provider === 'stripe'
                  ? 'border-[#164E3F] bg-[#E7F1EC] text-[#164E3F]'
                  : 'border-[#E5DFD3] bg-white text-[#17221E] hover:border-[#164E3F]/40'
              }`}
            >
              <span className="inline-flex items-center gap-1.5 font-bold">
                <CreditCard className="h-4 w-4" />
                Stripe
              </span>
              <span className="text-[10px] text-[#53635D]">
                {isVi ? 'Visa, Mastercard, Apple Pay' : 'Card & Apple Pay'}
              </span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleStartSession}
            disabled={creating}
            className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[#C25E28] px-4 py-2.5 text-xs font-bold text-white shadow hover:bg-[#ad5020] disabled:opacity-60"
          >
            {creating && <Loader2 className="h-4 w-4 animate-spin" />}
            {provider === 'vietqr'
              ? isVi
                ? `Tạo mã VietQR (${formatVndExact(amountVnd)})`
                : `Generate VietQR (${formatMoneyFromVnd(amountVnd, currency)})`
              : isVi
                ? `Thanh toán thẻ qua Stripe (${formatMoneyFromVnd(amountVnd, currency)})`
                : `Pay with Stripe (${formatMoneyFromVnd(amountVnd, currency)})`}
          </button>
        </>
      ) : (
        <div className="space-y-3 rounded-xl border border-[#E5DFD3] bg-white p-3.5">
          <div className="flex items-center justify-between gap-2">
            <span className="font-bold text-[#17221E]">
              {tx.provider === 'vietqr'
                ? isVi
                  ? 'Quét mã VietQR để thanh toán'
                  : 'Scan VietQR to complete payment'
                : isVi
                  ? 'Thanh toán thẻ qua Stripe'
                  : 'Stripe Card Checkout'}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                tx.mode === 'live'
                  ? 'bg-[#E7F1EC] text-[#164E3F]'
                  : 'bg-[#FAEDE5] text-[#C25E28]'
              }`}
            >
              {tx.mode === 'live' ? 'LIVE' : 'SANDBOX'}
            </span>
          </div>

          {tx.provider === 'vietqr' && (
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
              {tx.qrImageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={tx.qrImageUrl}
                  alt="VietQR payment code"
                  className="h-44 w-38 shrink-0 rounded-xl border border-[#E5DFD3] bg-white object-contain p-1"
                />
              )}
              <div className="w-full space-y-2 text-xs">
                <div>
                  <span className="text-[#53635D]">{isVi ? 'Số tiền:' : 'Amount:'}</span>{' '}
                  <strong className="text-[#164E3F]">{formatVndExact(tx.amountVnd)}</strong>
                </div>
                {tx.bankDetails && (
                  <>
                    <div>
                      <span className="text-[#53635D]">{isVi ? 'Tài khoản:' : 'Account:'}</span>{' '}
                      <strong>{tx.bankDetails.accountNo}</strong>
                    </div>
                    <div>
                      <span className="text-[#53635D]">{isVi ? 'Chủ TK:' : 'Name:'}</span>{' '}
                      <strong>{tx.bankDetails.accountName}</strong>
                    </div>
                  </>
                )}
                <div className="flex items-center justify-between gap-2 rounded-lg bg-[#FAF8F3] px-2.5 py-2">
                  <div>
                    <div className="text-[10px] text-[#53635D]">
                      {isVi ? 'Nội dung chuyển khoản' : 'Transfer memo'}
                    </div>
                    <div className="font-mono font-bold text-[#17221E]">{tx.referenceCode}</div>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyRef}
                    className="inline-flex items-center gap-1 rounded-md border border-[#E5DFD3] bg-white px-2 py-1 text-[10px] font-semibold text-[#164E3F] hover:bg-[#E7F1EC]"
                  >
                    {copied ? <CheckCircle2 className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    {copied ? (isVi ? 'Đã chép' : 'Copied') : isVi ? 'Sao chép' : 'Copy'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {tx.provider === 'stripe' && tx.mode === 'live' && tx.checkoutUrl && (
            <a
              href={tx.checkoutUrl}
              className="flex min-h-[42px] w-full items-center justify-center gap-2 rounded-xl bg-[#164E3F] px-4 py-2 font-bold text-white"
            >
              <ExternalLink className="h-4 w-4" />
              {isVi ? 'Chuyển tới cổng thanh toán Stripe' : 'Continue to Stripe Checkout'}
            </a>
          )}

          {tx.mode === 'sandbox' ? (
            <div className="space-y-2 border-t border-[#E5DFD3] pt-2.5">
              <p className="text-[11px] text-[#53635D]">
                {isVi
                  ? 'Hệ thống đang ở chế độ Sandbox chờ cấu hình key thật. Bạn có thể bấm nút bên dưới để mô phỏng giao dịch thành công.'
                  : 'Gateway keys are not configured yet (Sandbox mode). Confirm below to simulate a successful payment.'}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleConfirmSandbox}
                  disabled={confirming}
                  className="flex min-h-[40px] flex-1 items-center justify-center gap-2 rounded-xl bg-[#164E3F] px-3 py-2 text-xs font-bold text-white hover:bg-[#0F392E] disabled:opacity-60"
                >
                  {confirming && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {isVi ? 'Xác nhận thanh toán (Sandbox)' : 'Confirm payment (Sandbox)'}
                </button>
                <button
                  type="button"
                  onClick={() => setTx(null)}
                  className="rounded-xl border border-[#E5DFD3] px-3 py-2 text-xs font-semibold text-[#53635D] hover:bg-[#FAF8F3]"
                >
                  {isVi ? 'Đổi cổng' : 'Back'}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2 border-t border-[#E5DFD3] pt-2.5 text-[11px] text-[#53635D]">
              <span className="inline-flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-[#164E3F]" />
                {isVi ? 'Đang chờ xác nhận tự động từ cổng thanh toán...' : 'Waiting for automatic confirmation...'}
              </span>
              <button
                type="button"
                onClick={handleCheckNow}
                className="inline-flex items-center gap-1 rounded-lg border border-[#E5DFD3] px-2.5 py-1 font-semibold text-[#164E3F] hover:bg-[#FAF8F3]"
              >
                <RefreshCw className="h-3 w-3" />
                {isVi ? 'Kiểm tra' : 'Check'}
              </button>
            </div>
          )}
        </div>
      )}

      {error && <div className="text-[11px] font-medium text-[#C25E28]">{error}</div>}
    </div>
  );
}
