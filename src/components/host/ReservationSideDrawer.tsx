'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  Clock,
  Loader2,
  MapPin,
  MessageSquare,
  Save,
  User,
  X,
  XCircle,
} from 'lucide-react';
import {
  formatBookingStatusLabel,
  formatCancellationPolicyLabel,
  formatVndExact,
} from '@/lib/i18n';
import { usePreferences } from '@/components/PreferencesProvider';

export interface HostReservationItem {
  id: string;
  bookingCode: string;
  stayId: string;
  staySlug?: string;
  stayTitleEn: string;
  stayTitleVi: string;
  stayImage?: string;
  roomNameEn: string;
  roomNameVi: string;
  guestId?: string;
  guestName: string;
  guestEmail: string;
  guestPhone?: string;
  nationality: string;
  status: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  guestsCount: number;
  wholesaleTotalVnd: number;
  feeOnlineVnd: number;
  payAtCheckinVnd: number;
  guestTotalVnd: number;
  refundAmountVnd?: number;
  cancellationPolicy?: string;
  guestNote: string;
  hostInternalNote?: string;
  paymentProvider?: string;
  paidAt?: string | null;
  createdAt: string;
  conversationId?: string | null;
  events?: Array<{
    id: string;
    actorRole: string;
    eventType: string;
    summary: string;
    createdAt: string;
  }>;
}

