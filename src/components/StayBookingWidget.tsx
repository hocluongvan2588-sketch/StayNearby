'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  Loader2,
  MessageCircle,
  Minus,
  Plus,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react';
import type { SessionUser } from '@/lib/auth/session';
import { addDaysIso, getTodayIsoVietnam } from '@/lib/dates';
import { formatMoneyFromVnd, formatVndExact } from '@/lib/i18n';
import { calculateStayQuote } from '@/lib/pricing';
import type { StayDetail } from '@/modules/catalog';
import { usePreferences } from './PreferencesProvider';

function buildClientWhatsappHref(
  whatsappDigits: string,
  stayName: string,
  checkIn: string,
  nights: number,
  isVi: boolean
) {
  const digits = whatsappDigits.replace(/\D/g, '') || '84901234567';
  const msg = isVi
    ? `Xin chào VietNomad Concierge, mình quan tâm căn "${stayName}" nhận phòng ${checkIn} (${nights} đêm). Nhờ bạn kiểm tra thêm thông tin Wi-Fi & nhận phòng giúp mình nhé.`
    : `Hi VietNomad Local Concierge, I'm interested in "${stayName}" checking in ${checkIn} for ${nights} nights. Could you help confirm Wi-Fi & check-in details?`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(msg)}`;
}

export function StayBookingWidget({
  stay,
  user,
  conciergeWhatsapp = '84901234567',
}: {
  stay: StayDetail;
  user: SessionUser | null;
  conciergeWhatsapp?: string;
}) {
  const { locale, currency } = usePreferences();
  const isVi = locale === 'vi';

  const defaultRoom = stay.rooms[0];
  const defaultPkg = defaultRoom?.packages[0];

  const [roomId, setRoomId] = useState(defaultRoom?.id ?? '');
  const [checkIn, setCheckIn] = useState(addDaysIso(getTodayIsoVietnam(), 7));
  const [baseTier, setBaseTier] = useState<7 | 14 | 21 | 30>(30);
  const [extraNights, setExtraNights] = useState(0);
  const [guestsCount, setGuestsCount] = useState(1);
  const [applyVatFree, setApplyVatFree] = useState(
    Boolean(user?.membershipTier === 'premium' && user?.vatTaxId)
  );
  const [useRewardCredit, setUseRewardCredit] = useState(
    Boolean((user?.rewardCreditVnd ?? 0) > 0)
  );
  const [guestNote, setGuestNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');
  const [pendingBooking, setPendingBooking] = useState<{
    bookingId: string;
    bookingCode: string;
    paymentIntentId: string | null;
    feeOnlineVnd: number;
    payAtCheckinVnd: number;
  } | null>(null);
  const [confirmed, setConfirmed] = useState<{
    bookingCode: string;
    status: string;
    directReferralUrl: string | null;
    feePaidOnlineVnd: number;
    payAtCheckinVnd: number;
  } | null>(null);

  const selectedRoom = stay.rooms.find((r) => r.id === roomId) ?? defaultRoom;
  const selectedPkg = selectedRoom?.packages[0] ?? defaultPkg;
  const totalNights = baseTier + extraNights;
  const checkOut = addDaysIso(checkIn, totalNights);

  const quote = useMemo(() => {
    if (!selectedPkg) return null;
    return calculateStayQuote({
      pkg: selectedPkg,
      nights: totalNights,
      businessModel: stay.businessModel,
      isPremiumMember: user?.membershipTier === 'premium',
      applyVatFree,
      vatTaxId: user?.vatTaxId,
      availableRewardCreditVnd: user?.rewardCreditVnd ?? 0,
      useRewardCredit,
    });
  }, [selectedPkg, totalNights, stay.businessModel, user, applyVatFree, useRewardCredit]);

  async function handleStartReservation() {
    if (!user) {
      window.location.assign(`/login?next=/stays/${stay.slug}`);
      return;
    }
    if (!selectedRoom || !selectedPkg) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stayId: stay.id,
          roomId: selectedRoom.id,
          packageId: selectedPkg.id,
          checkIn,
          nights: totalNights,
          guestsCount,
          applyVatFree,
          useRewardCredit,
          guestNote,
          checkoutMode: stay.businessModel === 'booking_flow' ? 'intent' : 'instant',
        }),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error?.message ?? 'Could not create booking.');
        return;
      }

      if (json.booking.businessModel === 'stay_direct') {
        setConfirmed({
          bookingCode: json.booking.bookingCode,
          status: json.booking.status,
          directReferralUrl: json.booking.directReferralUrl,
          feePaidOnlineVnd: 0,
          payAtCheckinVnd: json.booking.quote.payAtCheckinVnd,
        });
      } else {
        setPendingBooking({
          bookingId: json.booking.bookingId,
          bookingCode: json.booking.bookingCode,
          paymentIntentId: json.booking.paymentIntentId,
          feeOnlineVnd: json.booking.quote.feeOnlineVnd,
          payAtCheckinVnd: json.booking.quote.payAtCheckinVnd,
        });
      }
    } catch {
      setError('Network error. Please retry.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirmFeePayment() {
    if (!pendingBooking) return;
    setPaying(true);
    setError('');
    try {
      const res = await fetch(`/api/bookings/${pendingBooking.bookingId}/pay`, {
        method: 'POST',
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error?.message ?? 'Could not complete 12% reservation payment.');
        return;
      }
      setConfirmed({
        bookingCode: json.payment.bookingCode,
        status: json.payment.status,
        directReferralUrl: null,
        feePaidOnlineVnd: json.payment.feePaidOnlineVnd,
        payAtCheckinVnd: json.payment.payAtCheckinVnd,
      });
      setPendingBooking(null);
    } catch {
      setError('Payment confirmation failed.');
    } finally {
      setPaying(false);
    }
  }

  if (!selectedRoom || !selectedPkg || !quote) {
    return (
      <div className="rounded-3xl border border-[#E5DFD3] bg-white p-6 text-sm text-[#53635D]">
        {isVi ? 'Hiện chưa có gói phòng khả dụng.' : 'No live packages currently open.'}
      </div>
    );
  }

  const conciergeHref = buildClientWhatsappHref(
    conciergeWhatsapp,
    isVi ? stay.titleVi : stay.titleEn,
    checkIn,
    totalNights,
    isVi
  );

  return (
    <div className="sticky top-24 space-y-5 rounded-3xl border border-[#E5DFD3] bg-white p-5 sm:p-6 lacquer-shadow">
      <div className="flex items-start justify-between gap-3 border-b border-[#E5DFD3] pb-4">
        <div>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              stay.businessModel === 'booking_flow'
                ? 'bg-[#E7F1EC] text-[#164E3F]'
                : 'bg-[#FAEDE5] text-[#C25E28]'
            }`}
          >
            {stay.businessModel === 'booking_flow' ? (
              <>
                <Zap className="h-3.5 w-3.5" /> BookingFlow · 12% Reserve Fee
              </>
            ) : (
              <>
                <ExternalLink className="h-3.5 w-3.5" /> StayDirect™ · 0% Markup
              </>
            )}
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-serif-display text-3xl font-bold text-[#17221E]">
              {stay.businessModel === 'booking_flow'
                ? formatMoneyFromVnd(quote.feeOnlineVnd, currency)
                : formatMoneyFromVnd(quote.totalStayVnd, currency)}
            </span>
            <span className="text-xs font-medium text-[#164E3F]">
              {stay.businessModel === 'booking_flow'
                ? isVi
                  ? 'trả hôm nay (12%)'
                  : 'due today (12%)'
                : `/ ${totalNights} ${isVi ? 'đêm' : 'nights'}`}
            </span>
          </div>
          <div className="text-xs text-[#53635D]">
            {stay.businessModel === 'booking_flow'
              ? isVi
                ? `+ ${formatMoneyFromVnd(quote.payAtCheckinVnd, currency)} trả chủ nhà khi nhận phòng · Tổng ${formatMoneyFromVnd(quote.totalStayVnd, currency)}`
                : `+ ${formatMoneyFromVnd(quote.payAtCheckinVnd, currency)} due at check-in · Total ${formatMoneyFromVnd(quote.totalStayVnd, currency)}`
              : `≈ ${formatMoneyFromVnd(quote.perNightDisplayVnd, currency)}/${isVi ? 'đêm' : 'night'} · ${formatVndExact(quote.totalStayVnd)}`}
          </div>
        </div>

        {quote.weeklySavingsPct > 0 && (
          <span className="rounded-xl bg-[#164E3F] px-2.5 py-1 text-center text-xs font-bold text-white">
            {isVi ? `Giảm ${quote.weeklySavingsPct}%` : `Save ${quote.weeklySavingsPct}%`}
          </span>
        )}
      </div>

      {/* Room Selection */}
      {stay.rooms.length > 1 && (
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[#53635D]">
            {isVi ? 'Chọn loại phòng' : 'Room Type'}
          </label>
          <select
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            className="min-h-[42px] w-full rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2 text-sm font-medium"
          >
            {stay.rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {isVi ? r.nameVi : r.nameEn} (max {r.maxGuests})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* NomadStays Fixed Tier Package Pills: 7 / 14 / 21 / 30 nights */}
      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#53635D]">
          {isVi ? 'Chọn gói chuẩn Nomad (7 / 14 / 21 / 30 đêm)' : 'Select Base Package (7 / 14 / 21 / 30 nights)'}
        </label>
        <div className="grid grid-cols-4 gap-1.5">
          {([7, 14, 21, 30] as const).map((tier) => {
            const tierQ = calculateStayQuote({
              pkg: selectedPkg,
              nights: tier,
              businessModel: stay.businessModel,
            });
            return (
              <button
                key={tier}
                type="button"
                onClick={() => setBaseTier(tier)}
                className={`min-h-[48px] rounded-xl border px-2 py-2 text-center transition ${
                  baseTier === tier
                    ? 'border-[#164E3F] bg-[#164E3F] text-white'
                    : 'border-[#E5DFD3] bg-[#FAF8F3] text-[#17221E] hover:border-[#164E3F]/50'
                }`}
              >
                <div className="text-xs font-bold">
                  {tier === 30 ? (isVi ? '1 tháng' : '1 mo') : `${tier}N`}
                </div>
                <div className={`text-[10px] ${baseTier === tier ? 'text-[#CDE0D9]' : 'text-[#53635D]'}`}>
                  {formatMoneyFromVnd(tierQ.totalStayVnd, currency)}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Add Extra Nights + Check-in Date */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[#53635D]">
            {isVi ? 'Nhận phòng' : 'Check-in'}
          </label>
          <input
            type="date"
            min={getTodayIsoVietnam()}
            value={checkIn}
            onChange={(e) => setCheckIn(e.target.value)}
            className="min-h-[42px] w-full rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2 text-xs font-semibold"
          />
          <div className="mt-1 text-[11px] text-[#53635D]">
            {isVi ? 'Trả phòng:' : 'Out:'} {checkOut}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[#53635D]">
            {isVi ? 'Thêm đêm lẻ' : 'Extra Nights'}
          </label>
          <div className="flex min-h-[42px] items-center justify-between rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-2 py-1.5">
            <button
              type="button"
              onClick={() => setExtraNights((n) => Math.max(0, n - 1))}
              className="rounded-lg p-1.5 hover:bg-white"
              aria-label="Decrease extra nights"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="text-sm font-bold">+{extraNights}</span>
            <button
              type="button"
              onClick={() => setExtraNights((n) => Math.min(60, n + 1))}
              className="rounded-lg p-1.5 hover:bg-white"
              aria-label="Increase extra nights"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="mt-1 text-[11px] text-[#53635D]">
            {isVi ? `Tổng ${totalNights} đêm` : `${totalNights} nights total`}
          </div>
        </div>
      </div>

      {/* Guests & Notes */}
      <div className="grid grid-cols-3 gap-2">
        <label className="col-span-1">
          <span className="mb-1 block text-xs font-semibold text-[#53635D]">
            {isVi ? 'Số khách' : 'Guests'}
          </span>
          <select
            value={guestsCount}
            onChange={(e) => setGuestsCount(Number(e.target.value))}
            className="min-h-[42px] w-full rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-2.5 py-2 text-xs font-semibold"
          >
            {Array.from({ length: selectedRoom.maxGuests }, (_, i) => i + 1).map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </label>
        <label className="col-span-2">
          <span className="mb-1 block text-xs font-semibold text-[#53635D]">
            {isVi ? 'Ghi chú nhận phòng' : 'Arrival Note'}
          </span>
          <input
            type="text"
            value={guestNote}
            onChange={(e) => setGuestNote(e.target.value)}
            placeholder={isVi ? 'Ví dụ: Bay chiều...' : 'Flight time, desk needs...'}
            className="min-h-[42px] w-full rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2 text-xs"
          />
        </label>
      </div>

      {/* Premium Perks Toggles (if logged in & BookingFlow) */}
      {stay.businessModel === 'booking_flow' && user && (user.vatTaxId || user.rewardCreditVnd > 0) && (
        <div className="space-y-2 rounded-2xl border border-[#E5DFD3] bg-[#FAF8F3] p-3 text-xs">
          {user.membershipTier === 'premium' && user.vatTaxId && (
            <label className="flex cursor-pointer items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 font-medium text-[#164E3F]">
                <Sparkles className="h-3.5 w-3.5 text-[#A67C2E]" />
                {isVi ? `Miễn VAT doanh nghiệp (${user.vatTaxId})` : `VAT-Free Business Booking (${user.vatTaxId})`}
              </span>
              <input
                type="checkbox"
                checked={applyVatFree}
                onChange={(e) => setApplyVatFree(e.target.checked)}
                className="accent-[#164E3F]"
              />
            </label>
          )}
          {user.rewardCreditVnd > 0 && (
            <label className="flex cursor-pointer items-center justify-between gap-2">
              <span className="font-medium text-[#17221E]">
                {isVi
                  ? `Dùng Reward Credit (${formatMoneyFromVnd(user.rewardCreditVnd, currency)})`
                  : `Apply Reward Credit (${formatMoneyFromVnd(user.rewardCreditVnd, currency)})`}
              </span>
              <input
                type="checkbox"
                checked={useRewardCredit}
                onChange={(e) => setUseRewardCredit(e.target.checked)}
                className="accent-[#164E3F]"
              />
            </label>
          )}
        </div>
      )}

      {/* PRD Booking Summary: Split 12% Due Today vs Due at Check-in vs Total All-Inclusive Stay */}
      <div className="space-y-2 rounded-2xl border border-[#164E3F]/20 bg-[#FAF8F3] p-4 text-xs">
        <div className="flex items-center justify-between font-semibold text-[#164E3F]">
          <span>
            {stay.businessModel === 'booking_flow'
              ? isVi
                ? 'Thanh toán hôm nay (Phí Đặt chỗ & Xác minh 12%)'
                : 'Due Today (12% Booking & Verification Fee)'
              : isVi
                ? 'Thanh toán online hôm nay'
                : 'Due Online Today'}
          </span>
          <span className="text-sm font-bold text-[#164E3F]">
            {formatMoneyFromVnd(quote.feeOnlineVnd, currency)}
          </span>
        </div>

        <div className="flex items-center justify-between text-[#17221E]">
          <span>
            {isVi
              ? 'Thanh toán khi nhận phòng (Trả trực tiếp cho Chủ nhà)'
              : 'Due at Check-in (Pay directly to Host)'}
          </span>
          <span className="font-semibold">
            {formatMoneyFromVnd(quote.payAtCheckinVnd, currency)}
          </span>
        </div>

        {quote.vatDiscountVnd > 0 && (
          <div className="flex justify-between font-medium text-[#164E3F]">
            <span>{isVi ? 'Ưu đãi miễn VAT Premium' : 'Premium VAT-Free Savings'}</span>
            <span>-{formatMoneyFromVnd(quote.vatDiscountVnd, currency)}</span>
          </div>
        )}

        {quote.rewardCreditUsedVnd > 0 && (
          <div className="flex justify-between font-medium text-[#C25E28]">
            <span>{isVi ? 'Trừ Reward Credit vào phí giữ chỗ' : 'Reward Credit Applied'}</span>
            <span>-{formatMoneyFromVnd(quote.rewardCreditUsedVnd, currency)}</span>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-[#E5DFD3] pt-2 text-sm font-bold text-[#17221E]">
          <span>{isVi ? 'Tổng giá trị kỳ lưu trú (Trọn gói)' : 'Total All-Inclusive Stay'}</span>
          <span>{formatMoneyFromVnd(quote.totalStayVnd, currency)}</span>
        </div>

        {quote.rewardCreditEarnedVnd > 0 && (
          <div className="text-[11px] font-semibold text-[#A67C2E]">
            + {formatMoneyFromVnd(quote.rewardCreditEarnedVnd, currency)}{' '}
            {isVi ? 'tích lũy 4% Reward Credit sau xác nhận' : 'earned in 4% Nomad Pass Reward Credit'}
          </div>
        )}
      </div>

      {/* 100% Booking Fee Refund Guarantee Badge */}
      <div className="flex items-start gap-2.5 rounded-xl border border-[#164E3F]/25 bg-[#E7F1EC]/75 p-3 text-[11px] text-[#17221E]">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#164E3F]" />
        <div>
          <div className="font-bold text-[#164E3F]">
            {isVi ? 'Cam kết Hoàn 100% Phí Giữ Chỗ (Wi-Fi Guarantee)' : '100% Booking Fee Refund Guarantee'}
          </div>
          <p className="mt-0.5 text-[#53635D]">
            {isVi
              ? `Nếu tốc độ Wi-Fi hoặc bàn làm việc khi check-in không đúng chứng nhận, bạn được hoàn 100% phí ${formatMoneyFromVnd(quote.feeOnlineVnd, currency)} ngay lập tức. Chính sách hủy ${stay.cancellationPolicy.toUpperCase()} áp dụng trên phần phí giữ chỗ.`
              : `Full 100% refund of your ${formatMoneyFromVnd(quote.feeOnlineVnd, currency)} booking fee if Wi-Fi speed or workspace at check-in does not match the verified certificate. ${stay.cancellationPolicy.toUpperCase()} policy applies.`}
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl bg-[#FAEDE5] p-3 text-xs font-medium text-[#C25E28]">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Checkout Step 2: Payment Gateway Authorization for 12% Fee */}
      {pendingBooking && (
        <div className="space-y-3 rounded-2xl border-2 border-[#164E3F] bg-[#FAF8F3] p-4 text-xs">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 font-bold text-[#164E3F]">
              <CreditCard className="h-4 w-4" />
              {isVi ? 'Cổng thanh toán Phí giữ chỗ 12%' : 'Checkout Authorization (12% Fee)'}
            </span>
            <span className="font-mono text-[10px] text-[#53635D]">{pendingBooking.bookingCode}</span>
          </div>
          <p className="text-[#53635D]">
            {isVi
              ? `Bạn chỉ thanh toán ${formatMoneyFromVnd(pendingBooking.feeOnlineVnd, currency)} ngay bây giờ để khóa phòng và mở địa chỉ chi tiết. Phần ${formatMoneyFromVnd(pendingBooking.payAtCheckinVnd, currency)} sẽ trả trực tiếp cho chủ nhà khi nhận phòng.`
              : `You are authorizing ${formatMoneyFromVnd(pendingBooking.feeOnlineVnd, currency)} online right now to lock dates and unlock exact address. Pay ${formatMoneyFromVnd(pendingBooking.payAtCheckinVnd, currency)} directly to host upon check-in.`}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleConfirmFeePayment}
              disabled={paying}
              className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-[#C25E28] px-4 py-2.5 text-xs font-bold text-white shadow hover:bg-[#ad5020] disabled:opacity-60"
            >
              {paying && <Loader2 className="h-4 w-4 animate-spin" />}
              {isVi
                ? `Thanh toán ${formatMoneyFromVnd(pendingBooking.feeOnlineVnd, currency)} & Khóa lịch`
                : `Confirm & Pay ${formatMoneyFromVnd(pendingBooking.feeOnlineVnd, currency)}`}
            </button>
          </div>
        </div>
      )}

      {confirmed ? (
        <div className="space-y-3 rounded-2xl border border-[#164E3F]/30 bg-[#E7F1EC] p-4 text-xs text-[#17221E]">
          <div className="flex items-center gap-2 font-bold text-[#164E3F]">
            <CheckCircle2 className="h-4 w-4" />
            {confirmed.status === 'RESERVED_LOCKED'
              ? isVi
                ? `Đã khóa phòng (RESERVED_LOCKED) · ${confirmed.bookingCode}`
                : `Dates Locked & Confirmed · ${confirmed.bookingCode}`
              : isVi
                ? `Đã chuyển tiếp StayDirect™ (${confirmed.bookingCode})`
                : `StayDirect™ Referral Logged (${confirmed.bookingCode})`}
          </div>
          {confirmed.status === 'RESERVED_LOCKED' && (
            <p className="text-[#53635D]">
              {isVi
                ? `Đã thu ${formatMoneyFromVnd(confirmed.feePaidOnlineVnd, currency)} · Còn ${formatMoneyFromVnd(confirmed.payAtCheckinVnd, currency)} trả chủ nhà khi check-in. Chứng nhận Wi-Fi & cảnh báo Zalo/Email cho Chủ nhà & Ops đã được kích hoạt.`
                : `Paid ${formatMoneyFromVnd(confirmed.feePaidOnlineVnd, currency)} online · ${formatMoneyFromVnd(confirmed.payAtCheckinVnd, currency)} due to host at check-in. Wi-Fi Certificate & Host/Ops alerts dispatched.`}
            </p>
          )}
          {confirmed.directReferralUrl && (
            <p className="text-[#53635D]">
              {isVi ? 'Link đặt phòng trực tiếp của chủ nhà:' : 'Host direct checkout link:'}{' '}
              <span className="break-all font-semibold text-[#164E3F]">{confirmed.directReferralUrl}</span>
            </p>
          )}
          <Link
            href="/dashboard"
            className="inline-flex min-h-[40px] items-center rounded-lg bg-[#164E3F] px-3.5 py-2 font-semibold text-white"
          >
            {isVi ? 'Mở Dashboard & Chứng nhận Wi-Fi →' : 'View Certificate & Unlock Address →'}
          </Link>
        </div>
      ) : (
        !pendingBooking && (
          <button
            type="button"
            onClick={handleStartReservation}
            disabled={submitting}
            className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[#164E3F] px-5 py-3.5 text-sm font-semibold text-white shadow transition hover:bg-[#0F392E] disabled:opacity-60"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {!user
              ? isVi
                ? 'Đăng nhập để giữ phòng (12% Online)'
                : 'Log In to Lock Stay (12% Fee)'
              : stay.businessModel === 'booking_flow'
                ? isVi
                  ? `Đặt giữ chỗ ngay (${formatMoneyFromVnd(quote.feeOnlineVnd, currency)})`
                  : `Reserve Now — Pay ${formatMoneyFromVnd(quote.feeOnlineVnd, currency)} Today`
                : isVi
                  ? 'Đặt trực tiếp qua StayDirect™ (0% Markup)'
                  : 'Proceed to Host Booking via StayDirect™'}
          </button>
        )
      )}

      {/* Quick Concierge WhatsApp CTA */}
      <a
        href={conciergeHref}
        target="_blank"
        rel="noopener noreferrer"
        className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-[#164E3F]/25 bg-[#FAF8F3] px-4 py-2.5 text-xs font-semibold text-[#164E3F] transition hover:bg-[#E7F1EC]"
      >
        <MessageCircle className="h-4 w-4 text-[#25D366]" />
        {isVi ? 'Chat trực tiếp Concierge (WhatsApp)' : 'Chat with Local Concierge (WhatsApp)'}
      </a>
    </div>
  );
}
