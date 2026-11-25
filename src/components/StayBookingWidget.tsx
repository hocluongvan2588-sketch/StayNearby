'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Loader2,
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

export function StayBookingWidget({
  stay,
  user,
}: {
  stay: StayDetail;
  user: SessionUser | null;
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
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<{
    bookingCode: string;
    status: string;
    directReferralUrl: string | null;
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

  async function handleBook() {
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
        }),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error?.message ?? 'Could not complete booking.');
      } else {
        setSuccess({
          bookingCode: json.booking.bookingCode,
          status: json.booking.status,
          directReferralUrl: json.booking.directReferralUrl,
        });
      }
    } catch {
      setError('Network error. Please retry.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!selectedRoom || !selectedPkg || !quote) {
    return (
      <div className="rounded-3xl border border-[#E5DFD3] bg-white p-6 text-sm text-[#53635D]">
        {isVi ? 'Hiện chưa có gói phòng khả dụng.' : 'No live packages currently open.'}
      </div>
    );
  }

  return (
    <div className="sticky top-24 space-y-5 rounded-3xl border border-[#E5DFD3] bg-white p-6 lacquer-shadow">
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
                <Zap className="h-3.5 w-3.5" /> BookingFlow · Instant Book
              </>
            ) : (
              <>
                <ExternalLink className="h-3.5 w-3.5" /> StayDirect™ · 0% Markup
              </>
            )}
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-serif-display text-3xl font-bold text-[#17221E]">
              {formatMoneyFromVnd(quote.guestTotalVnd, currency)}
            </span>
            <span className="text-xs text-[#53635D]">
              / {totalNights} {isVi ? 'đêm' : 'nights'}
            </span>
          </div>
          <div className="text-xs text-[#53635D]">
            ≈ {formatMoneyFromVnd(quote.perNightDisplayVnd, currency)}/{isVi ? 'đêm' : 'night'} ·{' '}
            {formatVndExact(quote.guestTotalVnd)}
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
            className="w-full rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2 text-sm font-medium"
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
                className={`rounded-xl border px-2 py-2 text-center transition ${
                  baseTier === tier
                    ? 'border-[#164E3F] bg-[#164E3F] text-white'
                    : 'border-[#E5DFD3] bg-[#FAF8F3] text-[#17221E] hover:border-[#164E3F]/50'
                }`}
              >
                <div className="text-xs font-bold">
                  {tier === 30 ? (isVi ? '1 tháng' : '1 mo') : `${tier}N`}
                </div>
                <div className={`text-[10px] ${baseTier === tier ? 'text-[#CDE0D9]' : 'text-[#53635D]'}`}>
                  {formatMoneyFromVnd(tierQ.guestTotalVnd, currency)}
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
            className="w-full rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2 text-xs font-semibold"
          />
          <div className="mt-1 text-[11px] text-[#53635D]">
            {isVi ? 'Trả phòng:' : 'Out:'} {checkOut}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[#53635D]">
            {isVi ? 'Thêm đêm lẻ' : 'Extra Nights'}
          </label>
          <div className="flex items-center justify-between rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-2 py-1.5">
            <button
              type="button"
              onClick={() => setExtraNights((n) => Math.max(0, n - 1))}
              className="rounded-lg p-1 hover:bg-white"
              aria-label="Decrease extra nights"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="text-sm font-bold">+{extraNights}</span>
            <button
              type="button"
              onClick={() => setExtraNights((n) => Math.min(60, n + 1))}
              className="rounded-lg p-1 hover:bg-white"
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
            className="w-full rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-2.5 py-2 text-xs font-semibold"
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
            className="w-full rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2 text-xs"
          />
        </label>
      </div>

      {/* Premium Perks Toggles (if logged in & BookingFlow) */}
      {stay.businessModel === 'booking_flow' && user && (
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

      {/* Upfront Transparent Fee Breakdown */}
      <div className="space-y-1.5 border-t border-[#E5DFD3] pt-3 text-xs">
        <div className="flex justify-between text-[#53635D]">
          <span>
            {stay.businessModel === 'booking_flow'
              ? isVi
                ? 'Giá gốc trả Chủ nhà (0% hoa hồng)'
                : 'Host Wholesale Package (0% host commission)'
              : isVi
                ? 'Giá bán lẻ trực tiếp từ Chủ nhà'
                : 'Direct Host Retail Package'}
          </span>
          <span className="font-medium text-[#17221E]">
            {formatMoneyFromVnd(quote.wholesaleTotalVnd, currency)}
          </span>
        </div>

        <div className="flex justify-between text-[#53635D]">
          <span>
            {stay.businessModel === 'booking_flow'
              ? isVi
                ? 'Phí dịch vụ & hỗ trợ Nomad (12%)'
                : 'Nomad Booking Service Fee & Taxes (12%)'
              : 'StayDirect™ Traveler Markup'}
          </span>
          <span className="font-medium text-[#17221E]">
            {quote.serviceFeeVnd > 0 ? formatMoneyFromVnd(quote.serviceFeeVnd, currency) : '$0'}
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
            <span>{isVi ? 'Trừ Reward Credit' : 'Reward Credit Applied'}</span>
            <span>-{formatMoneyFromVnd(quote.rewardCreditUsedVnd, currency)}</span>
          </div>
        )}

        <div className="flex justify-between border-t border-[#E5DFD3] pt-2 text-sm font-bold text-[#17221E]">
          <span>{isVi ? 'Tổng thanh toán trọn gói' : 'All-Inclusive Total'}</span>
          <span>{formatMoneyFromVnd(quote.guestTotalVnd, currency)}</span>
        </div>

        {quote.rewardCreditEarnedVnd > 0 && (
          <div className="text-[11px] font-semibold text-[#A67C2E]">
            + {formatMoneyFromVnd(quote.rewardCreditEarnedVnd, currency)}{' '}
            {isVi ? 'tích lũy 4% Reward Credit sau đặt phòng' : 'earned in 4% Nomad Pass Reward Credit'}
          </div>
        )}
      </div>

      {/* Policy Badge */}
      <div className="flex items-start gap-2 rounded-xl bg-[#FAF8F3] p-3 text-[11px] text-[#53635D]">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#164E3F]" />
        <span>
          {isVi
            ? `Chính sách hủy ${stay.cancellationPolicy.toUpperCase()}: Hoàn tiền 100% trong 48h đầu (Cooling-off) hoặc hoàn 100% Credit khi báo trước đủ hạn.`
            : `NomadStays ${stay.cancellationPolicy.toUpperCase()} Policy: 100% cash refund within 48h cooling-off period; 100% account credit with adequate notice.`}
        </span>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl bg-[#FAEDE5] p-3 text-xs font-medium text-[#C25E28]">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success ? (
        <div className="space-y-3 rounded-2xl border border-[#164E3F]/30 bg-[#E7F1EC] p-4 text-xs text-[#17221E]">
          <div className="flex items-center gap-2 font-bold text-[#164E3F]">
            <CheckCircle2 className="h-4 w-4" />
            {success.status === 'confirmed'
              ? isVi
                ? `Đã xác nhận tức thì! Mã ${success.bookingCode}`
                : `Instant Booking Confirmed! Code ${success.bookingCode}`
              : isVi
                ? `Đã chuyển tiếp StayDirect™ (${success.bookingCode})`
                : `StayDirect™ Referral Logged (${success.bookingCode})`}
          </div>
          {success.directReferralUrl && (
            <p className="text-[#53635D]">
              {isVi ? 'Link đặt phòng trực tiếp của chủ nhà:' : 'Host direct checkout link:'}{' '}
              <span className="font-semibold text-[#164E3F] break-all">{success.directReferralUrl}</span>
            </p>
          )}
          <Link
            href="/dashboard"
            className="inline-block rounded-lg bg-[#164E3F] px-3.5 py-2 font-semibold text-white"
          >
            {isVi ? 'Mở Dashboard & Địa chỉ nhận phòng →' : 'View Trip & Unlock Address →'}
          </Link>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleBook}
          disabled={submitting}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#164E3F] px-5 py-3.5 text-sm font-semibold text-white shadow transition hover:bg-[#0F392E] disabled:opacity-60"
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {!user
            ? isVi
              ? 'Đăng nhập để đặt phòng tức thì'
              : 'Log In to Book Instantly'
            : stay.businessModel === 'booking_flow'
              ? isVi
                ? 'Xác nhận đặt phòng ngay (Instant Book)'
                : 'Book Instantly — No Request Wait'
              : isVi
                ? 'Đặt trực tiếp qua StayDirect™ (0% Markup)'
                : 'Proceed to Host Booking via StayDirect™'}
        </button>
      )}
    </div>
  );
}
