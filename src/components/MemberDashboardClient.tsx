'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  AlertTriangle,
  Bookmark,
  Calendar,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  KeyRound,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Wallet,
  Wifi,
} from 'lucide-react';
import type { SessionUser } from '@/lib/auth/session';
import {
  formatBookingStatusLabel,
  formatCancellationPolicyLabel,
  formatMoneyFromVnd,
} from '@/lib/i18n';
import { usePreferences } from './PreferencesProvider';

interface MemberDashboardData {
  bookings: Array<{
    id: string;
    bookingCode: string;
    staySlug: string;
    titleEn: string;
    titleVi: string;
    heroImage: string;
    destinationNameEn: string;
    destinationNameVi: string;
    roomNameEn: string;
    roomNameVi: string;
    businessModel: string;
    status: string;
    checkIn: string;
    checkOut: string;
    nights: number;
    feeOnlineVnd: number;
    payAtCheckinVnd: number;
    guestTotalVnd: number;
    rewardCreditEarnedVnd: number;
    paymentIntentId: string | null;
    paidAt: string | null;
    mismatchReason: string;
    cancellationPolicy: string;
    refundAmountVnd: number;
    creditIssuedVnd: number;
    wifiDownloadMbps: number;
    wifiUploadMbps: number;
    wifiJitterMs: number;
    verificationTier: string;
    speedtestProofUrl: string | null;
    workspaceVideoUrl: string | null;
    hostWhatsapp: string;
    directBookingUrl: string | null;
    exactAddress: string | null;
    checkinInstructionsEn: string | null;
    checkinInstructionsVi: string | null;
    notifications: Array<{
      id: string;
      channel: string;
      subject: string;
      status: string;
      createdAt: string;
    }>;
  }>;
  savedStays: Array<{
    id: string;
    slug: string;
    titleEn: string;
    titleVi: string;
    heroImage: string;
    wifiDownloadMbps: number;
    destinationNameEn: string;
    destinationNameVi: string;
    monthDisplayVnd: number;
  }>;
  rsvps: Array<{
    id: string;
    titleEn: string;
    titleVi: string;
    cityEn: string;
    cityVi: string;
    eventDate: string;
    venueEn: string;
    venueVi: string;
  }>;
}

