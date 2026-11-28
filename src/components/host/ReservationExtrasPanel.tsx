'use client';

/**
 * Stay Extras inside the host's Reservation Side Drawer (§8 of the spec).
 * Shows every service request for this booking with the guest's details,
 * estimated price, notes, and status — with the host action buttons:
 * confirm, send/adjust quote, request more info, decline, prepare, complete.
 * Adjusting a price always returns the request to awaiting_guest (the guest
 * must accept; a host edit never implies guest approval).
 */

import { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';

interface RequestRow {
  id: string;
  status: string;
  catalogKey: string;
  snapshot: Record<string, unknown>;
  guestDetails: Record<string, unknown>;
  quantity: number;
  desiredAt: string | null;
  guestNote: string;
  quotePriceVnd: number | null;
  quoteNote: string;
  quoteVersion: number;
  hostNote: string;
  declinedReason: string;
  source: string;
  createdAt: string;
}

const STATUS_META: Record<string, { vi: string; en: string; cls: string }> = {
  pending: { vi: 'Chờ xác nhận', en: 'Pending', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  awaiting_guest: {
    vi: 'Chờ khách phản hồi',
    en: 'Awaiting guest',
    cls: 'bg-sky-50 text-sky-700 border-sky-200',
  },
  confirmed: { vi: 'Đã xác nhận', en: 'Confirmed', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  preparing: { vi: 'Đang chuẩn bị', en: 'Preparing', cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  completed: { vi: 'Hoàn thành', en: 'Completed', cls: 'bg-stone-100 text-stone-600 border-stone-200' },
  declined: { vi: 'Từ chối', en: 'Declined', cls: 'bg-red-50 text-red-600 border-red-200' },
  cancelled: { vi: 'Đã hủy', en: 'Cancelled', cls: 'bg-stone-100 text-stone-500 border-stone-200' },
};

const DETAIL_LABELS: Record<string, { vi: string; en: string }> = {
  airport: { vi: 'Sân bay', en: 'Airport' },
  flightNo: { vi: 'Số chuyến', en: 'Flight' },
  landingAt: { vi: 'Giờ hạ cánh', en: 'Landing time' },
  pax: { vi: 'Số người', en: 'Passengers' },
  luggage: { vi: 'Hành lý', en: 'Luggage' },
  pickupDate: { vi: 'Ngày nhận', en: 'Pickup date' },
  returnDate: { vi: 'Ngày trả', en: 'Return date' },
  quantity: { vi: 'Số lượng', en: 'Quantity' },
  neededDate: { vi: 'Ngày cần', en: 'Needed date' },
  durationDays: { vi: 'Số ngày', en: 'Days' },
  date: { vi: 'Ngày', en: 'Date' },
  time: { vi: 'Giờ', en: 'Time' },
  frequency: { vi: 'Tần suất', en: 'Frequency' },
  startDate: { vi: 'Ngày bắt đầu', en: 'Start date' },
  days: { vi: 'Số ngày', en: 'Days' },
};

function formatVnd(n: number): string {
  return `${n.toLocaleString('vi-VN')}₫`;
}

export function ReservationExtrasPanel({
  bookingId,
  isVi,
  onUpdated,
}: {
  bookingId: string;
  isVi: boolean;
  onUpdated: (msg: string) => void;
}) {
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [quotingId, setQuotingId] = useState<string | null>(null);
  const [quotePrice, setQuotePrice] = useState('');
  const [quoteNote, setQuoteNote] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/host/service-requests?bookingId=${bookingId}`);
      const json = await res.json();
      if (res.ok) setRows(json?.requests ?? []);
    } catch {
      // Non-blocking; panel simply shows nothing.
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(t);
  }, [load]);

  async function act(id: string, action: string, payload: Record<string, unknown> = {}) {
    setBusyId(id);
    setError('');
    try {
      const res = await fetch(`/api/host/service-requests/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...payload }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? 'Action failed');
      setQuotingId(null);
      setQuotePrice('');
      setQuoteNote('');
      onUpdated(
        isVi ? 'Đã cập nhật yêu cầu dịch vụ.' : 'Service request updated.'
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusyId(null);
    }
  }

  async function decline(id: string) {
    const reason = window.prompt(
      isVi ? 'Lý do từ chối (khách sẽ nhận thông báo):' : 'Reason for declining (the guest is notified):'
    );
    if (reason === null) return;
    await act(id, 'decline', { reason: reason || 'Not available' });
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-1 py-3 text-xs text-[#53635D]">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        {isVi ? 'Đang tải dịch vụ…' : 'Loading services…'}
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-[#E5DFD3] p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#53635D]">
          {isVi ? 'Dịch vụ bổ sung' : 'Additional services'}
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded p-1 text-[#53635D] hover:bg-[#FAF8F3]"
          aria-label={isVi ? 'Tải lại' : 'Refresh'}
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600" role="alert">
          {error}
        </p>
      )}

      {rows.length === 0 && (
        <p className="text-xs text-[#53635D]">
          {isVi
            ? 'Khách chưa yêu cầu dịch vụ nào cho đặt phòng này.'
            : 'The guest has not requested any services for this booking.'}
        </p>
      )}

      {rows.map((r) => {
        const meta = STATUS_META[r.status] ?? STATUS_META.pending;
        const name = String(r.snapshot?.nameVi ?? r.catalogKey);
        const nameEn = String(r.snapshot?.nameEn ?? r.catalogKey);
        const snapPrice = r.snapshot?.priceVnd;
        const isIncluded = Boolean(r.snapshot?.isIncluded);
        const priceLine = isIncluded
          ? isVi
            ? 'Đã bao gồm'
            : 'Included'
          : r.quotePriceVnd !== null
            ? formatVnd(r.quotePriceVnd)
            : typeof snapPrice === 'number' && snapPrice > 0
              ? formatVnd(snapPrice)
              : isVi
                ? 'Theo yêu cầu'
                : 'By quote';
        const details = Object.entries(r.guestDetails ?? {});
        const canConfirm = r.status === 'pending';
        const canQuote = r.status === 'pending' || r.status === 'confirmed';
        const canInfo = r.status === 'pending' || r.status === 'confirmed';
        const canDecline = r.status === 'pending' || r.status === 'awaiting_guest';
        const canPrepare = r.status === 'confirmed';
        const canComplete = r.status === 'preparing';

        return (
          <div key={r.id} className="rounded-lg border border-[#E5DFD3] bg-[#FAF8F3] p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[#17221E]">
                  {isVi ? name : nameEn}
                </p>
                <p className="mt-0.5 text-[11px] text-[#53635D]">
                  {priceLine}
                  {r.quantity > 1 && ` · ×${r.quantity}`}
                  {r.desiredAt && ` · ${r.desiredAt.slice(0, 16).replace('T', ' ')}`}
                  {r.source === 'post_booking' &&
                    ` · ${isVi ? 'yêu cầu thêm sau đặt' : 'requested after booking'}`}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${meta.cls}`}
              >
                {isVi ? meta.vi : meta.en}
              </span>
            </div>

            {details.length > 0 && (
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                {details.map(([k, v]) => (
                  <div key={k} className="flex gap-1">
                    <dt className="text-[#53635D]">
                      {isVi ? DETAIL_LABELS[k]?.vi ?? k : DETAIL_LABELS[k]?.en ?? k}:
                    </dt>
                    <dd className="font-medium text-[#17221E]">{String(v)}</dd>
                  </div>
                ))}
              </dl>
            )}

            {r.guestNote && (
              <p className="mt-2 rounded bg-white px-2 py-1.5 text-[11px] text-[#53635D]">
                <span className="font-semibold">{isVi ? 'Ghi chú khách: ' : 'Guest note: '}</span>
                {r.guestNote}
              </p>
            )}
            {r.quoteNote && (
              <p className="mt-1 text-[11px] text-[#53635D]">
                <span className="font-semibold">{isVi ? 'Báo giá: ' : 'Quote: '}</span>
                {r.quoteNote} {r.quoteVersion > 0 && `(#${r.quoteVersion})`}
              </p>
            )}
            {r.hostNote && r.status !== 'pending' && (
              <p className="mt-1 text-[11px] text-[#53635D]">
                <span className="font-semibold">{isVi ? 'Ghi chú của bạn: ' : 'Your note: '}</span>
                {r.hostNote}
              </p>
            )}
            {r.status === 'declined' && r.declinedReason && (
              <p className="mt-1 text-[11px] text-red-600">
                {isVi ? 'Lý do: ' : 'Reason: '}
                {r.declinedReason}
              </p>
            )}

            {(canConfirm || canQuote || canInfo || canDecline || canPrepare || canComplete) && (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {canConfirm && (
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    onClick={() => void act(r.id, 'confirm')}
                    className="rounded-lg bg-[#164E3F] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#0F392E] disabled:opacity-50"
                  >
                    {isVi ? 'Xác nhận' : 'Confirm'}
                  </button>
                )}
                {canQuote && (
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    onClick={() => {
                      setQuotingId(quotingId === r.id ? null : r.id);
                      setQuotePrice(r.quotePriceVnd !== null ? String(r.quotePriceVnd) : '');
                      setQuoteNote('');
                    }}
                    className="rounded-lg border border-[#FF5A1F] px-2.5 py-1 text-[11px] font-semibold text-[#FF5A1F] hover:bg-[#FFF3EC] disabled:opacity-50"
                  >
                    {r.status === 'confirmed'
                      ? isVi
                        ? 'Điều chỉnh báo giá'
                        : 'Adjust quote'
                      : isVi
                        ? 'Gửi báo giá'
                        : 'Send quote'}
                  </button>
                )}
                {canInfo && (
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    onClick={() => {
                      const note = window.prompt(
                        isVi
                          ? 'Bạn cần thêm thông tin gì? (khách sẽ nhận thông báo)'
                          : 'What information do you need? (the guest is notified)'
                      );
                      if (note === null) return;
                      void act(r.id, 'request_info', { hostNote: note || '' });
                    }}
                    className="rounded-lg border border-[#E5DFD3] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#17221E] hover:bg-[#FAF8F3] disabled:opacity-50"
                  >
                    {isVi ? 'Yêu cầu thêm info' : 'Request info'}
                  </button>
                )}
                {canPrepare && (
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    onClick={() => void act(r.id, 'prepare')}
                    className="rounded-lg border border-[#E5DFD3] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#17221E] hover:bg-[#FAF8F3] disabled:opacity-50"
                  >
                    {isVi ? 'Đang chuẩn bị' : 'Preparing'}
                  </button>
                )}
                {canComplete && (
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    onClick={() => void act(r.id, 'complete')}
                    className="rounded-lg bg-[#164E3F] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#0F392E] disabled:opacity-50"
                  >
                    {isVi ? 'Hoàn thành' : 'Complete'}
                  </button>
                )}
                {canDecline && (
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    onClick={() => void decline(r.id)}
                    className="rounded-lg border border-[#C25E28]/50 px-2.5 py-1 text-[11px] font-semibold text-[#C25E28] hover:bg-[#FAEDE5] disabled:opacity-50"
                  >
                    {isVi ? 'Từ chối' : 'Decline'}
                  </button>
                )}
                {busyId === r.id && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-[#53635D]" />
                )}
              </div>
            )}

            {quotingId === r.id && (
              <div className="mt-2 space-y-2 rounded-lg border border-[#FF5A1F]/30 bg-white p-2.5">
                <label className="block text-[11px] font-medium text-[#53635D]">
                  {isVi ? 'Giá báo cho khách (VND)' : 'Quote price (VND)'}
                  <input
                    type="number"
                    min={0}
                    step={1000}
                    value={quotePrice}
                    onChange={(e) => setQuotePrice(e.target.value)}
                    className="mt-1 w-full rounded border border-[#E5DFD3] px-2 py-1.5 text-xs text-[#17221E] outline-none focus:border-[#FF5A1F]"
                  />
                </label>
                <label className="block text-[11px] font-medium text-[#53635D]">
                  {isVi ? 'Ghi chú báo giá' : 'Quote note'}
                  <textarea
                    rows={2}
                    value={quoteNote}
                    onChange={(e) => setQuoteNote(e.target.value)}
                    className="mt-1 w-full rounded border border-[#E5DFD3] px-2 py-1.5 text-xs text-[#17221E] outline-none focus:border-[#FF5A1F]"
                  />
                </label>
                <p className="text-[10px] text-[#53635D]">
                  {isVi
                    ? 'Khách phải đồng ý trước khi dịch vụ được xác nhận lại.'
                    : 'The guest must accept before the service is confirmed again.'}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busyId === r.id || quotePrice === ''}
                    onClick={() =>
                      void act(r.id, 'quote', {
                        quotePriceVnd: Number(quotePrice),
                        quoteNote,
                      })
                    }
                    className="rounded-lg bg-[#FF5A1F] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#F04E15] disabled:opacity-50"
                  >
                    {isVi ? 'Gửi báo giá' : 'Send quote'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuotingId(null)}
                    className="rounded-lg border border-[#E5DFD3] px-3 py-1.5 text-[11px] font-semibold text-[#53635D] hover:bg-[#FAF8F3]"
                  >
                    {isVi ? 'Đóng' : 'Close'}
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      <p className="text-[10px] leading-relaxed text-[#53635D]">
        {isVi
          ? 'Khách thanh toán trực tiếp cho bạn/đối tác. VietNomad không thu tiền dịch vụ và không tính hoa hồng trên phần này.'
          : 'Guests pay you or your partner directly. VietNomad collects no service money and no commission on these.'}
      </p>
    </div>
  );
}
