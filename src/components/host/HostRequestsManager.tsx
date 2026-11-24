'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Calendar, Check, CheckCircle2, Users, XCircle } from 'lucide-react';
import { formatVnd } from '@/lib/format';
import type { ErrorCode } from '@/lib/errors';
import type { BookingStatus, HostBookingItem } from '@/modules/bookings';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { StatusBadge } from '@/components/ui/StatusBadge';

interface HostRequestsManagerProps {
  initialBookings: HostBookingItem[];
}

const HOST_BOOKING_STATUS_VI: Record<
  BookingStatus,
  { label: string; tone: 'neutral' | 'success' | 'warning' | 'danger' }
> = {
  pending: { label: 'Chờ phản hồi', tone: 'warning' },
  confirmed: { label: 'Đã xác nhận', tone: 'success' },
  declined: { label: 'Đã từ chối', tone: 'danger' },
  withdrawn: { label: 'Khách đã rút', tone: 'neutral' },
  expired: { label: 'Đã hết hạn', tone: 'neutral' },
  cancelled: { label: 'Đã hủy', tone: 'danger' },
  completed: { label: 'Hoàn tất', tone: 'neutral' },
};

export function HostRequestsManager({
  initialBookings,
}: HostRequestsManagerProps) {
  const router = useRouter();
  const [bookings, setBookings] = useState<HostBookingItem[]>(initialBookings);
  const [activeAction, setActiveAction] = useState<{
    bookingId: string;
    type: 'confirm' | 'decline';
  } | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<{ code?: ErrorCode; message: string } | null>(
    null
  );

  async function reloadBookings() {
    const res = await fetch('/api/host/bookings');
    const json = await res.json();
    if (res.ok && json.ok) {
      setBookings(json.bookings as HostBookingItem[]);
    }
    router.refresh();
  }

  async function executeDecision(booking: HostBookingItem, type: 'confirm' | 'decline') {
    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      const endpoint =
        type === 'confirm'
          ? `/api/host/bookings/${booking.id}/confirm`
          : `/api/host/bookings/${booking.id}/decline`;

      const body =
        type === 'confirm'
          ? { responseNote: note.trim() || undefined }
          : { reason: note.trim() || undefined };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();

      if (!res.ok || !json.ok) {
        setError({
          code: json?.error?.code ?? 'INTERNAL_ERROR',
          message: json?.error?.message ?? 'Không thể xử lý yêu cầu.',
        });
        return;
      }

      setNotice(
        type === 'confirm'
          ? `Đã xác nhận đơn ${booking.bookingCode} (${booking.checkIn} -> ${booking.checkOut}) và khóa toàn bộ đêm trong lịch.`
          : `Đã từ chối yêu cầu ${booking.bookingCode}.`
      );
      setActiveAction(null);
      setNote('');
      await reloadBookings();
    } catch {
      setError({ code: 'INTERNAL_ERROR', message: 'Không thể kết nối máy chủ.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      {notice && (
        <div
          role="status"
          className="rounded-[12px] border border-[#C4DCD2] bg-[var(--color-primary-soft)] p-4 text-sm text-[var(--color-primary)] flex items-center gap-2"
        >
          <Check className="w-5 h-5 shrink-0" aria-hidden="true" />
          <span>{notice}</span>
        </div>
      )}

      {error && <ErrorAlert code={error.code} message={error.message} locale="vi" />}

      {bookings.length === 0 ? (
        <div className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface-ivory)] p-8 text-center text-sm text-[var(--color-text-muted)]">
          Chưa có yêu cầu đặt phòng nào cho các căn của bạn.
        </div>
      ) : (
        <div className="space-y-4">
          {bookings.map((b) => {
            const badge =
              b.status === 'pending' && b.isExpired
                ? { label: 'Quá hạn phản hồi', tone: 'neutral' as const }
                : HOST_BOOKING_STATUS_VI[b.status];
            const isConfirming =
              activeAction?.bookingId === b.id && activeAction.type === 'confirm';
            const isDeclining =
              activeAction?.bookingId === b.id && activeAction.type === 'decline';

            return (
              <article
                key={b.id}
                className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-apple-subtle p-5 space-y-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                        {b.bookingCode}
                      </span>
                      <StatusBadge label={badge.label} tone={badge.tone} withIcon />
                    </div>
                    <h2 className="text-lg font-semibold text-[var(--color-text)]">
                      {b.listingTitle}
                    </h2>
                    <p className="text-sm text-[var(--color-text-muted)]">
                      Khách: <strong className="text-[var(--color-text)]">{b.guestName}</strong> ({b.guestEmail})
                    </p>
                  </div>

                  <div className="text-left sm:text-right">
                    <p className="text-xs text-[var(--color-text-muted)]">Tổng giá trị đơn (đã chốt)</p>
                    <p className="text-lg font-semibold tabular-nums text-[var(--color-primary)]">
                      {formatVnd(b.totalVnd, 'vi')}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)]">{b.paymentTerms}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-5 text-sm text-[var(--color-text-muted)] pt-2 border-t border-[var(--color-hairline)]">
                  <span className="inline-flex items-center gap-1.5 tabular-nums">
                    <Calendar className="w-4 h-4 text-[var(--color-primary)]" aria-hidden="true" />
                    <span>
                      {b.checkIn} đến {b.checkOut} ({b.nightsCount} đêm, {b.timezone})
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-[var(--color-primary)]" aria-hidden="true" />
                    <span>{b.guestsCount} khách</span>
                  </span>
                  {b.status === 'pending' && (
                    <span className="text-xs tabular-nums">
                      Hạn phản hồi: {new Date(b.expiresAt).toISOString().slice(0, 16).replace('T', ' ')} UTC
                    </span>
                  )}
                </div>

                {b.guestNote && (
                  <p className="text-sm text-[var(--color-text-muted)] bg-[var(--color-surface-ivory)] rounded-[12px] p-3">
                    <strong className="text-[var(--color-text)]">Lời nhắn từ khách:</strong> {b.guestNote}
                  </p>
                )}

                {b.status === 'pending' && !isConfirming && !isDeclining && (
                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <button
                      type="button"
                      disabled={busy || b.isExpired}
                      onClick={() => {
                        setError(null);
                        setNote('');
                        setActiveAction({ bookingId: b.id, type: 'confirm' });
                      }}
                      className="inline-flex items-center gap-1.5 min-h-[44px] px-5 rounded-[12px] bg-[var(--color-primary)] text-white text-sm font-semibold hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                      <span>Xác nhận đơn</span>
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setError(null);
                        setNote('');
                        setActiveAction({ bookingId: b.id, type: 'decline' });
                      }}
                      className="inline-flex items-center gap-1.5 min-h-[44px] px-4 rounded-[12px] border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] text-sm font-medium text-[var(--color-danger-text)] disabled:opacity-50"
                    >
                      <XCircle className="w-4 h-4" aria-hidden="true" />
                      <span>Từ chối</span>
                    </button>
                  </div>
                )}

                {/* Hộp xác nhận lại ngày & tổng tiền bắt buộc trước khi khóa lịch */}
                {isConfirming && (
                  <div className="rounded-[12px] border border-[#C4DCD2] bg-[var(--color-primary-soft)] p-4 space-y-3">
                    <p className="text-sm font-semibold text-[var(--color-text)]">
                      Kiểm tra lại thông tin trước khi xác nhận & khóa lịch:
                    </p>
                    <ul className="text-sm text-[var(--color-text)] space-y-1 tabular-nums">
                      <li>
                        <strong>Chỗ ở:</strong> {b.listingTitle}
                      </li>
                      <li>
                        <strong>Nhận phòng — Trả phòng:</strong> {b.checkIn} đến {b.checkOut} ({b.nightsCount} đêm)
                      </li>
                      <li>
                        <strong>Tổng tiền hiển thị cho khách:</strong> {formatVnd(b.totalVnd, 'vi')}
                      </li>
                    </ul>
                    <div>
                      <label
                        htmlFor={`confirm-note-${b.id}`}
                        className="block text-xs font-medium text-[var(--color-text-muted)] mb-1"
                      >
                        Lời nhắn chào đón khách (tùy chọn)
                      </label>
                      <input
                        id={`confirm-note-${b.id}`}
                        type="text"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="Ví dụ: Rất vui được đón bạn, hướng dẫn nhận phòng đã sẵn sàng."
                        className="w-full min-h-[44px] px-3 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] text-sm"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2.5">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => executeDecision(b, 'confirm')}
                        className="min-h-[44px] px-5 rounded-[12px] bg-[var(--color-primary)] text-white text-sm font-semibold disabled:opacity-60"
                      >
                        {busy ? 'Đang khóa lịch...' : 'Xác nhận giữ lịch ngay'}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setActiveAction(null)}
                        className="min-h-[44px] px-4 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] text-sm font-medium"
                      >
                        Hủy thao tác
                      </button>
                    </div>
                  </div>
                )}

                {isDeclining && (
                  <div className="rounded-[12px] border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] p-4 space-y-3">
                    <label
                      htmlFor={`decline-note-${b.id}`}
                      className="block text-sm font-medium text-[var(--color-text)]"
                    >
                      Lý do từ chối (tùy chọn)
                    </label>
                    <input
                      id={`decline-note-${b.id}`}
                      type="text"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Ví dụ: Căn đang bảo trì đột xuất trong thời gian này."
                      className="w-full min-h-[44px] px-3 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] text-sm"
                    />
                    <div className="flex flex-wrap gap-2.5">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => executeDecision(b, 'decline')}
                        className="min-h-[44px] px-5 rounded-[12px] bg-[var(--color-danger-text)] text-white text-sm font-semibold disabled:opacity-60"
                      >
                        {busy ? 'Đang xử lý...' : 'Xác nhận từ chối'}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setActiveAction(null)}
                        className="min-h-[44px] px-4 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] text-sm font-medium"
                      >
                        Quay lại
                      </button>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