export function MemberDashboardClient({
  user,
  data,
}: {
  user: SessionUser;
  data: MemberDashboardData;
}) {
  const { locale, currency } = usePreferences();
  const isVi = locale === 'vi';
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');

  async function handlePayFee(bookingId: string) {
    setBusyId(bookingId);
    setNotice('');
    try {
      const res = await fetch(`/api/bookings/${bookingId}/pay`, { method: 'POST' });
      const json = await res.json();
      if (!json.ok) {
        setNotice(json.error?.message ?? (isVi ? 'Thanh toán thất bại.' : 'Payment failed.'));
      } else {
        setNotice(
          isVi
            ? `Đã thanh toán ${formatMoneyFromVnd(json.payment.feePaidOnlineVnd, currency)} và khóa phòng thành công.`
            : `Paid ${formatMoneyFromVnd(json.payment.feePaidOnlineVnd, currency)}. Dates are locked and your Wi-Fi certificate is ready.`
        );
        window.location.reload();
      }
    } finally {
      setBusyId(null);
    }
  }

  async function handleWifiMismatchRefund(bookingId: string) {
    const reason = window.prompt(
      isVi
        ? 'Mô tả ngắn sự cố Wi-Fi hoặc bàn làm việc để nhận hoàn lại 100% phí giữ chỗ:'
        : 'Describe the Wi-Fi speed or desk issue to claim your 100% fee refund:',
      'On-site speedtest below certified Mbps at check-in'
    );
    if (!reason) return;
    setBusyId(bookingId);
    setNotice('');
    try {
      const res = await fetch(`/api/bookings/${bookingId}/mismatch-refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      const json = await res.json();
      if (!json.ok) {
        setNotice(json.error?.message ?? (isVi ? 'Không thể gửi yêu cầu hoàn tiền.' : 'Refund request failed.'));
      } else {
        setNotice(
          isVi
            ? `Đã hoàn lại 100% phí giữ chỗ (${formatMoneyFromVnd(json.refund.refundAmountVnd, currency)}).`
            : `100% booking fee refund processed (${formatMoneyFromVnd(json.refund.refundAmountVnd, currency)}).`
        );
        window.location.reload();
      }
    } finally {
      setBusyId(null);
    }
  }

  async function handleCancel(bookingId: string) {
    setBusyId(bookingId);
    setNotice('');
    try {
      const res = await fetch(`/api/bookings/${bookingId}/cancel`, { method: 'POST' });
      const json = await res.json();
      if (!json.ok) {
        setNotice(json.error?.message ?? (isVi ? 'Không thể hủy đặt phòng.' : 'Could not cancel booking.'));
      } else {
        const out = json.outcome;
        setNotice(
          isVi
            ? `Đã hủy đặt phòng. Hoàn tiền mặt: ${formatMoneyFromVnd(out.refundAmountVnd, currency)}, tiền thưởng hoàn lại: ${formatMoneyFromVnd(out.creditIssuedVnd, currency)}.`
            : `Booking cancelled. Cash refund: ${formatMoneyFromVnd(out.refundAmountVnd, currency)}, account credit: ${formatMoneyFromVnd(out.creditIssuedVnd, currency)}.`
        );
        window.location.reload();
      }
    } finally {
      setBusyId(null);
    }
  }

  function renderStatusBadge(status: string) {
    const map: Record<string, string> = {
      RESERVED_LOCKED: 'bg-[#E7F1EC] text-[#164E3F]',
      CHECKED_IN_COMPLETED: 'bg-[#164E3F] text-white',
      PENDING_PAYMENT: 'bg-[#FAF8F3] text-[#A67C2E] border border-[#A67C2E]/35',
      REFUNDED_WIFI_MISMATCH: 'bg-[#FAEDE5] text-[#C25E28]',
      confirmed: 'bg-[#E7F1EC] text-[#164E3F]',
      cancelled: 'bg-[#FAEDE5] text-[#C25E28]',
    };
    return map[status] ?? 'bg-[#F2EDE3] text-[#17221E]';
  }

  return (
    <div className="mx-auto max-w-7xl space-y-10 px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-col justify-between gap-6 rounded-3xl border border-[#E5DFD3] bg-white p-6 sm:p-8 md:flex-row md:items-center lacquer-shadow">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[#E7F1EC] px-3 py-1 text-xs font-semibold text-[#164E3F]">
              {user.role === 'host'
                ? isVi
                  ? 'Chủ nhà'
                  : 'Host'
                : user.role === 'admin'
                  ? isVi
                    ? 'Quản trị viên'
                    : 'Admin'
                  : isVi
                    ? 'Thành viên'
                    : 'Member'}
            </span>
            {user.membershipTier === 'premium' ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#A67C2E] px-3 py-1 text-xs font-semibold text-white">
                <Sparkles className="h-3.5 w-3.5" /> {isVi ? 'Thẻ hội viên Premium' : 'Nomad Pass Premium'}
              </span>
            ) : (
              <Link
                href="/membership"
                className="rounded-full border border-[#A67C2E]/40 px-3 py-1 text-xs font-semibold text-[#A67C2E] hover:bg-[#FAF8F3]"
              >
                {isVi ? 'Nâng cấp thẻ hội viên (Hoàn 4%)' : 'Upgrade to Nomad Pass (4% back)'}
              </Link>
            )}
          </div>
          <h1 className="font-serif-display mt-2 text-3xl font-semibold text-[#17221E]">
            {user.fullName}
          </h1>
          <p className="text-xs text-[#53635D]">
            {user.email}, {user.nationality}
            {user.vatTaxId ? `, ${isVi ? 'Mã số thuế:' : 'VAT ID:'} ${user.vatTaxId}` : ''}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="rounded-2xl bg-[#FAF8F3] px-5 py-3">
            <div className="flex items-center gap-1.5 text-xs text-[#53635D]">
              <Wallet className="h-4 w-4 text-[#164E3F]" />
              {isVi ? 'Số dư tiền thưởng' : 'Reward credit'}
            </div>
            <div className="font-serif-display text-2xl font-bold text-[#164E3F]">
              {formatMoneyFromVnd(user.rewardCreditVnd, currency)}
            </div>
          </div>
          {user.role === 'host' && (
            <Link
              href="/host"
              className="flex items-center rounded-2xl bg-[#164E3F] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0F392E]"
            >
              {isVi ? 'Vào trang quản lý nhà' : 'Open Host Portal'}
            </Link>
          )}
          {user.role === 'admin' && (
            <Link
              href="/admin"
              className="flex items-center rounded-2xl bg-[#C25E28] px-5 py-3 text-sm font-semibold text-white hover:bg-[#ad5020]"
            >
              {isVi ? 'Vào trang kiểm duyệt' : 'Open Admin Portal'}
            </Link>
          )}
        </div>
      </div>

      {notice && (
        <div className="rounded-2xl border border-[#164E3F]/30 bg-[#E7F1EC] p-4 text-sm font-medium text-[#164E3F]">
          {notice}
        </div>
      )}

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-serif-display text-2xl font-semibold text-[#17221E]">
            {isVi ? 'Đơn đặt phòng và chứng nhận Wi-Fi' : 'Your stays and Wi-Fi certificates'}
          </h2>
          <Link href="/stays" className="text-sm font-semibold text-[#164E3F] hover:underline">
            {isVi ? 'Tìm thêm chỗ ở' : 'Find another stay'}
          </Link>
        </div>

        {data.bookings.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#E5DFD3] bg-white p-8 text-center text-sm text-[#53635D]">
            {isVi ? 'Bạn chưa có đặt phòng nào.' : 'You have no bookings yet. Pick a city to start your next stay.'}
          </div>
        ) : (
          <div className="grid gap-5">
            {data.bookings.map((b) => {
              const isActive =
                b.status === 'RESERVED_LOCKED' || b.status === 'confirmed';
              const hostDigits = b.hostWhatsapp.replace(/\D/g, '') || '84901234567';
              const hostWhatsappUrl = `https://wa.me/${hostDigits}?text=${encodeURIComponent(
                `Hi! Regarding booking ${b.bookingCode} (${b.titleEn}, check-in ${b.checkIn}).`
              )}`;

              return (
                <div
                  key={b.id}
                  className="grid gap-5 rounded-3xl border border-[#E5DFD3] bg-white p-5 sm:grid-cols-12"
                >
                  <div className="overflow-hidden rounded-2xl sm:col-span-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={b.heroImage}
                      alt={isVi ? b.titleVi : b.titleEn}
                      className="aspect-[4/3] h-full w-full object-cover"
                    />
                  </div>
                  <div className="space-y-3 sm:col-span-9">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                          <span className="rounded-full bg-[#164E3F] px-2.5 py-0.5 text-white">
                            {b.bookingCode}
                          </span>
                          <span className={`rounded-full px-2.5 py-0.5 ${renderStatusBadge(b.status)}`}>
                            {formatBookingStatusLabel(b.status, locale)}
                          </span>
                          <span className="text-[#53635D]">
                            <Wifi className="mr-1 inline h-3.5 w-3.5 text-[#164E3F]" />
                            {b.wifiDownloadMbps}/{b.wifiUploadMbps} Mbps ({b.wifiJitterMs}ms)
                          </span>
                        </div>
                        <Link
                          href={`/stays/${b.staySlug}`}
                          className="font-serif-display mt-1 block text-2xl font-semibold text-[#17221E] hover:text-[#164E3F]"
                        >
                          {isVi ? b.titleVi : b.titleEn}
                        </Link>
                        <div className="text-xs text-[#53635D]">
                          {isVi ? b.destinationNameVi : b.destinationNameEn},{' '}
                          {isVi ? b.roomNameVi : b.roomNameEn}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-lg font-bold text-[#17221E]">
                          {formatMoneyFromVnd(b.guestTotalVnd, currency)}
                        </div>
                        <div className="text-xs text-[#53635D]">
                          {b.nights} {isVi ? 'đêm' : 'nights'}, {b.checkIn} {isVi ? 'đến' : 'to'} {b.checkOut}
                        </div>
                      </div>
                    </div>

                    {b.businessModel === 'booking_flow' && (
                      <div className="grid gap-2 rounded-2xl bg-[#FAF8F3] p-3 text-xs sm:grid-cols-3">
                        <div>
                          <span className="text-[#53635D]">
                            {b.status === 'PENDING_PAYMENT'
                              ? isVi
                                ? 'Cần trả online (12%):'
                                : 'Due online (12% fee):'
                              : isVi
                                ? 'Đã trả online (12%):'
                                : 'Paid online (12% fee):'}
                          </span>{' '}
                          <strong className="text-[#164E3F]">
                            {formatMoneyFromVnd(b.feeOnlineVnd, currency)}
                          </strong>
                        </div>
                        <div>
                          <span className="text-[#53635D]">
                            {b.status === 'CHECKED_IN_COMPLETED'
                              ? isVi
                                ? 'Đã trả chủ nhà:'
                                : 'Paid to host:'
                              : isVi
                                ? 'Trả chủ nhà khi nhận phòng:'
                                : 'Pay host at check-in:'}
                          </span>{' '}
                          <strong className="text-[#17221E]">
                            {formatMoneyFromVnd(b.payAtCheckinVnd, currency)}
                          </strong>
                        </div>
                        <div>
                          <span className="text-[#53635D]">
                            {isVi ? 'Tổng chi phí:' : 'Total cost:'}
                          </span>{' '}
                          <strong>{formatMoneyFromVnd(b.guestTotalVnd, currency)}</strong>
                        </div>
                      </div>
                    )}

                    {b.status === 'PENDING_PAYMENT' && (
                      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#A67C2E]/35 bg-[#FAF8F3] p-3.5 text-xs">
                        <span className="text-[#17221E]">
                          {isVi
                            ? 'Trả phí giữ chỗ 12% để khóa lịch phòng và mở khóa địa chỉ thật.'
                            : 'Pay the 12% booking fee to lock your dates and unlock the address.'}
                        </span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={busyId === b.id}
                            onClick={() => handlePayFee(b.id)}
                            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-[#C25E28] px-4 py-2 font-bold text-white"
                          >
                            <CreditCard className="h-3.5 w-3.5" />
                            {isVi
                              ? `Thanh toán ${formatMoneyFromVnd(b.feeOnlineVnd, currency)}`
                              : `Pay ${formatMoneyFromVnd(b.feeOnlineVnd, currency)}`}
                          </button>
                          <button
                            type="button"
                            disabled={busyId === b.id}
                            onClick={() => handleCancel(b.id)}
                            className="rounded-xl border border-[#E5DFD3] px-3 py-2 font-semibold text-[#53635D]"
                          >
                            {isVi ? 'Hủy' : 'Cancel'}
                          </button>
                        </div>
                      </div>
                    )}

                    {b.exactAddress && (
                      <div className="space-y-2 rounded-2xl border border-[#164E3F]/20 bg-[#FAF8F3] p-4 text-xs">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 font-semibold text-[#164E3F]">
                            <KeyRound className="h-4 w-4" />
                            {isVi
                              ? 'Địa chỉ nhận phòng và chứng nhận Wi-Fi'
                              : 'Address, check-in guide, and Wi-Fi certificate'}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {b.speedtestProofUrl && (
                              <a
                                href={b.speedtestProofUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 rounded-lg bg-[#E7F1EC] px-2.5 py-1 font-semibold text-[#164E3F]"
                              >
                                <ShieldCheck className="h-3.5 w-3.5" />
                                {isVi ? 'Xem chứng nhận Wi-Fi' : 'View Wi-Fi certificate'}
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                            <a
                              href={hostWhatsappUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-lg bg-[#25D366]/20 px-2.5 py-1 font-semibold text-[#0F392E]"
                            >
                              <MessageCircle className="h-3.5 w-3.5 text-[#164E3F]" />
                              {isVi ? 'Nhắn chủ nhà' : 'Host WhatsApp'} ({b.hostWhatsapp})
                            </a>
                          </div>
                        </div>
                        <div className="font-medium text-[#17221E]">
                          <MapPin className="mr-1 inline h-3.5 w-3.5 text-[#C25E28]" />
                          {b.exactAddress}
                        </div>
                        <p className="text-[#53635D]">
                          {isVi ? b.checkinInstructionsVi : b.checkinInstructionsEn}
                        </p>
                      </div>
                    )}

                    {b.status === 'direct_referral' && b.directBookingUrl && (
                      <div className="rounded-2xl bg-[#FAEDE5] p-3 text-xs text-[#C25E28]">
                        {isVi ? 'Trang đặt phòng chủ nhà:' : 'Host booking link:'}{' '}
                        <span className="font-semibold underline">{b.directBookingUrl}</span>
                      </div>
                    )}

                    {b.status === 'REFUNDED_WIFI_MISMATCH' && (
                      <div className="rounded-2xl bg-[#FAEDE5] p-3 text-xs text-[#C25E28]">
                        <strong>{isVi ? 'Đã hoàn 100% phí giữ chỗ:' : '100% fee refunded:'}</strong>{' '}
                        {formatMoneyFromVnd(b.refundAmountVnd, currency)} ({b.mismatchReason})
                      </div>
                    )}

                    {b.status === 'cancelled' && (
                      <div className="rounded-2xl bg-[#F2EDE3] p-3 text-xs text-[#17221E]">
                        {isVi
                          ? `Hoàn tiền mặt: ${formatMoneyFromVnd(b.refundAmountVnd, currency)}, tiền thưởng hoàn lại: ${formatMoneyFromVnd(b.creditIssuedVnd, currency)}`
                          : `Cash refund: ${formatMoneyFromVnd(b.refundAmountVnd, currency)}, account credit: ${formatMoneyFromVnd(b.creditIssuedVnd, currency)}`}
                      </div>
                    )}

                    {isActive && (
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        <span className="text-xs text-[#53635D]">
                          <CheckCircle2 className="mr-1 inline h-3.5 w-3.5 text-[#164E3F]" />
                          {isVi
                            ? `Chính sách hủy: ${formatCancellationPolicyLabel(b.cancellationPolicy, locale)}. Hoàn 100% phí nếu Wi-Fi sai cam kết.`
                            : `Cancellation: ${formatCancellationPolicyLabel(b.cancellationPolicy, locale)}. Protected by 100% Wi-Fi refund guarantee.`}
                        </span>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={busyId === b.id}
                            onClick={() => handleWifiMismatchRefund(b.id)}
                            className="inline-flex min-h-[36px] items-center gap-1 rounded-xl border border-[#A67C2E]/40 bg-[#FAF8F3] px-3 py-1.5 text-xs font-semibold text-[#A67C2E] hover:bg-[#F2EDE3]"
                          >
                            <AlertTriangle className="h-3.5 w-3.5" />
                            {isVi ? 'Báo Wi-Fi chậm (Hoàn 100%)' : 'Report slow Wi-Fi (100% refund)'}
                          </button>
                          <button
                            type="button"
                            disabled={busyId === b.id}
                            onClick={() => handleCancel(b.id)}
                            className="min-h-[36px] rounded-xl border border-[#C25E28]/40 px-3.5 py-1.5 text-xs font-semibold text-[#C25E28] hover:bg-[#FAEDE5]"
                          >
                            {busyId === b.id
                              ? '...'
                              : isVi
                                ? 'Hủy đặt phòng'
                                : 'Cancel booking'}
                          </button>
                        </div>
                      </div>
                    )}

                    {b.notifications.length > 0 && (
                      <div className="border-t border-[#E5DFD3] pt-2 text-[11px] text-[#53635D]">
                        {isVi ? 'Xác nhận gần nhất:' : 'Latest update:'}{' '}
                        <span className="font-medium text-[#17221E]">{b.notifications[0].subject}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="rounded-3xl border border-[#E5DFD3] bg-white p-6">
          <h3 className="font-serif-display mb-4 flex items-center gap-2 text-xl font-semibold text-[#17221E]">
            <Bookmark className="h-5 w-5 text-[#C25E28]" />
            {isVi ? 'Chỗ ở đã lưu' : 'Saved stays'}
          </h3>
          {data.savedStays.length === 0 ? (
            <p className="text-sm text-[#53635D]">
              {isVi ? 'Bấm biểu tượng lưu trên thẻ chỗ ở để xem lại sau.' : 'Save any stay to compare or book later.'}
            </p>
          ) : (
            <div className="space-y-3">
              {data.savedStays.map((s) => (
                <Link
                  key={s.id}
                  href={`/stays/${s.slug}`}
                  className="flex items-center justify-between rounded-2xl bg-[#FAF8F3] p-3 hover:bg-[#E7F1EC]/50"
                >
                  <div>
                    <div className="font-semibold text-[#17221E]">{isVi ? s.titleVi : s.titleEn}</div>
                    <div className="text-xs text-[#53635D]">
                      {isVi ? s.destinationNameVi : s.destinationNameEn}, {s.wifiDownloadMbps} Mbps
                    </div>
                  </div>
                  <div className="text-sm font-bold text-[#164E3F]">
                    {formatMoneyFromVnd(s.monthDisplayVnd, currency)}/{isVi ? 'tháng' : 'mo'}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-[#E5DFD3] bg-white p-6">
          <h3 className="font-serif-display mb-4 flex items-center gap-2 text-xl font-semibold text-[#17221E]">
            <Calendar className="h-5 w-5 text-[#164E3F]" />
            {isVi ? 'Sự kiện đã đăng ký' : 'Your meetup RSVPs'}
          </h3>
          {data.rsvps.length === 0 ? (
            <div className="space-y-2 text-sm text-[#53635D]">
              <p>{isVi ? 'Bạn chưa đăng ký sự kiện nào.' : 'No meetup RSVPs yet.'}</p>
              <Link href="/community" className="inline-block font-semibold text-[#164E3F] hover:underline">
                {isVi ? 'Xem lịch sự kiện cộng đồng' : 'Browse upcoming meetups'}
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {data.rsvps.map((ev) => (
                <div key={ev.id} className="rounded-2xl bg-[#FAF8F3] p-3">
                  <div className="font-semibold text-[#17221E]">{isVi ? ev.titleVi : ev.titleEn}</div>
                  <div className="text-xs text-[#53635D]">
                    {ev.eventDate}, {isVi ? ev.venueVi : ev.venueEn}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
