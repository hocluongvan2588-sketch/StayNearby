'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  MessageCircle,
  Minus,
  Plus,
  ShieldCheck,
  Sparkles,
  Tag,
  X,
} from 'lucide-react';
import { captureClientAttribution, trackClientEvent } from '@/lib/attribution';
import type { SessionUser } from '@/lib/auth/session';
import {
  POLICY_MIN_NIGHTS,
  STAY_PACKAGE_TIERS,
  resolveEffectiveMinNights,
  type StayPackageTier,
} from '@/lib/business-rules';
import { addDaysIso, enumerateStayNights, getTodayIsoVietnam } from '@/lib/dates';
import { localizeGuestError } from '@/lib/error-copy';
import { formatCancellationPolicyLabel, formatCountNoun } from '@/lib/i18n';
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
    ? `Chào đội hỗ trợ VietNomad, mình muốn hỏi thêm về căn "${stayName}", nhận phòng ${checkIn} (${nights} đêm). Nhờ bạn kiểm tra giúp tình trạng phòng nhé.`
    : `Hi VietNomad Support, I have a question about "${stayName}" starting ${checkIn} for ${nights} nights. Could you confirm availability and booking terms?`;
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
  const { locale, platformConfig, premiumRewardPct, formatMoney } =
    usePreferences();
  const isVi = locale === 'vi';

  const defaultRoom = stay.rooms[0];
  const defaultPkg = defaultRoom?.packages[0];

  const [roomId, setRoomId] = useState(defaultRoom?.id ?? '');
  const [checkIn, setCheckIn] = useState(addDaysIso(getTodayIsoVietnam(), 7));
  const [baseTier, setBaseTier] = useState<StayPackageTier>(30);
  const [extraNights, setExtraNights] = useState(0);
  const [guestsCount, setGuestsCount] = useState(1);
  const [applyVatFree, setApplyVatFree] = useState(
    Boolean(user?.membershipTier === 'premium' && user?.vatTaxId)
  );
  const [useRewardCredit, setUseRewardCredit] = useState(
    Boolean((user?.rewardCreditVnd ?? 0) > 0)
  );
  const [guestNote, setGuestNote] = useState('');
  const [showExtras, setShowExtras] = useState(false);

  // Persist the guest's in-progress selection across the login round-trip so
  // nothing is lost when auth starts from the booking CTA.
  const draftKey = `booking_draft:${stay.slug}`;
  useEffect(() => {
    // Deferred so the restore never blocks hydration; runs right after mount.
    const timer = window.setTimeout(() => {
      try {
        const raw = window.sessionStorage.getItem(draftKey);
        if (!raw) return;
        window.sessionStorage.removeItem(draftKey);
        const draft = JSON.parse(raw) as {
          roomId?: string;
          checkIn?: string;
          baseTier?: number;
          extraNights?: number;
          guestsCount?: number;
        };
        if (draft.roomId && stay.rooms.some((r) => r.id === draft.roomId)) {
          setRoomId(draft.roomId);
        }
        if (draft.checkIn && draft.checkIn >= getTodayIsoVietnam()) {
          setCheckIn(draft.checkIn);
        }
        if ([7, 14, 21, 30].includes(draft.baseTier ?? 0)) {
          setBaseTier(draft.baseTier as StayPackageTier);
        }
        if (typeof draft.extraNights === 'number' && draft.extraNights >= 0) {
          setExtraNights(draft.extraNights);
        }
        if (typeof draft.guestsCount === 'number' && draft.guestsCount >= 1) {
          setGuestsCount(draft.guestsCount);
        }
      } catch {
        // Ignore malformed drafts
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [draftKey, stay.rooms]);

  // Promo code state
  const [promoInput, setPromoInput] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<AppliedPromoPreview | null>(null);

  useEffect(() => {
    const attr = captureClientAttribution();
    void trackClientEvent({
      eventName: 'stay_view',
      stayId: stay.id,
      landingPath: `/stays/${stay.slug}`,
      dedupeKey: `sv:${attr.sessionKey}:${stay.id}`,
    });
  }, [stay.id, stay.slug]);

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

  // Effective minimum = strictest of platform setting × listing default.
  // Date-level room locks are re-checked server-side at booking time.
  const minNights = useMemo(
    () =>
      resolveEffectiveMinNights({
        platformMinNights: platformConfig.defaultMinNights,
        stayMinNights: stay.defaultMinNights,
      }),
    [platformConfig.defaultMinNights, stay.defaultMinNights]
  );
  const extraNightsFloor = Math.max(0, minNights - baseTier);
  const effectiveExtraNights = Math.max(extraNights, extraNightsFloor);
  const totalNights = baseTier + effectiveExtraNights;
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
        ? `Mã ${appliedPromo.code} áp dụng cho đơn từ ${appliedPromo.minNights} đêm trở lên.`
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
        setPromoError(localizeGuestError(json.error?.message, locale));
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
      setPromoError(
        isVi ? 'Không thể kiểm tra mã lúc này.' : 'Could not validate promo code.'
      );
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
      // Auth starts the booking flow — save the selection first, restore it
      // after login. No booking or inventory lock happens at login.
      try {
        window.sessionStorage.setItem(
          draftKey,
          JSON.stringify({ roomId, checkIn, baseTier, extraNights, guestsCount })
        );
      } catch {
        // Storage unavailable — best effort
      }
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
        setError(localizeGuestError(json.error?.message, locale));
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
      setError(localizeGuestError(null, locale));
    } finally {
      setSubmitting(false);
    }
  }

  if (!selectedRoom || !selectedPkg || !quote) {
    return (
      <div className="rounded-2xl border border-[#E5DFD3] bg-white p-6 text-sm text-[#53635D]">
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
    <aside className="sticky top-24 space-y-5 rounded-2xl border border-[#E5DFD3] bg-white p-6 shadow-lg">
      {/* Price Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-baseline gap-1.5">
            <span className="text-[26px] font-semibold tracking-tight text-[#17221E]">
              {formatMoney(quote.totalStayVnd)}
            </span>
            <span className="text-sm text-[#53635D]">
              {isVi ? `cho ${totalNights} đêm` : `for ${totalNights} nights`}
            </span>
          </div>
          <p className="mt-1 text-xs text-[#53635D]">
            {formatMoney(quote.perNightDisplayVnd)} / {isVi ? 'đêm' : 'night'}
          </p>
        </div>

        {quote.weeklySavingsPct > 0 && (
          <span className="shrink-0 rounded-full bg-[#FAEDE5] px-2.5 py-1 text-xs font-semibold text-[#C25E28]">
            {isVi ? `Tiết kiệm ${quote.weeklySavingsPct}%` : `Save ${quote.weeklySavingsPct}%`}
          </span>
        )}
      </div>

      {/* Room type selector if multiple rooms */}
      {stay.rooms.length > 1 && (
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-[#53635D]">
            {isVi ? 'Loại phòng' : 'Room option'}
          </label>
          <select
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            className="min-h-[44px] w-full rounded-xl border border-[#D4CEC2] bg-white px-3.5 py-2 text-sm font-medium text-[#17221E] outline-none focus:border-[#164E3F]"
          >
            {stay.rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {isVi ? r.nameVi : r.nameEn} (
                {formatCountNoun(r.maxGuests, 'guest', 'guests', 'khách', locale)})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Duration selector */}
      <div>
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-x-2 text-xs">
          <span className="font-semibold text-[#53635D]">
            {isVi ? 'Thời gian lưu trú' : 'Stay duration'}
          </span>
          {minNights > POLICY_MIN_NIGHTS && (
            <span className="font-semibold text-[#164E3F]">
              {isVi ? `Tối thiểu ${minNights} đêm` : `Minimum ${minNights} nights`}
            </span>
          )}
          <span className="text-[#53635D]">
            {checkIn} → {checkOut}
          </span>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {STAY_PACKAGE_TIERS.map((tier) => {
            const tierQ = calculateStayQuote({
              pkg: selectedPkg,
              nights: Math.max(tier, minNights),
              serviceFeeRate: platformConfig.serviceFeeRate,
              vatDiscountRate: platformConfig.vatDiscountRate,
              premiumRewardRate: platformConfig.premiumRewardRate,
            });
            const active = baseTier === tier;
            return (
              <button
                key={tier}
                type="button"
                onClick={() => setBaseTier(tier)}
                className={`min-h-[50px] rounded-xl border px-1.5 py-2 text-center transition ${
                  active
                    ? 'border-[#164E3F] bg-[#164E3F] text-white'
                    : 'border-[#E5DFD3] bg-[#FAF8F3] text-[#17221E] hover:border-[#164E3F]/50'
                }`}
              >
                <div className="text-[11px] font-semibold leading-tight">
                  {isVi ? `${tier} đêm` : `${tier} nights`}
                </div>
                <div className={`mt-0.5 text-[11px] ${active ? 'text-[#DCECE5]' : 'text-[#53635D]'}`}>
                  {formatMoney(tierQ.totalStayVnd)}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Unified Check-in / Extra nights / Guests box */}
      <div className="divide-y divide-[#D4CEC2] overflow-hidden rounded-xl border border-[#D4CEC2]">
        <div className="grid grid-cols-2 divide-x divide-[#D4CEC2]">
          <label className="block px-3.5 py-2.5">
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-[#53635D]">
              {isVi ? 'Nhận phòng' : 'Check-in'}
            </span>
            <input
              type="date"
              min={getTodayIsoVietnam()}
              value={checkIn}
              onChange={(e) => setCheckIn(e.target.value)}
              className="mt-0.5 w-full bg-transparent text-xs font-semibold text-[#17221E] outline-none"
            />
          </label>

          <div className="px-3.5 py-2.5">
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-[#53635D]">
              {isVi ? 'Thêm đêm lẻ' : 'Extra nights'}
            </span>
            <div className="mt-0.5 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setExtraNights((n) => Math.max(extraNightsFloor, n - 1))}
                className="rounded p-1 text-[#53635D] hover:bg-[#FAF8F3] hover:text-[#17221E]"
                aria-label="Decrease extra nights"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="text-xs font-semibold tabular-nums text-[#17221E]">
                +{effectiveExtraNights} ({totalNights} {isVi ? 'đêm' : 'N'})
              </span>
              <button
                type="button"
                onClick={() => setExtraNights((n) => Math.min(60, n + 1))}
                className="rounded p-1 text-[#53635D] hover:bg-[#FAF8F3] hover:text-[#17221E]"
                aria-label="Increase extra nights"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        <label className="block px-3.5 py-2.5">
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-[#53635D]">
            {isVi ? 'Số khách' : 'Guests'}
          </span>
          <select
            value={guestsCount}
            onChange={(e) => setGuestsCount(Number(e.target.value))}
            className="mt-0.5 w-full bg-transparent text-xs font-semibold text-[#17221E] outline-none"
          >
            {Array.from({ length: selectedRoom.maxGuests }, (_, i) => i + 1).map((g) => (
              <option key={g} value={g}>
                {formatCountNoun(g, 'guest', 'guests', 'khách', locale)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Primary Action / Payment Flow */}
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
              ? `Số tiền trả hôm nay là phí dịch vụ để giữ chỗ. Phần ${formatMoney(pendingBooking.payAtCheckinVnd)} trả cho chủ nhà khi nhận phòng.`
              : `You pay the service fee today to reserve your dates. Pay ${formatMoney(pendingBooking.payAtCheckinVnd)} to your host at check-in.`
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
        <div className="space-y-3 rounded-xl border border-[#164E3F]/30 bg-[#E7F1EC] p-4 text-xs text-[#17221E]">
          <div className="flex items-center gap-2 font-semibold text-[#164E3F]">
            <CheckCircle2 className="h-4 w-4" />
            {isVi
              ? `Đặt phòng thành công (${confirmed.bookingCode})`
              : `Booking confirmed (${confirmed.bookingCode})`}
          </div>
          <p className="text-[#53635D]">
            {isVi
              ? `Đã thanh toán ${formatMoney(confirmed.feePaidOnlineVnd)} phí dịch vụ online. Trả ${formatMoney(confirmed.payAtCheckinVnd)} cho chủ nhà khi nhận phòng.`
              : `Paid the ${formatMoney(confirmed.feePaidOnlineVnd)} service fee online. Pay ${formatMoney(confirmed.payAtCheckinVnd)} to your host at check-in.`}
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
            className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[#164E3F] px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-[#0F392E] disabled:opacity-60"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {stay.isInstantBook
              ? isVi
                ? 'Đặt chỗ'
                : 'Reserve'
              : isVi
                ? 'Gửi yêu cầu đặt chỗ'
                : 'Request to book'}
          </button>
        )
      )}

      {/* Mandatory Transparent Breakdown (Never Hidden) */}
      <div className="space-y-2.5 border-t border-[#E5DFD3] pt-4 text-sm">
        <div className="flex items-center justify-between text-[#53635D]">
          <span>
            {isVi
              ? `Tiền thuê chỗ ở (${totalNights} đêm)`
              : `Stay rent (${totalNights} nights)`}
          </span>
          <span className="text-[#17221E]">{formatMoney(quote.wholesaleTotalVnd)}</span>
        </div>

        <div className="flex items-center justify-between text-[#53635D]">
          <span>
            {isVi ? 'Phí dịch vụ VietNomad' : 'VietNomad service fee'}
          </span>
          <span className="text-[#17221E]">{formatMoney(quote.serviceFeeVnd)}</span>
        </div>

        {quote.promotionDiscountVnd > 0 && (
          <div className="flex items-center justify-between font-medium text-[#164E3F]">
            <span>
              {isVi ? `Mã ưu đãi ${quote.promotionCode}` : `Promo ${quote.promotionCode}`}
            </span>
            <span>-{formatMoney(quote.promotionDiscountVnd)}</span>
          </div>
        )}

        {quote.vatDiscountVnd > 0 && (
          <div className="flex items-center justify-between font-medium text-[#164E3F]">
            <span>{isVi ? 'Giảm VAT hội viên' : 'VAT-free savings'}</span>
            <span>-{formatMoney(quote.vatDiscountVnd)}</span>
          </div>
        )}

        {quote.rewardCreditUsedVnd > 0 && (
          <div className="flex items-center justify-between font-medium text-[#C25E28]">
            <span>{isVi ? 'Dùng tiền thưởng' : 'Reward credit'}</span>
            <span>-{formatMoney(quote.rewardCreditUsedVnd)}</span>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-[#E5DFD3] pt-3 text-base font-semibold text-[#17221E]">
          <span>{isVi ? 'Tổng chi phí kỳ lưu trú' : 'Total stay cost'}</span>
          <span>{formatMoney(quote.totalStayVnd)}</span>
        </div>

        <div className="space-y-1.5 border-t border-[#E5DFD3] pt-3">
          <div className="flex items-center justify-between font-semibold text-[#164E3F]">
            <span>{isVi ? 'Thanh toán online hôm nay' : 'Due online today'}</span>
            <span>{formatMoney(quote.feeOnlineVnd)}</span>
          </div>
          <div className="flex items-center justify-between text-[#17221E]">
            <span>{isVi ? 'Trả trực tiếp chủ nhà khi nhận phòng' : 'Pay host at check-in'}</span>
            <span className="font-medium">{formatMoney(quote.payAtCheckinVnd)}</span>
          </div>
        </div>

        <p className="text-xs text-[#53635D]">
          {isVi
            ? 'Phí này giữ chỗ cho bạn. Đây không phải tiền đặt cọc và không được trừ vào tiền thuê.'
            : 'This fee reserves your dates. It is not a deposit and is not deducted from your rent.'}
        </p>

        {quote.rewardCreditEarnedVnd > 0 && (
          <p className="text-xs font-medium text-[#A67C2E]">
            + {formatMoney(quote.rewardCreditEarnedVnd)}{' '}
            {isVi
              ? `tiền thưởng (${premiumRewardPct}%) sau khi xác nhận`
              : `earned in ${premiumRewardPct}% reward credit`}
          </p>
        )}
      </div>

      {/* Progressive Disclosure for Promo Code, Guest Note, Member Options */}
      <div className="border-t border-[#E5DFD3] pt-3">
        <button
          type="button"
          onClick={() => setShowExtras((v) => !v)}
          className="flex w-full items-center justify-between py-1 text-xs font-semibold text-[#17221E] hover:text-[#164E3F]"
        >
          <span className="inline-flex items-center gap-1.5">
            <Tag className="h-3.5 w-3.5 text-[#53635D]" />
            {isVi
              ? 'Mã giảm giá, ghi chú & tùy chọn hội viên'
              : 'Promo code, host note & member perks'}
          </span>
          {showExtras ? (
            <ChevronUp className="h-4 w-4 text-[#53635D]" />
          ) : (
            <ChevronDown className="h-4 w-4 text-[#53635D]" />
          )}
        </button>

        {(showExtras || appliedPromo || guestNote) && (
          <div className="mt-3 space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={promoInput}
                onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                placeholder={isVi ? 'Mã giảm giá (VD: NOMAD14)' : 'Promo code (e.g. NOMAD14)'}
                disabled={Boolean(appliedPromo) || promoLoading}
                className="min-h-[38px] flex-1 rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-1.5 font-mono text-xs uppercase outline-none focus:border-[#164E3F]"
              />
              {appliedPromo ? (
                <button
                  type="button"
                  onClick={handleRemovePromo}
                  className="inline-flex items-center gap-1 rounded-xl border border-[#E5DFD3] px-3 py-1.5 text-xs font-semibold text-[#53635D] hover:bg-[#FAF8F3]"
                >
                  <X className="h-3.5 w-3.5" />
                  {isVi ? 'Gỡ' : 'Remove'}
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
              <div className="text-xs font-medium text-[#164E3F]">
                {isVi
                  ? `Đã áp dụng ${appliedPromo.code}: giảm ${formatMoney(quote.promotionDiscountVnd)}.`
                  : `Applied ${appliedPromo.code}: saving ${formatMoney(quote.promotionDiscountVnd)}.`}
              </div>
            )}
            {effectivePromoError && (
              <div className="text-xs font-medium text-[#C25E28]">
                {effectivePromoError}
              </div>
            )}

            <input
              type="text"
              value={guestNote}
              onChange={(e) => setGuestNote(e.target.value)}
              placeholder={
                isVi
                  ? 'Ghi chú cho chủ nhà (giờ bay, yêu cầu thêm...)'
                  : 'Note for host (arrival time, preferences...)'
              }
              className="min-h-[38px] w-full rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-1.5 text-xs outline-none focus:border-[#164E3F]"
            />

            {user && (user.vatTaxId || user.rewardCreditVnd > 0) && (
              <div className="space-y-2 pt-1 text-xs">
                {user.membershipTier === 'premium' && user.vatTaxId && (
                  <label className="flex cursor-pointer items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 font-medium text-[#164E3F]">
                      <Sparkles className="h-3.5 w-3.5 text-[#A67C2E]" />
                      {isVi
                        ? `Miễn VAT (${user.vatTaxId})`
                        : `VAT-free invoice (${user.vatTaxId})`}
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
                        ? `Dùng tiền thưởng (${formatMoney(user.rewardCreditVnd)})`
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
          </div>
        )}
      </div>

      {/* Clear Cancellation & Concierge Terms */}
      <div className="space-y-3 border-t border-[#E5DFD3] pt-3 text-xs text-[#53635D]">
        <div className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#164E3F]" />
          <span>
            {isVi
              ? `Chính sách hủy: ${formatCancellationPolicyLabel(stay.cancellationPolicy, locale)}. Kiểm tra phòng trước khi thanh toán tiền thuê cho chủ nhà.`
              : `Cancellation: ${formatCancellationPolicyLabel(stay.cancellationPolicy, locale)} policy. Inspect the stay at check-in before paying rent to the host.`}
          </span>
        </div>

        <a
          href={conciergeHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 font-semibold text-[#164E3F] hover:underline"
        >
          <MessageCircle className="h-3.5 w-3.5" />
          {isVi ? 'Cần tư vấn nhanh? Nhắn hỗ trợ qua WhatsApp' : 'Questions? Chat with booking support on WhatsApp'}
        </a>
      </div>
    </aside>
  );
}
