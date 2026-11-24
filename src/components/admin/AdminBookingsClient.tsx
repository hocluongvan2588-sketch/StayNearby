'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Check, XCircle } from 'lucide-react';
import { formatVnd } from '@/lib/format';
import type { ErrorCode } from '@/lib/errors';
import type { AdminBookingItem, BookingStatus } from '@/modules/bookings';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { StatusBadge } from '@/components/ui/StatusBadge';

interface AdminBookingsClientProps {
  initialBookings: AdminBookingItem[];
}

const BOOKING_STATUS_VI: Record<
  BookingStatus,
  { label: string; tone: 'neutral' | 'success' | 'warning' | 'danger' }
> = {
  pending: { label: 'Chờ phản hồi', tone: 'warning' },
  confirmed: { label: 'Đã xác nhận', tone: 'success' },
  declined: { label: 'Từ chối', tone: 'danger' },
  withdrawn: { label: 'Đã rút', tone: 'neutral' },
  expired: { label: 'Hết hạn', tone: 'neutral' },
  cancelled: { label: 'Đã hủy', tone: 'danger' },
  completed: { label: 'Hoàn tất', tone: 'neutral' },
};

export function AdminBookingsClient({
  initialBookings,
}: AdminBookingsClientProps) {
  const router = useRouter();
  const [bookings, setBookings] = useState<AdminBookingItem[]>(initialBookings);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [cancelTarget, setCancelTarget] = useState<AdminBookingItem | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<{ code?: ErrorCode; message: string } | null>(
    null
  );

  async function reload(filterValue: string) {
    const qs = filterValue !== 'all' ? `?status=${encodeURIComponent(filterValue)}` : '';
    const res = await fetch(`/api/admin/bookings${qs}`);
    const json = await res.json();
    if (res.ok && json.ok) {
      setBookings(json.bookings as AdminBookingItem[]);
    }
    router.refresh();
  }

  async function handleAdminCancel() {
    if (!cancelTarget) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/bookings/${cancelTarget.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: cancelReason.trim() }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError({
          code: json?.error?.code ?? 'VALIDATION_ERROR',
          message: json?.error?.message ?? 'Không thể hủy đơn.',
        });
        return;
      }

      setNotice(
        `Đã hỗ trợ hủy đơn ${cancelTarget.bookingCode} và giải phóng toàn bộ đêm đã khóa.`
      );
      setCancelTarget(null);
      setCancelReason('');
      await reload(statusFilter);
    } catch {
      setError({ code: 'INTERNAL_ERROR', message: 'Lỗi kết nối máy chủ.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <label
            htmlFor="admin-booking-filter"
            className="text-sm font-medium text-[var(--color-text)]"
          >
            Lọc trạng thái:
          </label>
          <select
            id="admin-booking-filter"
            value={statusFilter}
            onChange={(e) => {
              const v = e.target.value;
              setStatusFilter(v);
              reload(v);
            }}
            className="min-h-[44px] px-3 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] text-sm"
          >
            <option value="all">Tất cả đơn</option>
            <option value="pending">Chờ phản hồi</option>
            <option value="confirmed">Đã xác nhận</option>
            <option value="completed">Hoàn tất</option>
            <option value="cancelled">Đã hủy</option>
            <option value="declined">Đã từ chối</option>
            <option value="withdrawn">Khách đã rút</option>
            <option value="expired">Hết hạn</option>
          </select>
        </div>

        <p className="text-xs text-[var(--color-text-muted)]">
          Tổng hiển thị: <strong>{bookings.length}</strong> đơn
        </p>
      </div>

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

      {cancelTarget && (
        <div className="rounded-[12px] border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] p-5 space-y-3">
          <p className="text-sm font-semibold text-[var(--color-danger-text)]">
            Hỗ trợ hủy đơn {cancelTarget.bookingCode} ({cancelTarget.checkIn} đến {cancelTarget.checkOut})
          </p>
          <input
            type="text"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Bắt buộc nhập lý do hỗ trợ hủy đơn..."
            className="w-full min-h-[44px] px-3.5 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] text-sm"
          />
          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              disabled={busy || cancelReason.trim().length < 2}
              onClick={handleAdminCancel}
              className="min-h-[44px] px-5 rounded-[12px] bg-[var(--color-danger-text)] text-white text-sm font-semibold disabled:opacity-50"
            >
              {busy ? 'Đang hủy đơn...' : 'Xác nhận hỗ trợ hủy & trả lịch'}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setCancelTarget(null);
                setCancelReason('');
              }}
              className="min-h-[44px] px-4 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] text-sm font-medium"
            >
              Đóng
            </button>
          </div>
        </div>
      )}

      <div className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-ivory)] text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
              <th className="py-3.5 px-4">Mã đơn</th>
              <th className="py-3.5 px-4">Chỗ ở & Chủ nhà</th>
              <th className="py-3.5 px-4">Khách</th>
              <th className="py-3.5 px-4">Ngày ở</th>
              <th className="py-3.5 px-4">Tổng VND</th>
              <th className="py-3.5 px-4">Trạng thái</th>
              <th className="py-3.5 px-4">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-hairline)]">
            {bookings.map((b) => {
              const badge = BOOKING_STATUS_VI[b.status];
              return (
                <tr key={b.id} className="align-top">
                  <td className="py-3.5 px-4 font-semibold whitespace-nowrap">
                    {b.bookingCode}
                  </td>
                  <td className="py-3.5 px-4">
                    <p className="font-medium text-[var(--color-text)]">{b.listingTitle}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      Chủ nhà: {b.hostName} ({b.areaNameVi})
                    </p>
                  </td>
                  <td className="py-3.5 px-4">
                    <p className="text-[var(--color-text)]">{b.guestName}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">{b.guestEmail}</p>
                  </td>
                  <td className="py-3.5 px-4 tabular-nums whitespace-nowrap">
                    {b.checkIn} -&gt; {b.checkOut} ({b.nightsCount} đêm)
                  </td>
                  <td className="py-3.5 px-4 tabular-nums whitespace-nowrap font-semibold">
                    {formatVnd(b.totalVnd, 'vi')}
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <StatusBadge label={badge.label} tone={badge.tone} withIcon />
                    {b.cancellationReason && (
                      <p className="text-xs text-[var(--color-text-muted)] mt-1 max-w-[200px] whitespace-normal">
                        Lý do: {b.cancellationReason}
                      </p>
                    )}
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/trips/${b.id}`}
                        className="min-h-[40px] px-3 rounded-[12px] border border-[var(--color-border)] text-xs font-medium inline-flex items-center text-[var(--color-text)]"
                      >
                        Xem lịch sử
                      </Link>
                      {b.status === 'confirmed' && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            setCancelReason('');
                            setCancelTarget(b);
                          }}
                          className="min-h-[40px] px-3 rounded-[12px] border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] text-[var(--color-danger-text)] text-xs font-semibold inline-flex items-center gap-1"
                        >
                          <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Hỗ trợ hủy</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
