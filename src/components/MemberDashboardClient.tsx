'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  Bookmark,
  Calendar,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  KeyRound,
  LifeBuoy,
  MapPin,
  MessageCircle,
  Paperclip,
  Plus,
  RefreshCcw,
  Send,
  ShieldCheck,
  Sparkles,
  Tag,
  Wallet,
  Wifi,
} from 'lucide-react';
import type { SessionUser } from '@/lib/auth/session';
import {
  formatBookingStatusLabel,
  formatCancellationPolicyLabel,
  formatCountNoun,
  formatNightsLabel,
  formatPaymentAxisStatusLabel,
  formatRefundAxisStatusLabel,
  formatStayAxisStatusLabel,
} from '@/lib/i18n';
import { GatewayCheckoutPanel } from './GatewayCheckoutPanel';
import { usePreferences } from './PreferencesProvider';

export interface MemberDashboardData {
  bookings: Array<{
    id: string;
    stayId: string;
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
    bookingStatus: string;
    stayStatus: string;
    paymentStatus: string;
    payoutStatus: string;
    refundStatus: string;
    appliedServiceFeeRate: number;
    promotionCode: string | null;
    promotionDiscountVnd: number;
    promotionFundingSource: string | null;
    checkIn: string;
    checkOut: string;
    nights: number;
    guestsCount: number;
    wholesaleTotalVnd: number;
    serviceFeeVnd: number;
    feeOnlineVnd: number;
    payAtCheckinVnd: number;
    vatDiscountVnd: number;
    rewardCreditUsedVnd: number;
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
    isWifiVerified: boolean;
    isWorkReady: boolean;
    speedtestProofUrl: string | null;
    workspaceVideoUrl: string | null;
    hostWhatsapp: string;
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
    refundRequests: Array<{
      id: string;
      refundType: string;
      amountVnd: number;
      status: string;
      reason: string;
      decisionNote: string;
      createdAt: string;
      processedAt: string | null;
    }>;
  }>;
  supportTickets: Array<{
    id: string;
    ticketCode: string;
    category: string;
    issueSubCategory: string;
    priority: string;
    status: string;
    bookingId: string | null;
    bookingCode: string | null;
    stayId: string | null;
    stayTitleEn: string | null;
    stayTitleVi: string | null;
    subject: string;
    description: string;
    resolutionSummary: string;
    attachments: string[];
    messages: Array<{
      id: string;
      senderName: string;
      senderRole: string;
      body: string;
      attachments: string[];
      createdAt: string;
    }>;
    createdAt: string;
    updatedAt: string;
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
  const { locale, formatMoney, premiumRewardPct } = usePreferences();
  const isVi = locale === 'vi';
  const [busyId, setBusyId] = useState<string | null>(null);
  const [payingBookingId, setPayingBookingId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');

  // Unified Support Center state
  const [tickets, setTickets] = useState(data.supportTickets);
  const [ticketFormOpen, setTicketFormOpen] = useState(false);
  const [ticketCategory, setTicketCategory] = useState<
    'booking' | 'property_wifi' | 'payment' | 'general'
  >('property_wifi');
  const [ticketSubCategory, setTicketSubCategory] = useState('wifi_speed_mismatch');
  const [ticketBookingId, setTicketBookingId] = useState('');
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketDescription, setTicketDescription] = useState('');
  const [ticketAttachmentInput, setTicketAttachmentInput] = useState('');
  const [ticketAttachments, setTicketAttachments] = useState<string[]>([]);
  const [ticketSubmitting, setTicketSubmitting] = useState(false);
  const [ticketError, setTicketError] = useState('');
  const [expandedTicketId, setExpandedTicketId] = useState<string | null>(
    data.supportTickets[0]?.id ?? null
  );
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [replyBusyId, setReplyBusyId] = useState<string | null>(null);

  async function refreshTickets(selectId?: string) {
    const res = await fetch('/api/support/tickets');
    const json = await res.json().catch(() => null);
    if (res.ok && json?.ok && Array.isArray(json.tickets)) {
      setTickets(json.tickets);
      if (selectId) setExpandedTicketId(selectId);
    }
  }

  function openSupportForBooking(bookingId: string, bookingCode: string, stayTitle: string) {
    setTicketFormOpen(true);
    setTicketBookingId(bookingId);
    setTicketCategory('property_wifi');
    setTicketSubCategory('wifi_speed_mismatch');
    setTicketSubject(
      isVi ? `Hỗ trợ đơn ${bookingCode} (${stayTitle})` : `Support for ${bookingCode} (${stayTitle})`
    );
    setTicketError('');
    const el = document.getElementById('support-center');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  }

  function addAttachmentUrl() {
    const trimmed = ticketAttachmentInput.trim();
    if (!trimmed) return;
    if (
      !trimmed.startsWith('https://') &&
      !trimmed.startsWith('http://') &&
      !trimmed.startsWith('/api/uploads/') &&
      !trimmed.startsWith('/images/')
    ) {
      setTicketError(
        isVi
          ? 'Link đính kèm phải bắt đầu bằng https:// hoặc /api/uploads/.'
          : 'Attachment link must start with https:// or /api/uploads/.'
      );
      return;
    }
    if (ticketAttachments.length < 5 && !ticketAttachments.includes(trimmed)) {
      setTicketAttachments((prev) => [...prev, trimmed]);
      setTicketAttachmentInput('');
      setTicketError('');
    }
  }

  async function handleCreateTicket(e: React.FormEvent) {
    e.preventDefault();
    setTicketSubmitting(true);
    setTicketError('');
    try {
      const res = await fetch('/api/support/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: ticketCategory,
          issueSubCategory: ticketSubCategory,
          bookingId: ticketBookingId || null,
          subject: ticketSubject,
          description: ticketDescription,
          attachments: ticketAttachments,
        }),
      });
      const json = await res.json();
      if (!json.ok) {
        setTicketError(
          json.error?.message ?? (isVi ? 'Không thể tạo phiếu hỗ trợ.' : 'Could not create ticket.')
        );
        return;
      }
      setTicketSubject('');
      setTicketDescription('');
      setTicketAttachments([]);
      setTicketAttachmentInput('');
      setTicketFormOpen(false);
      await refreshTickets(json.ticket?.id);
    } finally {
      setTicketSubmitting(false);
    }
  }

  async function handleReplyTicket(e: React.FormEvent, ticketId: string) {
    e.preventDefault();
    const body = (replyDrafts[ticketId] ?? '').trim();
    if (body.length < 2) return;
    setReplyBusyId(ticketId);
    try {
      const res = await fetch(`/api/support/tickets/${ticketId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      });
      const json = await res.json();
      if (res.ok && json.ok) {
        setReplyDrafts((prev) => ({ ...prev, [ticketId]: '' }));
        await refreshTickets(ticketId);
      } else {
        setNotice(json?.error?.message ?? (isVi ? 'Không thể gửi tin nhắn.' : 'Failed to send reply.'));
      }
    } finally {
      setReplyBusyId(null);
    }
  }

  async function handleCancel(bookingId: string, bookingCode: string) {
    const confirmMsg = isVi
      ? `Hủy đặt phòng ${bookingCode}? Ngày ở sẽ được mở lại và việc hoàn tiền áp dụng theo chính sách hủy của chỗ ở.`
      : `Cancel booking ${bookingCode}? Your dates will be released and eligible refunds follow the property’s cancellation policy.`;
    if (typeof window !== 'undefined' && !window.confirm(confirmMsg)) {
      return;
    }
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
            ? `Đã hủy đặt phòng. Hoàn tiền mặt: ${formatMoney(out.refundAmountVnd)}, tiền thưởng hoàn lại: ${formatMoney(out.creditIssuedVnd)}.`
            : `Booking cancelled. Cash refund: ${formatMoney(out.refundAmountVnd)}, account credit: ${formatMoney(out.creditIssuedVnd)}.`
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

  function refundTimelineText(status: string) {
    if (status === 'completed' || status === 'refunded' || status === 'approved') {
      return isVi
        ? 'Đã duyệt hoàn tiền (3 đến 5 ngày làm việc qua phương thức thanh toán gốc)'
        : 'Approved / Completed (3–5 business days to original payment method)';
    }
    if (status === 'pending_review' || status === 'requested' || status === 'partial_refunded') {
      return isVi ? 'Đang kiểm tra bởi bộ phận Tài chính (1–2 ngày làm việc)' : 'Under Finance review (1–2 business days)';
    }
    if (status === 'rejected') {
      return isVi ? 'Từ chối theo chính sách hủy phòng' : 'Declined per cancellation policy';
    }
    return isVi ? 'Không phát sinh' : 'None';
  }

  function formatSupportStatusLabel(status: string) {
    const map: Record<string, { en: string; vi: string }> = {
      open: { en: 'Open', vi: 'Đang mở' },
      in_progress: { en: 'In progress', vi: 'Đang xử lý' },
      waiting_user: { en: 'Waiting for you', vi: 'Chờ phản hồi' },
      resolved: { en: 'Resolved', vi: 'Đã giải quyết' },
      closed: { en: 'Closed', vi: 'Đã đóng' },
    };
    return map[status]?.[locale] ?? status.replace('_', ' ');
  }

  return (
    <div className="mx-auto max-w-7xl space-y-10 px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-col justify-between gap-6 rounded-2xl border border-[#E5DFD3] bg-white p-6 sm:p-8 md:flex-row md:items-center">
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
                {isVi
                  ? `Nâng cấp thẻ hội viên (Hoàn ${premiumRewardPct}%)`
                  : `Upgrade to Nomad Pass (${premiumRewardPct}% back)`}
              </Link>
            )}
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#17221E] sm:text-3xl">
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
            <div className="text-2xl font-bold text-[#164E3F]">
              {formatMoney(user.rewardCreditVnd)}
            </div>
          </div>
          {user.role === 'host' && (
            <Link
              href="/host"
              className="flex items-center rounded-2xl bg-[#164E3F] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0F392E]"
            >
              {isVi ? 'Mở Kênh chủ nhà' : 'Open Host Console'}
            </Link>
          )}
          {user.role === 'admin' && (
            <Link
              href="/admin"
              className="flex items-center rounded-2xl bg-[#C25E28] px-5 py-3 text-sm font-semibold text-white hover:bg-[#ad5020]"
            >
              {isVi ? 'Mở Trang quản trị' : 'Open Admin'}
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
          <h2 className="text-xl font-semibold tracking-tight text-[#17221E] sm:text-2xl">
            {isVi ? 'Đơn đặt phòng và thông tin nhận phòng' : 'Your stays & check-in details'}
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
              const isActive = b.status === 'RESERVED_LOCKED' || b.status === 'confirmed';
              const bookingFeePct = Math.round((b.appliedServiceFeeRate || 0.12) * 100);
              const relatedTickets = tickets.filter((t) => t.bookingId === b.id);
              const hostDigits = b.hostWhatsapp.replace(/\D/g, '') || '84901234567';
              const hostWhatsappUrl = `https://wa.me/${hostDigits}?text=${encodeURIComponent(
                `Hi! Regarding booking ${b.bookingCode} (${b.titleEn}, check-in ${b.checkIn}).`
              )}`;

              return (
                <div
                  key={b.id}
                  className="grid gap-5 rounded-2xl border border-[#E5DFD3] bg-white p-5 sm:grid-cols-12"
                >
                  <div className="overflow-hidden rounded-xl sm:col-span-3">
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
                            {formatBookingStatusLabel(b.status, locale, bookingFeePct)}
                          </span>
                          {b.wifiDownloadMbps > 0 && (
                            <span className="text-[#53635D]">
                              <Wifi className="mr-1 inline h-3.5 w-3.5 text-[#164E3F]" />
                              {b.wifiDownloadMbps} Mbps
                            </span>
                          )}
                        </div>
                        <Link
                          href={`/stays/${b.staySlug}`}
                          className="mt-1.5 block text-xl font-semibold text-[#17221E] hover:text-[#164E3F]"
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
                          {formatMoney(b.guestTotalVnd)}
                        </div>
                        <div className="text-xs text-[#53635D]">
                          {formatNightsLabel(b.nights, locale)} · {b.checkIn} {isVi ? 'đến' : 'to'} {b.checkOut}
                        </div>
                      </div>
                    </div>

                    {/* 5-Axis Independent Lifecycle Strip (Read-Only from Backend State) */}
                    <div className="grid grid-cols-2 gap-2 rounded-2xl border border-[#E5DFD3] bg-[#FAF8F3]/70 p-3 text-[11px] sm:grid-cols-5">
                      <div>
                        <div className="text-[#53635D]">{isVi ? 'Trạng thái đơn' : 'Booking'}</div>
                        <div className="font-semibold text-[#17221E]">
                          {formatBookingStatusLabel(b.bookingStatus, locale, bookingFeePct)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[#53635D]">{isVi ? 'Lưu trú' : 'Stay'}</div>
                        <div className="font-semibold text-[#17221E]">
                          {formatStayAxisStatusLabel(b.stayStatus, locale)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[#53635D]">{isVi ? 'Thanh toán' : 'Payment'}</div>
                        <div className="font-semibold text-[#164E3F]">
                          {formatPaymentAxisStatusLabel(b.paymentStatus, locale)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[#53635D]">{isVi ? 'Hoàn tiền' : 'Refund'}</div>
                        <div className="font-semibold text-[#C25E28]">
                          {formatRefundAxisStatusLabel(b.refundStatus, locale)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[#53635D]">{isVi ? 'Yêu cầu hỗ trợ' : 'Support'}</div>
                        <div className="font-semibold text-[#17221E]">
                          {relatedTickets.length > 0
                            ? `${relatedTickets.length} (${formatSupportStatusLabel(relatedTickets[0].status)})`
                            : isVi
                              ? 'Không có'
                              : 'None'}
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-2 rounded-2xl bg-[#FAF8F3] p-3 text-xs sm:grid-cols-4">
                      <div>
                        <span className="text-[#53635D]">
                          {b.status === 'PENDING_PAYMENT'
                            ? isVi
                              ? `Cần trả online (${bookingFeePct}%):`
                              : `Due online (${bookingFeePct}%):`
                            : isVi
                              ? `Đã trả online (${bookingFeePct}%):`
                              : `Paid online (${bookingFeePct}%):`}
                        </span>{' '}
                        <strong className="text-[#164E3F]">{formatMoney(b.feeOnlineVnd)}</strong>
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
                        <strong className="text-[#17221E]">{formatMoney(b.payAtCheckinVnd)}</strong>
                      </div>
                      {b.promotionDiscountVnd > 0 && (
                        <div>
                          <span className="inline-flex items-center gap-1 text-[#164E3F]">
                            <Tag className="h-3 w-3" />
                            {b.promotionCode}:
                          </span>{' '}
                          <strong className="text-[#164E3F]">-{formatMoney(b.promotionDiscountVnd)}</strong>
                        </div>
                      )}
                      <div>
                        <span className="text-[#53635D]">{isVi ? 'Tổng chi phí:' : 'Total cost:'}</span>{' '}
                        <strong>{formatMoney(b.guestTotalVnd)}</strong>
                      </div>
                    </div>

                    {b.status === 'PENDING_PAYMENT' && (
                      <div className="space-y-3 rounded-2xl border border-[#A67C2E]/35 bg-[#FAF8F3] p-3.5 text-xs">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <span className="text-[#17221E]">
                            {isVi
                              ? `Thanh toán ${bookingFeePct}% phí dịch vụ online để xác nhận đặt phòng và xem địa chỉ cụ thể.`
                              : `Pay the ${bookingFeePct}% service fee online to confirm your booking and view the exact address.`}
                          </span>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              disabled={busyId === b.id}
                              onClick={() =>
                                setPayingBookingId(payingBookingId === b.id ? null : b.id)
                              }
                              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-[#C25E28] px-4 py-2 font-bold text-white"
                            >
                              <CreditCard className="h-3.5 w-3.5" />
                              {payingBookingId === b.id
                                ? isVi
                                  ? 'Ẩn thanh toán'
                                  : 'Hide payment'
                                : isVi
                                  ? `Thanh toán ${formatMoney(b.feeOnlineVnd)}`
                                  : `Pay ${formatMoney(b.feeOnlineVnd)}`}
                            </button>
                            <button
                              type="button"
                              disabled={busyId === b.id}
                              onClick={() => handleCancel(b.id, b.bookingCode)}
                              className="rounded-xl border border-[#E5DFD3] px-3 py-2 font-semibold text-[#53635D]"
                            >
                              {isVi ? 'Hủy' : 'Cancel'}
                            </button>
                          </div>
                        </div>
                        {payingBookingId === b.id && (
                          <GatewayCheckoutPanel
                            purpose="booking_fee"
                            bookingId={b.id}
                            amountVnd={b.feeOnlineVnd}
                            title={
                              isVi
                                ? `Thanh toán giữ chỗ (${b.bookingCode})`
                                : `Pay reservation fee (${b.bookingCode})`
                            }
                            subtitle={
                              isVi
                                ? 'Chọn VietQR hoặc thẻ quốc tế Stripe để hoàn tất giữ chỗ.'
                                : 'Choose VietQR or Stripe card checkout to lock your stay.'
                            }
                            onPaid={() => {
                              setPayingBookingId(null);
                              window.location.reload();
                            }}
                          />
                        )}
                      </div>
                    )}

                    {b.exactAddress && (
                      <div className="space-y-2 rounded-2xl border border-[#164E3F]/20 bg-[#FAF8F3] p-4 text-xs">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 font-semibold text-[#164E3F]">
                            <KeyRound className="h-4 w-4" />
                            {isVi
                              ? 'Địa chỉ nhận phòng & thông tin chỗ ở'
                              : 'Address & check-in guide'}
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
                                {b.isWifiVerified
                                  ? isVi
                                    ? 'Chứng nhận Wi-Fi'
                                    : 'Wi-Fi certificate'
                                  : isVi
                                    ? 'Hồ sơ Wi-Fi'
                                    : 'Wi-Fi profile'}
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

                    {/* Verified Refund History & Expected Timeline (Read-Only from DB) */}
                    {(b.refundRequests.length > 0 ||
                      b.refundAmountVnd > 0 ||
                      b.creditIssuedVnd > 0 ||
                      b.refundStatus !== 'none') && (
                      <div className="space-y-2 rounded-2xl border border-[#C25E28]/25 bg-[#FAEDE5]/60 p-3.5 text-xs">
                        <div className="flex flex-wrap items-center justify-between gap-2 font-semibold text-[#C25E28]">
                          <span className="inline-flex items-center gap-1.5">
                            <RefreshCcw className="h-3.5 w-3.5" />
                            {isVi ? 'Trạng thái & Lịch sử hoàn tiền' : 'Refund Status & History'}
                          </span>
                          <span>{formatRefundAxisStatusLabel(b.refundStatus, locale)}</span>
                        </div>
                        {(b.refundAmountVnd > 0 || b.creditIssuedVnd > 0) && (
                          <div className="text-[#17221E]">
                            {isVi
                              ? `Số tiền hoàn đã ghi nhận: ${formatMoney(b.refundAmountVnd)} · Tiền thưởng hoàn lại: ${formatMoney(b.creditIssuedVnd)}`
                              : `Verified refund: ${formatMoney(b.refundAmountVnd)} · Account credit restored: ${formatMoney(b.creditIssuedVnd)}`}
                          </div>
                        )}
                        <div className="text-[11px] text-[#53635D]">
                          {refundTimelineText(b.refundStatus)}
                        </div>
                        {b.refundRequests.map((rf) => (
                          <div
                            key={rf.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/80 px-3 py-2 text-[11px]"
                          >
                            <div>
                              <span className="font-semibold text-[#17221E]">
                                {formatMoney(rf.amountVnd)}
                              </span>{' '}
                              <span className="text-[#53635D]">— {rf.reason || rf.refundType}</span>
                              {rf.decisionNote && (
                                <div className="text-[#53635D]">{rf.decisionNote}</div>
                              )}
                            </div>
                            <div className="text-right">
                              <span className="font-semibold uppercase text-[#C25E28]">
                                {rf.status.replace('_', ' ')}
                              </span>
                              <div className="text-[10px] text-[#53635D]">
                                {rf.processedAt
                                  ? `${isVi ? 'Xử lý:' : 'Processed:'} ${rf.processedAt.slice(0, 10)}`
                                  : `${isVi ? 'Tạo:' : 'Created:'} ${rf.createdAt.slice(0, 10)}`}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {isActive && (
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        <span className="text-xs text-[#53635D]">
                          <CheckCircle2 className="mr-1 inline h-3.5 w-3.5 text-[#164E3F]" />
                          {isVi
                            ? `Chính sách hủy: ${formatCancellationPolicyLabel(b.cancellationPolicy, locale)}.`
                            : `Cancellation: ${formatCancellationPolicyLabel(b.cancellationPolicy, locale)}.`}
                        </span>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              openSupportForBooking(
                                b.id,
                                b.bookingCode,
                                isVi ? b.titleVi : b.titleEn
                              )
                            }
                            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-[#164E3F]/30 bg-[#E7F1EC] px-3.5 py-1.5 text-xs font-semibold text-[#164E3F] hover:bg-[#d7e9e0]"
                          >
                            <LifeBuoy className="h-3.5 w-3.5" />
                            {isVi ? 'Báo sự cố / Hỗ trợ' : 'Report Issue / Support'}
                          </button>
                          <button
                            type="button"
                            disabled={busyId === b.id}
                            onClick={() => handleCancel(b.id, b.bookingCode)}
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
                    {!isActive && (
                      <div className="flex justify-end pt-1">
                        <button
                          type="button"
                          onClick={() =>
                            openSupportForBooking(
                              b.id,
                              b.bookingCode,
                              isVi ? b.titleVi : b.titleEn
                            )
                          }
                          className="inline-flex items-center gap-1.5 rounded-xl border border-[#E5DFD3] px-3 py-1.5 text-xs font-semibold text-[#164E3F] hover:bg-[#FAF8F3]"
                        >
                          <LifeBuoy className="h-3.5 w-3.5" />
                          {isVi ? 'Mở phiếu hỗ trợ cho đơn này' : 'Get support for this booking'}
                        </button>
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

      {/* Unified Interactive Support Center (support_tickets & support_ticket_messages) */}
      <section id="support-center" className="space-y-4 rounded-2xl border border-[#E5DFD3] bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-xl font-semibold text-[#17221E]">
              <LifeBuoy className="h-5 w-5 text-[#164E3F]" />
              {isVi ? 'Trung tâm hỗ trợ & Xử lý sự cố' : 'Support Center & Issue Resolution'}
            </h3>
            <p className="text-xs text-[#53635D]">
              {isVi
                ? 'Gửi yêu cầu về Wi-Fi, nhận phòng, thay đổi đơn hoặc hoàn tiền trực tiếp tới đội ngũ VietNomad.'
                : 'Report Wi-Fi, property, booking, or refund inquiries directly to VietNomad Support.'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-[#53635D]">
              {formatCountNoun(tickets.length, 'ticket', 'tickets', 'phiếu', locale)}
            </span>
            <button
              type="button"
              onClick={() => setTicketFormOpen((prev) => !prev)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#164E3F] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#0F392E]"
            >
              <Plus className="h-3.5 w-3.5" />
              {ticketFormOpen
                ? isVi
                  ? 'Đóng biểu mẫu'
                  : 'Close form'
                : isVi
                  ? 'Tạo phiếu hỗ trợ'
                  : 'New Support Ticket'}
            </button>
          </div>
        </div>

        {ticketFormOpen && (
          <form
            onSubmit={handleCreateTicket}
            className="space-y-3 rounded-2xl border border-[#CBE1D6] bg-[#FAF8F3] p-4 text-xs"
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block font-semibold text-[#17221E]">
                  {isVi ? 'Danh mục' : 'Category'}
                </label>
                <select
                  value={ticketCategory}
                  onChange={(e) =>
                    setTicketCategory(
                      e.target.value as 'booking' | 'property_wifi' | 'payment' | 'general'
                    )
                  }
                  className="h-9 w-full rounded-xl border border-[#E5DFD3] bg-white px-2.5"
                >
                  <option value="property_wifi">
                    {isVi ? 'Wi-Fi / Chất lượng chỗ ở' : 'Property & Wi-Fi Issue'}
                  </option>
                  <option value="booking">
                    {isVi ? 'Đặt phòng / Nhận phòng' : 'Booking / Check-in'}
                  </option>
                  <option value="payment">
                    {isVi ? 'Thanh toán / Hoàn tiền' : 'Payment / Refund Inquiry'}
                  </option>
                  <option value="general">{isVi ? 'Câu hỏi chung' : 'General Support'}</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block font-semibold text-[#17221E]">
                  {isVi ? 'Chi tiết vấn đề' : 'Issue Type'}
                </label>
                <select
                  value={ticketSubCategory}
                  onChange={(e) => setTicketSubCategory(e.target.value)}
                  className="h-9 w-full rounded-xl border border-[#E5DFD3] bg-white px-2.5"
                >
                  <option value="wifi_speed_mismatch">
                    {isVi ? 'Tốc độ / Ổn định Wi-Fi' : 'Wi-Fi Speed / Stability'}
                  </option>
                  <option value="property_condition">
                    {isVi ? 'Tiện nghi / Vệ sinh phòng' : 'Amenity / Property Condition'}
                  </option>
                  <option value="checkin_access">
                    {isVi ? 'Hướng dẫn nhận phòng' : 'Check-in Access'}
                  </option>
                  <option value="booking_modification">
                    {isVi ? 'Thay đổi ngày / Hủy đơn' : 'Dates / Cancellation'}
                  </option>
                  <option value="refund_inquiry">
                    {isVi ? 'Tra soát hoàn tiền' : 'Refund Status Inquiry'}
                  </option>
                  <option value="general_question">
                    {isVi ? 'Tư vấn chung' : 'General Question'}
                  </option>
                </select>
              </div>
              <div>
                <label className="mb-1 block font-semibold text-[#17221E]">
                  {isVi ? 'Đơn liên quan (tùy chọn)' : 'Related Booking (optional)'}
                </label>
                <select
                  value={ticketBookingId}
                  onChange={(e) => setTicketBookingId(e.target.value)}
                  className="h-9 w-full rounded-xl border border-[#E5DFD3] bg-white px-2.5"
                >
                  <option value="">{isVi ? 'Không chọn đơn cụ thể' : 'No specific booking'}</option>
                  {data.bookings.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.bookingCode} · {isVi ? b.titleVi : b.titleEn}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1 block font-semibold text-[#17221E]">
                {isVi ? 'Tiêu đề' : 'Subject'}
              </label>
              <input
                type="text"
                required
                minLength={4}
                maxLength={200}
                value={ticketSubject}
                onChange={(e) => setTicketSubject(e.target.value)}
                placeholder={
                  isVi
                    ? 'Ví dụ: Wi-Fi thực tế chậm hơn mô tả hoặc cần hỗ trợ nhận phòng'
                    : 'e.g. Wi-Fi slower than verified rating or check-in assistance'
                }
                className="h-9 w-full rounded-xl border border-[#E5DFD3] bg-white px-3"
              />
            </div>

            <div>
              <label className="mb-1 block font-semibold text-[#17221E]">
                {isVi ? 'Mô tả chi tiết' : 'Description'}
              </label>
              <textarea
                required
                minLength={6}
                maxLength={3000}
                rows={3}
                value={ticketDescription}
                onChange={(e) => setTicketDescription(e.target.value)}
                placeholder={
                  isVi
                    ? 'Mô tả vấn đề bạn đang gặp phải và mong muốn hỗ trợ (đổi phòng, kiểm tra kỹ thuật, hoàn phí)...'
                    : 'Describe what happened and how we can help (speedtest results, check-in help, refund review)...'
                }
                className="w-full rounded-xl border border-[#E5DFD3] bg-white p-3"
              />
            </div>

            <div className="space-y-2">
              <label className="block font-semibold text-[#17221E]">
                <Paperclip className="mr-1 inline h-3.5 w-3.5" />
                {isVi ? 'Link ảnh / Speedtest minh chứng (tùy chọn)' : 'Evidence / Screenshot URLs (optional)'}
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={ticketAttachmentInput}
                  onChange={(e) => setTicketAttachmentInput(e.target.value)}
                  placeholder="https://... or /api/uploads/..."
                  className="h-8 flex-1 rounded-xl border border-[#E5DFD3] bg-white px-3"
                />
                <button
                  type="button"
                  onClick={addAttachmentUrl}
                  className="h-8 rounded-xl border border-[#E5DFD3] bg-white px-3 font-semibold text-[#17221E] hover:bg-[#F2EDE3]"
                >
                  {isVi ? 'Thêm link' : 'Attach'}
                </button>
              </div>
              {ticketAttachments.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {ticketAttachments.map((url, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 rounded-lg bg-white px-2 py-1 text-[11px] text-[#164E3F]"
                    >
                      <span className="max-w-[200px] truncate">{url}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setTicketAttachments((prev) => prev.filter((_, i) => i !== idx))
                        }
                        className="font-bold text-[#C25E28]"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {ticketError && (
              <div className="rounded-xl bg-[#FAEDE5] p-2.5 text-[#C25E28]">{ticketError}</div>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={ticketSubmitting}
                className="rounded-xl bg-[#164E3F] px-4 py-2 font-semibold text-white hover:bg-[#0F392E] disabled:opacity-60"
              >
                {ticketSubmitting
                  ? isVi
                    ? 'Đang gửi...'
                    : 'Submitting...'
                  : isVi
                    ? 'Gửi yêu cầu hỗ trợ'
                    : 'Submit Support Ticket'}
              </button>
            </div>
          </form>
        )}

        {tickets.length === 0 ? (
          <p className="text-sm text-[#53635D]">
            {isVi
              ? 'Chưa có phiếu hỗ trợ nào. Bấm "Tạo phiếu hỗ trợ" bất cứ khi nào bạn cần.'
              : 'No support tickets yet. Click "New Support Ticket" anytime you need assistance.'}
          </p>
        ) : (
          <div className="space-y-3 text-xs">
            {tickets.map((t) => {
              const isExpanded = expandedTicketId === t.id;
              return (
                <div
                  key={t.id}
                  className="overflow-hidden rounded-2xl border border-[#E5DFD3] bg-[#FAF8F3]"
                >
                  <button
                    type="button"
                    onClick={() => setExpandedTicketId(isExpanded ? null : t.id)}
                    className="flex w-full flex-wrap items-center justify-between gap-2 p-3.5 text-left hover:bg-[#F2EDE3]/60"
                  >
                    <div className="space-y-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-bold text-[#164E3F]">{t.ticketCode}</span>
                        <span className="font-semibold text-[#17221E]">{t.subject}</span>
                        {t.bookingCode && (
                          <span className="rounded bg-white px-1.5 py-0.5 text-[10px] font-medium text-[#53635D]">
                            {t.bookingCode}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-[#53635D]">
                        {t.category.replace('_', ' ')}
                        {t.issueSubCategory ? ` · ${t.issueSubCategory.replace(/_/g, ' ')}` : ''} ·{' '}
                        {t.messages.length}{' '}
                        {isVi ? 'tin nhắn' : t.messages.length === 1 ? 'message' : 'messages'}
                      </div>
                    </div>
                    <span className="rounded-full bg-[#E7F1EC] px-2.5 py-0.5 font-semibold text-[#164E3F]">
                      {formatSupportStatusLabel(t.status)}
                    </span>
                  </button>

                  {isExpanded && (
                    <div className="space-y-3 border-t border-[#E5DFD3] bg-white p-4">
                      {t.attachments.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {t.attachments.map((url, idx) => (
                            <a
                              key={idx}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-lg border border-[#E5DFD3] bg-[#FAF8F3] px-2.5 py-1 text-[11px] font-medium text-[#164E3F] underline"
                            >
                              <Paperclip className="h-3 w-3" />
                              {isVi ? `Minh chứng #${idx + 1}` : `Attachment #${idx + 1}`}
                            </a>
                          ))}
                        </div>
                      )}

                      {t.resolutionSummary && (
                        <div className="rounded-xl border border-[#CBE1D6] bg-[#E7F1EC] p-2.5 text-[11px] text-[#164E3F]">
                          <strong>{isVi ? 'Kết quả xử lý:' : 'Resolution:'}</strong>{' '}
                          {t.resolutionSummary}
                        </div>
                      )}

                      <div className="space-y-2">
                        {(t.messages.length > 0
                          ? t.messages
                          : [
                              {
                                id: `${t.id}-init`,
                                senderName: user.fullName,
                                senderRole: user.role,
                                body: t.description,
                                attachments: t.attachments,
                                createdAt: t.createdAt,
                              },
                            ]
                        ).map((m) => {
                          const isStaff = m.senderRole !== 'nomad' && m.senderName !== user.fullName;
                          return (
                            <div
                              key={m.id}
                              className={`rounded-xl p-3 text-xs ${
                                isStaff
                                  ? 'border border-[#CBE1D6] bg-[#E7F1EC]/70'
                                  : 'border border-[#E5DFD3] bg-[#FAF8F3]'
                              }`}
                            >
                              <div className="mb-1 flex items-center justify-between text-[11px]">
                                <span className="font-semibold text-[#17221E]">
                                  {isStaff ? `VietNomad Support (${m.senderName})` : m.senderName}
                                </span>
                                <span className="text-[#53635D]">
                                  {m.createdAt.slice(0, 16).replace('T', ' ')}
                                </span>
                              </div>
                              <div className="whitespace-pre-wrap text-[#17221E]">{m.body}</div>
                            </div>
                          );
                        })}
                      </div>

                      {t.status !== 'closed' && (
                        <form
                          onSubmit={(e) => handleReplyTicket(e, t.id)}
                          className="flex flex-col gap-2 sm:flex-row"
                        >
                          <input
                            type="text"
                            minLength={2}
                            maxLength={3000}
                            value={replyDrafts[t.id] ?? ''}
                            onChange={(e) =>
                              setReplyDrafts((prev) => ({ ...prev, [t.id]: e.target.value }))
                            }
                            placeholder={
                              isVi
                                ? 'Nhập phản hồi hoặc thông tin bổ sung cho bộ phận hỗ trợ...'
                                : 'Write a reply to VietNomad Support...'
                            }
                            className="h-9 flex-1 rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-3"
                          />
                          <button
                            type="submit"
                            disabled={replyBusyId === t.id || !(replyDrafts[t.id] ?? '').trim()}
                            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-[#164E3F] px-4 font-semibold text-white hover:bg-[#0F392E] disabled:opacity-60"
                          >
                            <Send className="h-3.5 w-3.5" />
                            {replyBusyId === t.id
                              ? '...'
                              : isVi
                                ? 'Gửi'
                                : 'Send reply'}
                          </button>
                        </form>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="rounded-2xl border border-[#E5DFD3] bg-white p-6">
          <h3 className="mb-4 flex items-center gap-2 text-xl font-semibold text-[#17221E]">
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
                      {isVi ? s.destinationNameVi : s.destinationNameEn}
                      {s.wifiDownloadMbps > 0 ? ` · ${s.wifiDownloadMbps} Mbps` : ''}
                    </div>
                  </div>
                  <div className="text-sm font-bold text-[#164E3F]">
                    {formatMoney(s.monthDisplayVnd)}/{isVi ? 'tháng' : 'mo'}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-[#E5DFD3] bg-white p-6">
          <h3 className="mb-4 flex items-center gap-2 text-xl font-semibold text-[#17221E]">
            <Calendar className="h-5 w-5 text-[#164E3F]" />
            {isVi ? 'Sự kiện đã đăng ký' : 'Your meetup RSVPs'}
          </h3>
          {data.rsvps.length === 0 ? (
            <p className="text-sm text-[#53635D]">
              {isVi ? 'Chưa đăng ký sự kiện nào. Xem lịch cộng đồng ngay.' : 'No upcoming meetup RSVPs yet.'}{' '}
              <Link href="/community" className="font-semibold text-[#164E3F] hover:underline">
                {isVi ? 'Xem sự kiện' : 'Browse meetups'}
              </Link>
            </p>
          ) : (
            <div className="space-y-3">
              {data.rsvps.map((e) => (
                <div key={e.id} className="rounded-2xl bg-[#FAF8F3] p-3 text-sm">
                  <div className="font-semibold text-[#17221E]">{isVi ? e.titleVi : e.titleEn}</div>
                  <div className="text-xs text-[#53635D]">
                    {isVi ? e.cityVi : e.cityEn}, {e.eventDate} ({isVi ? e.venueVi : e.venueEn})
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