export function ReservationSideDrawer({
  reservation,
  onClose,
  onUpdated,
}: {
  reservation: HostReservationItem | null;
  onClose: () => void;
  onUpdated: (msg: string) => void;
}) {
  const router = useRouter();
  const { locale, serviceFeePct, hostCommissionPct } = usePreferences();
  const isVi = locale === 'vi';

  const [note, setNote] = useState(reservation?.hostInternalNote ?? '');
  const [busy, setBusy] = useState(false);
  const [errMsg, setErrMsg] = useState('');

  if (!reservation) return null;

  const isPendingHost = reservation.status === 'PENDING_HOST_APPROVAL';
  const canConfirmCheckin =
    reservation.status === 'RESERVED_LOCKED' || reservation.status === 'confirmed';

  async function handleConfirmCheckin() {
    if (!reservation) return;
    setBusy(true);
    setErrMsg('');
    try {
      const res = await fetch(`/api/bookings/${reservation.id}/checkin`, {
        method: 'POST',
      });
      const json = await res.json();
      if (!json.ok) {
        setErrMsg(json.error?.message ?? 'Action failed.');
        return;
      }
      onUpdated(
        isVi
          ? `Đã xác nhận khách nhận phòng & thu tiền đơn ${reservation.bookingCode}.`
          : `Confirmed check-in & payment for ${reservation.bookingCode}.`
      );
      onClose();
    } finally {
      setBusy(false);
    }
  }

  async function handleDecision(decision: 'approve' | 'decline') {
    if (!reservation) return;
    if (decision === 'decline') {
      const msg = isVi
        ? `Từ chối yêu cầu đặt phòng ${reservation.bookingCode}? Ngày sẽ được mở lại và khách được hoàn ${serviceFeePct}% phí dịch vụ.`
        : `Decline booking request ${reservation.bookingCode}? The dates will reopen and the guest’s ${serviceFeePct}% service fee will be refunded automatically.`;
      if (typeof window !== 'undefined' && !window.confirm(msg)) return;
    }
    setBusy(true);
    setErrMsg('');
    try {
      const res = await fetch(`/api/host/reservations/${reservation.id}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, note }),
      });
      const json = await res.json();
      if (!json.ok) {
        setErrMsg(json.error?.message ?? 'Could not process request.');
        return;
      }
      onUpdated(
        decision === 'approve'
          ? isVi
            ? `Đã duyệt yêu cầu đặt phòng ${reservation.bookingCode}.`
            : `Approved booking request ${reservation.bookingCode}.`
          : isVi
            ? `Đã từ chối yêu cầu ${reservation.bookingCode} và hoàn phí ${serviceFeePct}% cho khách.`
            : `Declined ${reservation.bookingCode} and refunded the ${serviceFeePct}% fee.`
      );
      onClose();
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveNote() {
    if (!reservation) return;
    setBusy(true);
    setErrMsg('');
    try {
      const res = await fetch(`/api/host/reservations/${reservation.id}/note`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note }),
      });
      const json = await res.json();
      if (!json.ok) {
        setErrMsg(json.error?.message ?? 'Could not save note.');
        return;
      }
      onUpdated(isVi ? 'Đã lưu ghi chú nội bộ.' : 'Saved host note.');
    } finally {
      setBusy(false);
    }
  }

  async function handleOpenMessage() {
    if (!reservation) return;
    setBusy(true);
    try {
      const res = await fetch('/api/host/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: reservation.id }),
      });
      const json = await res.json();
      if (json.ok && json.conversationId) {
        router.push(`/host/messages?c=${json.conversationId}`);
      } else {
        router.push('/host/messages');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/35"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="flex h-full w-full max-w-lg flex-col border-l border-[#E5DFD3] bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-[#E5DFD3] px-6 py-4">
          <div>
            <div className="flex items-center gap-2 text-xs">
              <span className="font-mono font-semibold text-[#164E3F]">
                {reservation.bookingCode}
              </span>
              <span className="rounded-md border border-[#E5DFD3] bg-[#FAF8F3] px-2 py-0.5 font-medium text-[#17221E]">
                {formatBookingStatusLabel(reservation.status, locale)}
              </span>
            </div>
            <h2 className="mt-1 text-lg font-semibold text-[#17221E]">
              {reservation.guestName}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[#E5DFD3] p-1.5 text-[#53635D] hover:bg-[#FAF8F3] hover:text-[#17221E]"
            aria-label="Close drawer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5 text-sm">
          {errMsg && (
            <div className="rounded-lg border border-[#C25E28]/40 bg-[#FAEDE5] px-3.5 py-2.5 text-xs font-medium text-[#C25E28]">
              {errMsg}
            </div>
          )}

          {/* Primary Actions */}
          <div className="flex flex-wrap gap-2">
            {isPendingHost && (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleDecision('approve')}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#164E3F] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#0F392E] disabled:opacity-60"
                >
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                  {isVi ? 'Chấp nhận đặt phòng' : 'Approve request'}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleDecision('decline')}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#C25E28]/50 px-3.5 py-2 text-xs font-semibold text-[#C25E28] hover:bg-[#FAEDE5] disabled:opacity-60"
                >
                  <XCircle className="h-3.5 w-3.5" />
                  {isVi ? 'Từ chối' : 'Decline'}
                </button>
              </>
            )}

            {canConfirmCheckin && (
              <button
                type="button"
                disabled={busy}
                onClick={handleConfirmCheckin}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#164E3F] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#0F392E] disabled:opacity-60"
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                {isVi ? 'Xác nhận khách nhận phòng & đã thu tiền' : 'Confirm check-in & rent received'}
              </button>
            )}

            <button
              type="button"
              disabled={busy}
              onClick={handleOpenMessage}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5DFD3] bg-white px-3.5 py-2 text-xs font-semibold text-[#17221E] hover:bg-[#FAF8F3]"
            >
              <MessageSquare className="h-3.5 w-3.5 text-[#53635D]" />
              {isVi ? 'Nhắn tin khách' : 'Message guest'}
            </button>
          </div>

          {/* Stay & Dates */}
          <div className="space-y-3 rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] p-4">
            <div className="flex items-start gap-2.5">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#164E3F]" strokeWidth={1.75} />
              <div>
                <div className="font-semibold text-[#17221E]">
                  {isVi ? reservation.stayTitleVi : reservation.stayTitleEn}
                </div>
                <div className="text-xs text-[#53635D]">
                  {isVi ? reservation.roomNameVi : reservation.roomNameEn} ·{' '}
                  {reservation.guestsCount} {isVi ? 'khách' : 'guest(s)'}
                </div>
              </div>
            </div>
            <div className="flex items-start gap-2.5 border-t border-[#E5DFD3] pt-3">
              <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-[#164E3F]" strokeWidth={1.75} />
              <div className="grid w-full grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="text-[#53635D]">{isVi ? 'Nhận phòng' : 'Check-in'}</div>
                  <div className="font-semibold text-[#17221E]">{reservation.checkIn}</div>
                </div>
                <div>
                  <div className="text-[#53635D]">{isVi ? 'Trả phòng' : 'Check-out'}</div>
                  <div className="font-semibold text-[#17221E]">
                    {reservation.checkOut} ({reservation.nights} {isVi ? 'đêm' : 'nights'})
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Guest Info & Special Request */}
          <div className="space-y-2 rounded-xl border border-[#E5DFD3] p-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#53635D]">
              <User className="h-3.5 w-3.5" />
              {isVi ? 'Thông tin khách hàng' : 'Guest details'}
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs pt-1">
              <div>
                <span className="text-[#53635D]">{isVi ? 'Email:' : 'Email:'}</span>{' '}
                <span className="font-medium text-[#17221E]">{reservation.guestEmail}</span>
              </div>
              <div>
                <span className="text-[#53635D]">{isVi ? 'Quốc tịch:' : 'Nationality:'}</span>{' '}
                <span className="font-medium text-[#17221E]">{reservation.nationality}</span>
              </div>
              {reservation.guestPhone && (
                <div>
                  <span className="text-[#53635D]">{isVi ? 'Điện thoại:' : 'Phone:'}</span>{' '}
                  <span className="font-medium text-[#17221E]">{reservation.guestPhone}</span>
                </div>
              )}
              {reservation.cancellationPolicy && (
                <div>
                  <span className="text-[#53635D]">{isVi ? 'Chính sách hủy:' : 'Policy:'}</span>{' '}
                  <span className="font-medium text-[#17221E]">
                    {formatCancellationPolicyLabel(reservation.cancellationPolicy, locale)}
                  </span>
                </div>
              )}
            </div>
            {reservation.guestNote && (
              <div className="mt-2 rounded-lg bg-[#FAF8F3] p-3 text-xs">
                <div className="font-semibold text-[#17221E]">
                  {isVi ? 'Yêu cầu đặc biệt từ khách:' : 'Guest note:'}
                </div>
                <p className="mt-1 text-[#53635D]">{reservation.guestNote}</p>
              </div>
            )}
          </div>

          {/* Payment Breakdown */}
          <div className="space-y-2 rounded-xl border border-[#E5DFD3] p-4 text-xs">
            <div className="font-semibold uppercase tracking-wider text-[#53635D]">
              {isVi
                ? `Chi tiết thanh toán (${hostCommissionPct}% hoa hồng chủ nhà)`
                : `Payment breakdown (${hostCommissionPct}% host commission)`}
            </div>
            <div className="flex justify-between py-1">
              <span className="text-[#53635D]">
                {isVi ? 'Tổng khách thanh toán cho kỳ ở' : 'Total guest booking value'}
              </span>
              <span className="font-medium text-[#17221E]">
                {formatVndExact(reservation.guestTotalVnd)}
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-[#53635D]">
                {isVi
                  ? `Phí dịch vụ ${serviceFeePct}% (khách thanh toán online)`
                  : `${serviceFeePct}% online service fee`}
              </span>
              <span className="font-medium text-[#53635D]">
                {formatVndExact(reservation.feeOnlineVnd)}
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-[#53635D]">
                {isVi ? 'Hoa hồng chủ nhà' : 'Host commission'}
              </span>
              <span className="font-semibold text-[#164E3F]">0 ₫ ({hostCommissionPct}%)</span>
            </div>
            <div className="flex justify-between border-t border-[#E5DFD3] pt-2 text-sm font-semibold text-[#164E3F]">
              <span>
                {isVi ? 'Chủ nhà thu trực tiếp khi nhận phòng' : 'Host payout (collected at check-in)'}
              </span>
              <span>{formatVndExact(reservation.payAtCheckinVnd)}</span>
            </div>
          </div>

          {/* Internal Note */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-[#17221E]">
              {isVi ? 'Ghi chú nội bộ của chủ nhà' : 'Internal host note'}
            </label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                isVi
                  ? 'Ghi chú mã khóa phòng, giờ dọn phòng, yêu cầu VAT...'
                  : 'Door PIN reminder, arrival coordination, housekeeping note...'
              }
              className="w-full rounded-lg border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2 text-xs outline-none focus:border-[#164E3F]"
            />
            <button
              type="button"
              disabled={busy}
              onClick={handleSaveNote}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5DFD3] bg-white px-3 py-1.5 text-xs font-semibold text-[#17221E] hover:bg-[#FAF8F3]"
            >
              <Save className="h-3.5 w-3.5 text-[#53635D]" />
              {isVi ? 'Lưu ghi chú' : 'Save note'}
            </button>
          </div>

          {/* Audit Timeline */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#53635D]">
              <Clock className="h-3.5 w-3.5" />
              {isVi ? 'Lịch sử xử lý booking' : 'Booking history'}
            </div>
            {!reservation.events || reservation.events.length === 0 ? (
              <p className="text-xs text-[#53635D]">
                {isVi
                  ? `Đơn tạo lúc ${reservation.createdAt.slice(0, 16).replace('T', ' ')}.`
                  : `Created at ${reservation.createdAt.slice(0, 16).replace('T', ' ')}.`}
              </p>
            ) : (
              <div className="space-y-2 border-l-2 border-[#E5DFD3] pl-3.5 text-xs">
                {reservation.events.map((ev) => (
                  <div key={ev.id}>
                    <div className="font-medium text-[#17221E]">{ev.summary}</div>
                    <div className="text-[11px] text-[#53635D]">
                      {ev.actorRole} · {ev.createdAt.slice(0, 16).replace('T', ' ')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
