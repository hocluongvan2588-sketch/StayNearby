'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  MessageCircle,
  Minus,
  Plus,
  ShieldCheck,
  Sparkles,
  Tag,
  X,
  Zap,
} from 'lucide-react';
import { captureClientAttribution, trackClientEvent } from '@/lib/attribution';
import type { SessionUser } from '@/lib/auth/session';
import { addDaysIso, enumerateStayNights, getTodayIsoVietnam } from '@/lib/dates';
import { formatCancellationPolicyLabel } from '@/lib/i18n';
import { calculateStayQuote, type PromotionAdjustmentInput } from '@/lib/pricing';
import type { StayDetail } from '@/modules/catalog';
import { GatewayCheckoutPanel } from './GatewayCheckoutPanel';
import { usePreferences } from './PreferencesProvider';

interface AppliedPromoPreview {
  code: string;
  name: string;
  discountType: 'percent' | 'fixed_vnd';
  discountValue: number;
  fundingSource: 'vietnomad' | 'host' | 'shared';
  minNights: number;
  validTo: string;
}

function buildClientWhatsappHref(
  whatsappDigits: string,
  stayName: string,
  checkIn: string,
  nights: number,
  isVi: boolean
) {
  const digits = whatsappDigits.replace(/\D/g, '') || '84901234567';
  const msg = isVi
    ? `Chào đội hỗ trợ VietNomad, mình muốn hỏi thêm về căn "${stayName}", nhận phòng ${checkIn} (${nights} đêm). Nhờ bạn kiểm tra giúp tình trạng phòng và tốc độ Wi-Fi nhé.`
    : `Hi VietNomad Support, I have a question about "${stayName}" starting ${checkIn} for ${nights} nights. Could you confirm room availability and amenities?`;
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
  const { locale, platformConfig, serviceFeePct, premiumRewardPct, formatMoney } = usePreferences();
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

  // Promo code state
  const [promoInput, setPromoInput] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState('');

  useEffect(() => {
    const attr = captureClientAttribution();
    void trackClientEvent({
      eventName: 'stay_view',
      stayId: stay.id,
      landingPath: `/stays/${stay.slug}`,
      dedupeKey: `sv:${attr.sessionKey}:${stay.id}`,
    });
  }, [stay.id, stay.slug]);
  const [appliedPromo, setAppliedPromo] = useState<AppliedPromoPreview | null>(null);

  const [submitting, setSubmitting] = useState(false);
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
    feePaidOnlineVnd: number;
    payAtCheckinVnd: number;
  } | null>(null);

  const selectedRoom = stay.rooms.find((r) => r.id === roomId) ?? defaultRoom;
  const selectedPkg = selectedRoom?.packages[0] ?? defaultPkg;
  const totalNights = baseTier + extraNights;
  const checkOut = addDaysIso(checkIn, totalNights);

  const nightOverridesVnd = useMemo(() => {
    if (!selectedRoom) return [];
    const nights = enumerateStayNights(checkIn, checkOut);
    return nights.map((d) => selectedRoom.customPricesByDate?.[d] ?? null);
  }, [selectedRoom, checkIn, checkOut]);

  const promoAdjustment: PromotionAdjustmentInput | null = useMemo(() => {
    if (!appliedPromo) return null;
    if (totalNights < appliedPromo.minNights) return null;
    return {
      code: appliedPromo.code,
      discountType: appliedPromo.discountType,
      discountValue: appliedPromo.discountValue,
      fundingSource: appliedPromo.fundingSource,
    };
  }, [appliedPromo, totalNights]);

  const effectivePromoError =
    appliedPromo && totalNights < appliedPromo.minNights
      ? isVi
        ? `Mã ${appliedPromo.code} yêu cầu tối thiểu ${appliedPromo.minNights} đêm.`
        : `Code ${appliedPromo.code} requires at least ${appliedPromo.minNights} nights.`
      : promoError;

  const quote = useMemo(() => {
    if (!selectedPkg) return null;
    return calculateStayQuote({
      pkg: selectedPkg,
      nights: totalNights,
      isPremiumMember: user?.membershipTier === 'premium',
      applyVatFree,
      vatTaxId: user?.vatTaxId,
      availableRewardCreditVnd: user?.rewardCreditVnd ?? 0,
      useRewardCredit,
      nightOverridesVnd,
      serviceFeeRate: platformConfig.serviceFeeRate,
      vatDiscountRate: platformConfig.vatDiscountRate,
      premiumRewardRate: platformConfig.premiumRewardRate,
      promotion: promoAdjustment,
    });
  }, [
    selectedPkg,
    totalNights,
    user,
    applyVatFree,
    useRewardCredit,
    nightOverridesVnd,
    platformConfig,
    promoAdjustment,
  ]);

  async function handleApplyPromo() {
    const cleaned = promoInput.trim().toUpperCase();
    if (!cleaned || !selectedRoom || !selectedPkg) return;
    setPromoLoading(true);
    setPromoError('');
    try {
      const res = await fetch('/api/promotions/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: cleaned,
          stayId: stay.id,
          roomId: selectedRoom.id,
          packageId: selectedPkg.id,
          checkIn,
          nights: totalNights,
          applyVatFree,
          useRewardCredit,
        }),
      });
      const json = await res.json();
      if (!json.ok || !json.promotion) {
        setAppliedPromo(null);
        setPromoError(
          json.error?.message ??
            (isVi ? 'Mã giảm giá không hợp lệ hoặc đã hết hạn.' : 'Promo code is invalid or expired.')
        );
        return;
      }
      setAppliedPromo({
        code: json.promotion.code,
        name: json.promotion.name,
        discountType: json.promotion.discountType,
        discountValue: json.promotion.discountValue,
        fundingSource: json.promotion.fundingSource,
        minNights: json.promotion.minNights,
        validTo: json.promotion.validTo,
      });
      setPromoInput(json.promotion.code);
      setPromoError('');
    } catch {
      setPromoError(isVi ? 'Không thể kiểm tra mã lúc này.' : 'Could not validate promo code.');
    } finally {
      setPromoLoading(false);
    }
  }

  function handleRemovePromo() {
    setAppliedPromo(null);
    setPromoInput('');
    setPromoError('');
  }

  async function handleStartReservation() {
    if (!user) {
      window.location.assign(`/login?next=/stays/${stay.slug}`);
      return;
    }
    if (!selectedRoom || !selectedPkg) return;
    setSubmitting(true);
    setError('');
    try {
      const attr = captureClientAttribution();
      void trackClientEvent({
        eventName: 'checkout_start',
        stayId: stay.id,
        landingPath: `/stays/${stay.slug}`,
        dedupeKey: `cs:${attr.sessionKey}:${stay.id}:${checkIn}:${totalNights}`,
      });

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
          promotionCode: promoAdjustment?.code,
          guestNote,
          checkoutMode: 'intent',
          attributionSessionKey: attr.sessionKey,
          utmSource: attr.utmSource,
          utmMedium: attr.utmMedium,
          utmCampaign: attr.utmCampaign,
          utmContent: attr.utmContent,
          utmTerm: attr.utmTerm,
          landingPath: attr.landingPath,
        }),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error?.message ?? (isVi ? 'Không thể tạo đặt phòng.' : 'Could not create booking.'));
        return;
      }

      setPendingBooking({
        bookingId: json.booking.bookingId,
        bookingCode: json.booking.bookingCode,
        paymentIntentId: json.booking.paymentIntentId,
        feeOnlineVnd: json.booking.quote.feeOnlineVnd,
        payAtCheckinVnd: json.booking.quote.payAtCheckinVnd,
      });
    } catch {
      setError(isVi ? 'Lỗi kết nối. Vui lòng thử lại.' : 'Network error. Please retry.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!selectedRoom || !selectedPkg || !quote) {
    return (
      <div className="rounded-3xl border border-[#E5DFD3] bg-white p-6 text-sm text-[#53635D]">
        {isVi ? 'Hiện chưa có gói phòng mở đặt.' : 'No open packages available.'}
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
          <span className="inline-flex items-center gap-1 rounded-full bg-[#E7F1EC] px-2.5 py-0.5 text-xs font-semibold text-[#164E3F]">
            <Zap className="h-3.5 w-3.5" />
            {isVi ? `Phí dịch vụ ${serviceFeePct}% online` : `${serviceFeePct}% online service fee`}
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-serif-display text-3xl font-bold text-[#17221E]">
              {formatMoney(quote.feeOnlineVnd)}
            </span>
            <span className="text-xs font-medium text-[#164E3F]">
              {isVi ? `trả hôm nay (${serviceFeePct}%)` : `due today (${serviceFeePct}%)`}
            </span>
          </div>
          <div className="text-xs text-[#53635D]">
            {isVi
              ? `Trả ${formatMoney(quote.payAtCheckinVnd)} cho chủ nhà khi nhận phòng · Tổng ${formatMoney(quote.totalStayVnd)}`
              : `Pay ${formatMoney(quote.payAtCheckinVnd)} to host at check-in · Total ${formatMoney(quote.totalStayVnd)}`}
          </div>
        </div>

        {quote.weeklySavingsPct > 0 && (
          <span className="rounded-xl bg-[#164E3F] px-2.5 py-1 text-center text-xs font-bold text-white">
            {isVi ? `Giảm ${quote.weeklySavingsPct}%` : `Save ${quote.weeklySavingsPct}%`}
          </span>
        )}
      </div>

      {stay.rooms.length > 1 && (
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[#53635D]">
            {isVi ? 'Loại phòng' : 'Room type'}
          </label>
          <select
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            className="min-h-[42px] w-full rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2 text-sm font-medium"
          >
            {stay.rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {isVi ? r.nameVi : r.nameEn} ({isVi ? 'tối đa' : 'max'} {r.maxGuests})
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#53635D]">
          {isVi ? 'Chọn gói số đêm' : 'Select duration'}
        </label>
        <div className="grid grid-cols-4 gap-1.5">
          {([7, 14, 21, 30] as const).map((tier) => {
            const tierQ = calculateStayQuote({
              pkg: selectedPkg,
              nights: tier,
              serviceFeeRate: platformConfig.serviceFeeRate,
              vatDiscountRate: platformConfig.vatDiscountRate,
              premiumRewardRate: platformConfig.premiumRewardRate,
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
                  {tier === 30 ? (isVi ? '1 tháng' : '1 mo') : `${tier} ${isVi ? 'đêm' : 'N'}`}
                </div>
                <div className={`text-[10px] ${baseTier === tier ? 'text-[#CDE0D9]' : 'text-[#53635D]'}`}>
                  {formatMoney(tierQ.totalStayVnd)}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[#53635D]">
            {isVi ? 'Ngày nhận phòng' : 'Check-in'}
          </label>
          <input
            type="date"
            min={getTodayIsoVietnam()}
            value={checkIn}
            onChange={(e) => setCheckIn(e.target.value)}
            className="min-h-[42px] w-full rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2 text-xs font-semibold"
          />
          <div className="mt-1 text-[11px] text-[#53635D]">
            {isVi ? 'Trả phòng:' : 'Check-out:'} {checkOut}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[#53635D]">
            {isVi ? 'Thêm đêm lẻ' : 'Extra nights'}
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
            {isVi ? 'Ghi chú cho chủ nhà' : 'Note for host'}
          </span>
          <input
            type="text"
            value={guestNote}
            onChange={(e) => setGuestNote(e.target.value)}
            placeholder={isVi ? 'Giờ bay, nhu cầu thêm...' : 'Arrival time, room request...'}
            className="min-h-[42px] w-full rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2 text-xs"
          />
        </label>
      </div>

      {/* Promotion Code Input */}
      <div className="space-y-1.5">
        <label className="flex items-center gap-1 text-xs font-semibold text-[#53635D]">
          <Tag className="h-3.5 w-3.5 text-[#C25E28]" />
          {isVi ? 'Mã giảm giá' : 'Promo code'}
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={promoInput}
            onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
            placeholder={isVi ? 'Nhập mã (VD: NOMAD14)' : 'Enter code (e.g. NOMAD14)'}
            disabled={Boolean(appliedPromo) || promoLoading}
            className="min-h-[38px] flex-1 rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-1.5 font-mono text-xs uppercase"
          />
          {appliedPromo ? (
            <button
              type="button"
              onClick={handleRemovePromo}
              className="inline-flex items-center gap-1 rounded-xl border border-[#E5DFD3] px-3 py-1.5 text-xs font-semibold text-[#53635D] hover:bg-[#FAF8F3]"
            >
              <X className="h-3.5 w-3.5" />
              {isVi ? 'Gỡ mã' : 'Remove'}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleApplyPromo}
              disabled={promoLoading || !promoInput.trim()}
              className="inline-flex items-center gap-1 rounded-xl bg-[#164E3F] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#0F392E] disabled:opacity-50"
            >
              {promoLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {isVi ? 'Áp dụng' : 'Apply'}
            </button>
          )}
        </div>
        {appliedPromo && quote.promotionDiscountVnd > 0 && (
          <div className="rounded-lg bg-[#E7F1EC] px-2.5 py-1.5 text-[11px] font-medium text-[#164E3F]">
            {isVi
              ? `Đã áp dụng ${appliedPromo.code} (${appliedPromo.name}): giảm ${formatMoney(quote.promotionDiscountVnd)}.`
              : `Applied ${appliedPromo.code} (${appliedPromo.name}): saving ${formatMoney(quote.promotionDiscountVnd)}.`}
          </div>
        )}
        {effectivePromoError && (
          <div className="text-[11px] font-medium text-[#C25E28]">{effectivePromoError}</div>
        )}
      </div>

      {user && (user.vatTaxId || user.rewardCreditVnd > 0) && (
        <div className="space-y-2 rounded-2xl border border-[#E5DFD3] bg-[#FAF8F3] p-3 text-xs">
          {user.membershipTier === 'premium' && user.vatTaxId && (
            <label className="flex cursor-pointer items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 font-medium text-[#164E3F]">
                <Sparkles className="h-3.5 w-3.5 text-[#A67C2E]" />
                {isVi ? `Áp dụng miễn VAT (${user.vatTaxId})` : `VAT-free invoice (${user.vatTaxId})`}
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
                  ? `Trừ tiền thưởng (${formatMoney(user.rewardCreditVnd)})`
                  : `Use reward credit (${formatMoney(user.rewardCreditVnd)})`}
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

      <div className="space-y-2 rounded-2xl border border-[#164E3F]/20 bg-[#FAF8F3] p-4 text-xs">
        <div className="flex items-center justify-between text-[#53635D]">
          <span>
            {isVi
              ? `Giá thuê gốc (${totalNights} đêm)`
              : `Original stay rent (${totalNights} nights)`}
          </span>
          <span>{formatMoney(quote.wholesaleTotalVnd)}</span>
        </div>

        <div className="flex items-center justify-between text-[#53635D]">
          <span>
            {isVi
              ? `Phí dịch vụ VietNomad (${serviceFeePct}%)`
              : `Platform service fee (${serviceFeePct}%)`}
          </span>
          <span>{formatMoney(quote.serviceFeeVnd)}</span>
        </div>

        {quote.promotionDiscountVnd > 0 && (
          <div className="flex items-center justify-between font-medium text-[#164E3F]">
            <span>
              {isVi
                ? `Mã ưu đãi ${quote.promotionCode}`
                : `Promo ${quote.promotionCode} (${
                    quote.promotionFundingSource === 'host'
                      ? 'Host-funded'
                      : quote.promotionFundingSource === 'shared'
                        ? 'Shared'
                        : 'VietNomad-funded'
                  })`}
            </span>
            <span>-{formatMoney(quote.promotionDiscountVnd)}</span>
          </div>
        )}

        {quote.vatDiscountVnd > 0 && (
          <div className="flex justify-between font-medium text-[#164E3F]">
            <span>{isVi ? 'Giảm VAT hội viên' : 'VAT-free savings'}</span>
            <span>-{formatMoney(quote.vatDiscountVnd)}</span>
          </div>
        )}

        {quote.rewardCreditUsedVnd > 0 && (
          <div className="flex justify-between font-medium text-[#C25E28]">
            <span>{isVi ? 'Dùng tiền thưởng' : 'Reward credit applied'}</span>
            <span>-{formatMoney(quote.rewardCreditUsedVnd)}</span>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-[#E5DFD3] pt-2 font-semibold text-[#164E3F]">
          <span>
            {isVi ? `Trả online hôm nay (${serviceFeePct}%)` : `Due online today`}
          </span>
          <span className="text-sm font-bold text-[#164E3F]">
            {formatMoney(quote.feeOnlineVnd)}
          </span>
        </div>

        <div className="flex items-center justify-between text-[#17221E]">
          <span>{isVi ? 'Trả chủ nhà khi nhận phòng' : 'Pay host at check-in'}</span>
          <span className="font-semibold">{formatMoney(quote.payAtCheckinVnd)}</span>
        </div>

        <div className="flex items-center justify-between border-t border-[#E5DFD3] pt-2 text-sm font-bold text-[#17221E]">
          <span>{isVi ? 'Tổng chi phí kỳ ở' : 'Total stay cost'}</span>
          <span>{formatMoney(quote.totalStayVnd)}</span>
        </div>

        {quote.rewardCreditEarnedVnd > 0 && (
          <div className="text-[11px] font-semibold text-[#A67C2E]">
            + {formatMoney(quote.rewardCreditEarnedVnd)}{' '}
            {isVi
              ? `tiền thưởng (${premiumRewardPct}%) sau khi xác nhận`
              : `earned in ${premiumRewardPct}% reward credit`}
          </div>
        )}
      </div>

      <div className="flex items-start gap-2.5 rounded-xl border border-[#164E3F]/25 bg-[#E7F1EC]/75 p-3 text-[11px] text-[#17221E]">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#164E3F]" />
        <div>
          <div className="font-bold text-[#164E3F]">
            {isVi ? 'Chính sách đặt và hủy phòng' : 'Booking & cancellation terms'}
          </div>
          <p className="mt-0.5 text-[#53635D]">
            {isVi
              ? `${stay.isWifiVerified ? 'Chỗ ở có badge Wi-Fi Verified.' : 'Thông tin tiện nghi và Wi-Fi do chủ nhà cung cấp.'} Phí dịch vụ ${formatMoney(quote.feeOnlineVnd)} áp dụng theo chính sách hủy ${formatCancellationPolicyLabel(stay.cancellationPolicy, locale)}.`
              : `${stay.isWifiVerified ? 'This stay carries a Wi-Fi Verified badge.' : 'Amenities and Wi-Fi details are reported by the host.'} The ${formatMoney(quote.feeOnlineVnd)} service fee follows the ${formatCancellationPolicyLabel(stay.cancellationPolicy, locale)} cancellation policy.`}
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl bg-[#FAEDE5] p-3 text-xs font-medium text-[#C25E28]">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {pendingBooking && (
        <GatewayCheckoutPanel
          purpose="booking_fee"
          bookingId={pendingBooking.bookingId}
          amountVnd={pendingBooking.feeOnlineVnd}
          title={
            isVi
              ? `Thanh toán giữ chỗ (${pendingBooking.bookingCode})`
              : `Pay reservation fee (${pendingBooking.bookingCode})`
          }
          subtitle={
            isVi
              ? `Khóa lịch ngay khi thanh toán. Phần ${formatMoney(pendingBooking.payAtCheckinVnd)} trả chủ nhà khi nhận phòng.`
              : `Locks your dates immediately. Pay ${formatMoney(pendingBooking.payAtCheckinVnd)} directly to host at check-in.`
          }
          onPaid={() => {
            setConfirmed({
              bookingCode: pendingBooking.bookingCode,
              status: 'RESERVED_LOCKED',
              feePaidOnlineVnd: pendingBooking.feeOnlineVnd,
              payAtCheckinVnd: pendingBooking.payAtCheckinVnd,
            });
            setPendingBooking(null);
          }}
        />
      )}

      {confirmed ? (
        <div className="space-y-3 rounded-2xl border border-[#164E3F]/30 bg-[#E7F1EC] p-4 text-xs text-[#17221E]">
          <div className="flex items-center gap-2 font-bold text-[#164E3F]">
            <CheckCircle2 className="h-4 w-4" />
            {isVi
              ? `Đặt phòng thành công (${confirmed.bookingCode})`
              : `Booking confirmed (${confirmed.bookingCode})`}
          </div>
          <p className="text-[#53635D]">
            {isVi
              ? `Đã thanh toán ${formatMoney(confirmed.feePaidOnlineVnd)} online. Trả ${formatMoney(confirmed.payAtCheckinVnd)} cho chủ nhà khi nhận phòng.`
              : `Paid ${formatMoney(confirmed.feePaidOnlineVnd)} online. Pay ${formatMoney(confirmed.payAtCheckinVnd)} to your host at check-in.`}
          </p>
          <Link
            href="/dashboard"
            className="inline-flex min-h-[40px] items-center rounded-lg bg-[#164E3F] px-3.5 py-2 font-semibold text-white"
          >
            {isVi ? 'Xem địa chỉ & chi tiết nhận phòng' : 'View address & check-in details'}
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
                ? `Đăng nhập để giữ phòng (phí ${serviceFeePct}%)`
                : `Log in to reserve (${serviceFeePct}% fee)`
              : isVi
                ? `Đặt giữ chỗ ngay (${formatMoney(quote.feeOnlineVnd)})`
                : `Reserve now · Pay ${formatMoney(quote.feeOnlineVnd)} today`}
          </button>
        )
      )}

      <a
        href={conciergeHref}
        target="_blank"
        rel="noopener noreferrer"
        className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-[#164E3F]/25 bg-[#FAF8F3] px-4 py-2.5 text-xs font-semibold text-[#164E3F] transition hover:bg-[#E7F1EC]"
      >
        <MessageCircle className="h-4 w-4 text-[#25D366]" />
        {isVi ? 'Nhắn hỗ trợ qua WhatsApp' : 'Ask booking support on WhatsApp'}
      </a>
    </div>
  );
}
