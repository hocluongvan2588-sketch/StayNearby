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
import { formatMoneyFromVnd } from '@/lib/i18n';
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
        setNotice(json.error?.message ?? 'Payment failed.');
      } else {
        setNotice(
          isVi
            ? `Đã thanh toán ${formatMoneyFromVnd(json.payment.feePaidOnlineVnd, currency)} và khóa phòng thành công!`
            : `12% reservation fee paid (${formatMoneyFromVnd(json.payment.feePaidOnlineVnd, currency)}). Dates locked & Wi-Fi Certificate issued!`
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
        ? 'Mô tả nhanh sự cố Wi-Fi hoặc bàn làm việc tại chỗ để hoàn 100% phí 12%:'
        : 'Briefly describe the Wi-Fi speed or workspace mismatch to trigger your 100% fee refund:',
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
        setNotice(json.error?.message ?? 'Refund trigger failed.');
      } else {
        setNotice(
          isVi
            ? `Đã hoàn 100% phí giữ chỗ (${formatMoneyFromVnd(json.refund.refundAmountVnd, currency)}) theo cam kết Wi-Fi Guarantee.`
            : `100% Booking Fee Refund processed (${formatMoneyFromVnd(json.refund.refundAmountVnd, currency)}) under Wi-Fi Guarantee.`
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
        setNotice(json.error?.message ?? 'Could not cancel booking.');
      } else {
        const out = json.outcome;
        setNotice(
          isVi
            ? `Đã hủy đặt phòng (${out.tier}). Hoàn tiền: ${formatMoneyFromVnd(out.refundAmountVnd, currency)}, Account Credit: ${formatMoneyFromVnd(out.creditIssuedVnd, currency)}.`
            : `Cancelled (${out.tier}). Cash refund: ${formatMoneyFromVnd(out.refundAmountVnd, currency)}, Account Credit issued: ${formatMoneyFromVnd(out.creditIssuedVnd, currency)}.`
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
      {/* Member Header & Wallet KPIs */}
      <div className="flex flex-col justify-between gap-6 rounded-3xl border border-[#E5DFD3] bg-white p-6 sm:p-8 md:flex-row md:items-center lacquer-shadow">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[#E7F1EC] px-3 py-1 text-xs font-semibold text-[#164E3F] uppercase">
              {user.role}
            </span>
            {user.membershipTier === 'premium' ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#A67C2E] px-3 py-1 text-xs font-semibold text-white">
                <Sparkles className="h-3.5 w-3.5" /> Nomad Pass Premium
              </span>
            ) : (
              <Link
                href="/membership"
                className="rounded-full border border-[#A67C2E]/40 px-3 py-1 text-xs font-semibold text-[#A67C2E] hover:bg-[#FAF8F3]"
              >
                {isVi ? 'Nâng cấp Premium (Hoàn 4%)' : 'Upgrade to Premium (4% Back)'}
              </Link>
            )}
          </div>
          <h1 className="font-serif-display mt-2 text-3xl font-semibold text-[#17221E]">
            {user.fullName}
          </h1>
          <p className="text-xs text-[#53635D]">
            {user.email} · {user.nationality}
            {user.vatTaxId ? ` · VAT ID: ${user.vatTaxId}` : ''}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="rounded-2xl bg-[#FAF8F3] px-5 py-3">
            <div className="flex items-center gap-1.5 text-xs text-[#53635D]">
              <Wallet className="h-4 w-4 text-[#164E3F]" />
              {isVi ? 'Ví Reward Credit' : 'Reward Credit Balance'}
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
              {isVi ? 'Mở Cổng Chủ nhà →' : 'Open Host Console →'}
            </Link>
          )}
          {user.role === 'admin' && (
            <Link
              href="/admin"
              className="flex items-center rounded-2xl bg-[#C25E28] px-5 py-3 text-sm font-semibold text-white hover:bg-[#ad5020]"
            >
              {isVi ? 'Mở Admin & CRM →' : 'Open Admin & CRM →'}
            </Link>
          )}
        </div>
      </div>

      {notice && (
        <div className="rounded-2xl border border-[#164E3F]/30 bg-[#E7F1EC] p-4 text-sm font-medium text-[#164E3F]">
          {notice}
        </div>
      )}

      {/* Bookings & Unlocked Check-In Instructions */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-serif-display text-2xl font-semibold text-[#17221E]">
            {isVi ? 'Lịch lưu trú & Chứng nhận Wi-Fi' : 'Your Extended Stays & Wi-Fi Certificates'}
          </h2>
          <Link href="/stays" className="text-sm font-semibold text-[#164E3F] hover:underline">
            {isVi ? '+ Đặt thêm chỗ ở' : '+ Book another base'}
          </Link>
        </div>

        {data.bookings.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#E5DFD3] bg-white p-8 text-center text-sm text-[#53635D]">
            {isVi ? 'Bạn chưa có đặt phòng nào.' : 'No bookings yet. Explore work-ready Vietnam stays to lock your first week or month.'}
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
                          <span className={`rounded-full px-2.5 py-0.5 uppercase ${renderStatusBadge(b.status)}`}>
                            {b.status}
                          </span>
                          <span className="text-[#53635D]">
                            <Wifi className="mr-1 inline h-3.5 w-3.5 text-[#164E3F]" />
                            {b.wifiDownloadMbps}↓ / {b.wifiUploadMbps}↑ Mbps ({b.wifiJitterMs}ms)
                          </span>
                        </div>
                        <Link
                          href={`/stays/${b.staySlug}`}
                          className="font-serif-display mt-1 block text-2xl font-semibold text-[#17221E] hover:text-[#164E3F]"
                        >
                          {isVi ? b.titleVi : b.titleEn}
                        </Link>
                        <div className="text-xs text-[#53635D]">
                          {isVi ? b.destinationNameVi : b.destinationNameEn} ·{' '}
                          {isVi ? b.roomNameVi : b.roomNameEn}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-lg font-bold text-[#17221E]">
                          {formatMoneyFromVnd(b.guestTotalVnd, currency)}
                        </div>
                        <div className="text-xs text-[#53635D]">
                          {b.nights} {isVi ? 'đêm' : 'nights'} · {b.checkIn} → {b.checkOut}
                        </div>
                      </div>
                    </div>

                    {/* Financial Split Summary */}
                    {b.businessModel === 'booking_flow' && (
                      <div className="grid gap-2 rounded-2xl bg-[#FAF8F3] p-3 text-xs sm:grid-cols-3">
                        <div>
                          <span className="text-[#53635D]">
                            {b.status === 'PENDING_PAYMENT'
                              ? isVi
                                ? 'Chờ thanh toán (12%):'
                                : 'Due Online (12% Fee):'
                              : isVi
                                ? 'Đã trả Online (12%):'
                                : 'Paid Online (12% Fee):'}
                          </span>{' '}
                          <strong className="text-[#164E3F]">
                            {formatMoneyFromVnd(b.feeOnlineVnd, currency)}
                          </strong>
                        </div>
                        <div>
                          <span className="text-[#53635D]">
                            {b.status === 'CHECKED_IN_COMPLETED'
                              ? isVi
                                ? 'Đã trả Chủ nhà:'
                                : 'Paid Direct to Host:'
                              : isVi
                                ? 'Trả Chủ nhà khi nhận phòng:'
                                : 'Due at Check-in (Host):'}
                          </span>{' '}
                          <strong className="text-[#17221E]">
                            {formatMoneyFromVnd(b.payAtCheckinVnd, currency)}
                          </strong>
                        </div>
                        <div>
                          <span className="text-[#53635D]">
                            {isVi ? 'Tổng kỳ lưu trú:' : 'All-Inclusive Total:'}
                          </span>{' '}
                          <strong>{formatMoneyFromVnd(b.guestTotalVnd, currency)}</strong>
                        </div>
                      </div>
                    )}

                    {/* Pending 12% Payment Action */}
                    {b.status === 'PENDING_PAYMENT' && (
                      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#A67C2E]/35 bg-[#FAF8F3] p-3.5 text-xs">
                        <span className="text-[#17221E]">
                          {isVi
                            ? 'Hoàn tất thanh toán phí giữ chỗ 12% để khóa lịch phòng & nhận địa chỉ.'
                            : 'Complete the 12% reservation fee to lock dates and unlock address + Wi-Fi Certificate.'}
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
                              : `Pay ${formatMoneyFromVnd(b.feeOnlineVnd, currency)} Now`}
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

                    {/* Unlocked Address, Wi-Fi Verification Certificate & Host WhatsApp */}
                    {b.exactAddress && (
                      <div className="space-y-2 rounded-2xl border border-[#164E3F]/20 bg-[#FAF8F3] p-4 text-xs">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 font-semibold text-[#164E3F]">
                            <KeyRound className="h-4 w-4" />
                            {isVi
                              ? 'Địa chỉ, Hướng dẫn nhận phòng & Chứng nhận Wi-Fi'
                              : 'Unlocked Address, Check-in & Wi-Fi Verification Certificate'}
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
                                {isVi ? 'Chứng nhận Speedtest' : 'Wi-Fi Certificate'}
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
                              Host WhatsApp ({b.hostWhatsapp})
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
                        StayDirect™ 0% Markup referral link:{' '}
                        <span className="font-semibold underline">{b.directBookingUrl}</span>
                      </div>
                    )}

                    {b.status === 'REFUNDED_WIFI_MISMATCH' && (
                      <div className="rounded-2xl bg-[#FAEDE5] p-3 text-xs text-[#C25E28]">
                        <strong>100% Wi-Fi Guarantee Refunded:</strong>{' '}
                        {formatMoneyFromVnd(b.refundAmountVnd, currency)} — {b.mismatchReason}
                      </div>
                    )}

                    {b.status === 'cancelled' && (
                      <div className="rounded-2xl bg-[#F2EDE3] p-3 text-xs text-[#17221E]">
                        {isVi
                          ? `Hoàn tiền: ${formatMoneyFromVnd(b.refundAmountVnd, currency)} · Account Credit cấp thêm: ${formatMoneyFromVnd(b.creditIssuedVnd, currency)}`
                          : `Cash refund: ${formatMoneyFromVnd(b.refundAmountVnd, currency)} · Account Credit issued: ${formatMoneyFromVnd(b.creditIssuedVnd, currency)}`}
                      </div>
                    )}

                    {isActive && (
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        <span className="text-xs text-[#53635D]">
                          <CheckCircle2 className="mr-1 inline h-3.5 w-3.5 text-[#164E3F]" />
                          {isVi
                            ? `Chính sách ${b.cancellationPolicy} + Bảo chứng hoàn 100% phí giữ chỗ nếu Wi-Fi sai cam kết.`
                            : `${b.cancellationPolicy} policy + 100% Wi-Fi Guarantee refund protection.`}
                        </span>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={busyId === b.id}
                            onClick={() => handleWifiMismatchRefund(b.id)}
                            className="inline-flex min-h-[36px] items-center gap-1 rounded-xl border border-[#A67C2E]/40 bg-[#FAF8F3] px-3 py-1.5 text-xs font-semibold text-[#A67C2E] hover:bg-[#F2EDE3]"
                          >
                            <AlertTriangle className="h-3.5 w-3.5" />
                            {isVi ? 'Báo Wi-Fi sai cam kết (Hoàn 100%)' : 'Wi-Fi Mismatch (100% Refund)'}
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
                                : 'Cancel Booking'}
                          </button>
                        </div>
                      </div>
                    )}

                    {b.notifications.length > 0 && (
                      <div className="border-t border-[#E5DFD3] pt-2 text-[11px] text-[#53635D]">
                        Latest confirmation: <span className="font-medium text-[#17221E]">{b.notifications[0].subject}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Saved Stays & Event RSVPs */}
      <div className="grid gap-8 lg:grid-cols-2">
        <section className="rounded-3xl border border-[#E5DFD3] bg-white p-6">
          <h3 className="font-serif-display mb-4 flex items-center gap-2 text-xl font-semibold text-[#17221E]">
            <Bookmark className="h-5 w-5 text-[#C25E28]" />
            {isVi ? 'Chỗ ở đã lưu' : 'Saved Favourites'}
          </h3>
          {data.savedStays.length === 0 ? (
            <p className="text-sm text-[#53635D]">
              {isVi ? 'Bấm biểu tượng đánh dấu trên thẻ chỗ ở để lưu.' : 'Bookmark any stay card to compare later.'}
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
                      {isVi ? s.destinationNameVi : s.destinationNameEn} · {s.wifiDownloadMbps} Mbps
                    </div>
                  </div>
                  <div className="text-sm font-bold text-[#164E3F]">
                    {formatMoneyFromVnd(s.monthDisplayVnd, currency)}/mo
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-[#E5DFD3] bg-white p-6">
          <h3 className="font-serif-display mb-4 flex items-center gap-2 text-xl font-semibold text-[#17221E]">
            <Calendar className="h-5 w-5 text-[#164E3F]" />
            {isVi ? 'Lịch Vietnam Brunch Club đã đăng ký' : 'My Nomad Brunch Club RSVPs'}
          </h3>
          {data.rsvps.length === 0 ? (
            <div className="space-y-2 text-sm text-[#53635D]">
              <p>{isVi ? 'Chưa đăng ký buổi gặp mặt nào.' : 'No meetup RSVPs yet.'}</p>
              <Link href="/community" className="inline-block font-semibold text-[#164E3F] hover:underline">
                {isVi ? 'Xem lịch Meetup tại Việt Nam →' : 'Browse Vietnam Brunch Club →'}
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {data.rsvps.map((ev) => (
                <div key={ev.id} className="rounded-2xl bg-[#FAF8F3] p-3">
                  <div className="font-semibold text-[#17221E]">{isVi ? ev.titleVi : ev.titleEn}</div>
                  <div className="text-xs text-[#53635D]">
                    {ev.eventDate} · {isVi ? ev.venueVi : ev.venueEn}
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
