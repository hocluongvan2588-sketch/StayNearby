'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
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
import {
  formatBusinessModelLabel,
  formatCancellationPolicyLabel,
  formatMoneyFromVnd,
  formatVndExact,
} from '@/lib/i18n';
import { calculateStayQuote } from '@/lib/pricing';
import type { StayDetail } from '@/modules/catalog';
import { GatewayCheckoutPanel } from './GatewayCheckoutPanel';
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
    ? `Chào đội hỗ trợ VietNomad, mình muốn hỏi thêm về căn "${stayName}", nhận phòng ${checkIn} (${nights} đêm). Nhờ bạn kiểm tra giúp tình trạng phòng và tốc độ Wi-Fi nhé.`
    : `Hi VietNomad Support, I have a question about "${stayName}" starting ${checkIn} for ${nights} nights. Could you confirm room availability and Wi-Fi details?`;
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
        setError(json.error?.message ?? (isVi ? 'Không thể tạo đặt phòng.' : 'Could not create booking.'));
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
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              stay.businessModel === 'booking_flow'
                ? 'bg-[#E7F1EC] text-[#164E3F]'
                : 'bg-[#FAEDE5] text-[#C25E28]'
            }`}
          >
            {stay.businessModel === 'booking_flow' ? (
              <>
                <Zap className="h-3.5 w-3.5" />
                {isVi ? 'Đặt qua VietNomad (phí giữ chỗ 12%)' : 'Book on VietNomad (12% fee)'}
              </>
            ) : (
              <>
                <ExternalLink className="h-3.5 w-3.5" />
                {formatBusinessModelLabel(stay.businessModel, locale)}
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
                ? `Trả ${formatMoneyFromVnd(quote.payAtCheckinVnd, currency)} khi nhận phòng, tổng ${formatMoneyFromVnd(quote.totalStayVnd, currency)}`
                : `Pay ${formatMoneyFromVnd(quote.payAtCheckinVnd, currency)} at check-in, total ${formatMoneyFromVnd(quote.totalStayVnd, currency)}`
              : `${formatMoneyFromVnd(quote.perNightDisplayVnd, currency)}/${isVi ? 'đêm' : 'night'} (${formatVndExact(quote.totalStayVnd)})`}
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
                  {tier === 30 ? (isVi ? '1 tháng' : '1 mo') : `${tier} ${isVi ? 'đêm' : 'N'}`}
                </div>
                <div className={`text-[10px] ${baseTier === tier ? 'text-[#CDE0D9]' : 'text-[#53635D]'}`}>
                  {formatMoneyFromVnd(tierQ.totalStayVnd, currency)}
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
            placeholder={isVi ? 'Giờ bay, nhu cầu thêm...' : 'Arrival time, desk request...'}
            className="min-h-[42px] w-full rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2 text-xs"
          />
        </label>
      </div>

      {stay.businessModel === 'booking_flow' && user && (user.vatTaxId || user.rewardCreditVnd > 0) && (
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
                  ? `Trừ tiền thưởng (${formatMoneyFromVnd(user.rewardCreditVnd, currency)})`
                  : `Use reward credit (${formatMoneyFromVnd(user.rewardCreditVnd, currency)})`}
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
        <div className="flex items-center justify-between font-semibold text-[#164E3F]">
          <span>
            {stay.businessModel === 'booking_flow'
              ? isVi
                ? 'Trả hôm nay (Phí giữ chỗ 12%)'
                : 'Due today (12% booking fee)'
              : isVi
                ? 'Trả online hôm nay'
                : 'Due online today'}
          </span>
          <span className="text-sm font-bold text-[#164E3F]">
            {formatMoneyFromVnd(quote.feeOnlineVnd, currency)}
          </span>
        </div>

        <div className="flex items-center justify-between text-[#17221E]">
          <span>
            {isVi
              ? 'Trả chủ nhà khi nhận phòng'
              : 'Pay host at check-in'}
          </span>
          <span className="font-semibold">
            {formatMoneyFromVnd(quote.payAtCheckinVnd, currency)}
          </span>
        </div>

        {quote.vatDiscountVnd > 0 && (
          <div className="flex justify-between font-medium text-[#164E3F]">
            <span>{isVi ? 'Giảm VAT hội viên' : 'VAT-free savings'}</span>
            <span>-{formatMoneyFromVnd(quote.vatDiscountVnd, currency)}</span>
          </div>
        )}

        {quote.rewardCreditUsedVnd > 0 && (
          <div className="flex justify-between font-medium text-[#C25E28]">
            <span>{isVi ? 'Dùng tiền thưởng' : 'Reward credit applied'}</span>
            <span>-{formatMoneyFromVnd(quote.rewardCreditUsedVnd, currency)}</span>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-[#E5DFD3] pt-2 text-sm font-bold text-[#17221E]">
          <span>{isVi ? 'Tổng chi phí kỳ ở' : 'Total stay cost'}</span>
          <span>{formatMoneyFromVnd(quote.totalStayVnd, currency)}</span>
        </div>

        {quote.rewardCreditEarnedVnd > 0 && (
          <div className="text-[11px] font-semibold text-[#A67C2E]">
            + {formatMoneyFromVnd(quote.rewardCreditEarnedVnd, currency)}{' '}
            {isVi ? 'tiền thưởng (4%) sau khi xác nhận' : 'earned in 4% reward credit'}
          </div>
        )}
      </div>

      <div className="flex items-start gap-2.5 rounded-xl border border-[#164E3F]/25 bg-[#E7F1EC]/75 p-3 text-[11px] text-[#17221E]">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#164E3F]" />
        <div>
          <div className="font-bold text-[#164E3F]">
            {isVi ? 'Chính sách giữ chỗ và hủy phòng minh bạch' : 'Clear reservation and cancellation terms'}
          </div>
          <p className="mt-0.5 text-[#53635D]">
            {isVi
              ? `Tốc độ Wi-Fi và bàn làm việc được kiểm tra trước khi đăng. Phí giữ chỗ ${formatMoneyFromVnd(quote.feeOnlineVnd, currency)} áp dụng theo chính sách hủy ${formatCancellationPolicyLabel(stay.cancellationPolicy, locale)}.`
              : `Wi-Fi speed and desk setup are verified prior to listing. Your ${formatMoneyFromVnd(quote.feeOnlineVnd, currency)} booking fee follows ${formatCancellationPolicyLabel(stay.cancellationPolicy, locale)} cancellation rules.`}
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
              ? `Khóa lịch ngay khi thanh toán. Phần ${formatMoneyFromVnd(pendingBooking.payAtCheckinVnd, currency)} trả chủ nhà khi nhận phòng.`
              : `Locks your dates immediately. Pay ${formatMoneyFromVnd(pendingBooking.payAtCheckinVnd, currency)} directly to host at check-in.`
          }
          onPaid={() => {
            setConfirmed({
              bookingCode: pendingBooking.bookingCode,
              status: 'RESERVED_LOCKED',
              directReferralUrl: null,
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
            {confirmed.status === 'RESERVED_LOCKED'
              ? isVi
                ? `Đã giữ phòng thành công (${confirmed.bookingCode})`
                : `Dates locked (${confirmed.bookingCode})`
              : isVi
                ? `Đã ghi nhận đặt trực tiếp (${confirmed.bookingCode})`
                : `Direct booking link ready (${confirmed.bookingCode})`}
          </div>
          {confirmed.status === 'RESERVED_LOCKED' && (
            <p className="text-[#53635D]">
              {isVi
                ? `Đã thanh toán ${formatMoneyFromVnd(confirmed.feePaidOnlineVnd, currency)} online. Phần ${formatMoneyFromVnd(confirmed.payAtCheckinVnd, currency)} trả chủ nhà khi nhận phòng.`
                : `Paid ${formatMoneyFromVnd(confirmed.feePaidOnlineVnd, currency)} online. Pay ${formatMoneyFromVnd(confirmed.payAtCheckinVnd, currency)} to your host at check-in.`}
            </p>
          )}
          {confirmed.directReferralUrl && (
            <p className="text-[#53635D]">
              {isVi ? 'Trang đặt phòng của chủ nhà:' : 'Host booking website:'}{' '}
              <span className="break-all font-semibold text-[#164E3F]">{confirmed.directReferralUrl}</span>
            </p>
          )}
          <Link
            href="/dashboard"
            className="inline-flex min-h-[40px] items-center rounded-lg bg-[#164E3F] px-3.5 py-2 font-semibold text-white"
          >
            {isVi ? 'Xem địa chỉ và chứng nhận Wi-Fi' : 'View address & Wi-Fi certificate'}
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
                ? 'Đăng nhập để giữ phòng (phí 12%)'
                : 'Log in to reserve (12% fee)'
              : stay.businessModel === 'booking_flow'
                ? isVi
                  ? `Đặt giữ chỗ ngay (${formatMoneyFromVnd(quote.feeOnlineVnd, currency)})`
                  : `Reserve now, pay ${formatMoneyFromVnd(quote.feeOnlineVnd, currency)} today`
                : isVi
                  ? 'Mở trang đặt phòng của chủ nhà'
                  : 'Continue to host website'}
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
