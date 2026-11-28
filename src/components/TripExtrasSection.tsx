'use client';

/**
 * My Trips — "Chuẩn bị cho kỳ lưu trú" (§9 of the Stay Extras spec).
 * Inside an expanded trip ticket: status of each service request, the
 * category-specific details the host needs (flight no, rental dates…),
 * quote accept/reject, cancel/change requests, contact via the existing
 * support inbox, and a reflection link. Never asks for identity documents
 * (passport, licence, ID papers).
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarClock, Loader2, MessageSquare, Send, X } from 'lucide-react';

interface GuestRequest {
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
  createdAt: string;
}

const STATUS_META: Record<string, { vi: string; en: string; cls: string }> = {
  pending: { vi: 'Chờ chủ nhà xác nhận', en: 'Awaiting host', cls: 'bg-amber-50 text-amber-700' },
  awaiting_guest: { vi: 'Chờ bạn phản hồi báo giá', en: 'Quote awaiting you', cls: 'bg-sky-50 text-sky-700' },
  confirmed: { vi: 'Đã xác nhận', en: 'Confirmed', cls: 'bg-emerald-50 text-emerald-700' },
  preparing: { vi: 'Đang chuẩn bị', en: 'Preparing', cls: 'bg-indigo-50 text-indigo-700' },
  completed: { vi: 'Hoàn thành', en: 'Completed', cls: 'bg-stone-100 text-stone-600' },
  declined: { vi: 'Chủ nhà từ chối', en: 'Declined by host', cls: 'bg-red-50 text-red-600' },
  cancelled: { vi: 'Đã hủy', en: 'Cancelled', cls: 'bg-stone-100 text-stone-500' },
};

const AIRPORTS: Record<string, string> = {
  sgn: 'TP. Hồ Chí Minh (SGN)',
  han: 'Hà Nội (HAN)',
  dad: 'Đà Nẵng (DAD)',
};

function priceText(r: GuestRequest, isVi: boolean): string {
  const included = Boolean(r.snapshot?.isIncluded);
  if (included) return isVi ? 'Đã bao gồm' : 'Included';
  if (r.quotePriceVnd !== null) return `${r.quotePriceVnd.toLocaleString('vi-VN')}₫`;
  const p = r.snapshot?.priceVnd;
  if (typeof p === 'number' && p > 0) return `${p.toLocaleString('vi-VN')}₫`;
  return isVi ? 'Theo yêu cầu' : 'By quote';
}

export function TripExtrasSection({
  bookingId,
  staySlug,
  isVi,
}: {
  bookingId: string;
  staySlug: string;
  isVi: boolean;
}) {
  const [rows, setRows] = useState<GuestRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [detailsOpenId, setDetailsOpenId] = useState<string | null>(null);
  const [error, setError] = useState('');

  // Category-specific detail drafts.
  const [draft, setDraft] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/bookings/${bookingId}/service-requests`);
      const json = await res.json();
      if (res.ok) setRows(json?.requests ?? []);
    } catch {
      // Section degrades to empty.
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

  async function post(url: string, body?: Record<string, unknown>, id?: string) {
    if (id) setBusyId(id);
    setError('');
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body ?? {}),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? 'Request failed');
      setDetailsOpenId(null);
      setDraft({});
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed');
    } finally {
      if (id) setBusyId(null);
    }
  }

  function cancelRequest(r: GuestRequest) {
    const msg = isVi
      ? 'Yêu cầu hủy dịch vụ này? Chủ nhà sẽ được thông báo.'
      : 'Cancel this service request? The host will be notified.';
    if (!window.confirm(msg)) return;
    void post(`/api/service-requests/${r.id}/cancel`, { reason: 'Cancelled by guest' }, r.id);
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-[#E5DFD3] bg-[#FAF8F3] p-3.5 text-xs text-[#53635D]">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        {isVi ? 'Đang tải dịch vụ bổ sung…' : 'Loading extra services…'}
      </div>
    );
  }

  const activeRows = rows;

  return (
    <div className="space-y-3 rounded-2xl border border-[#E5DFD3] bg-[#FAF8F3] p-3.5">
      <div className="flex items-center gap-2">
        <CalendarClock className="h-4 w-4 text-[#164E3F]" strokeWidth={1.75} />
        <h3 className="text-sm font-semibold text-[#17221E]">
          {isVi ? 'Chuẩn bị cho kỳ lưu trú' : 'Prepare for your stay'}
        </h3>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-[11px] text-red-600" role="alert">
          {error}
        </p>
      )}

      {activeRows.length === 0 && (
        <p className="text-xs leading-relaxed text-[#53635D]">
          {isVi ? (
            <>
              Bạn chưa yêu cầu dịch vụ bổ sung. Xem{' '}
              <Link href={`/stays/${staySlug}#extra-services`} className="font-semibold text-[#FF5A1F] hover:underline">
                dịch vụ bổ sung tại chỗ ở
              </Link>{' '}
              và yêu cầu sau khi đặt chỗ.
            </>
          ) : (
            <>
              No extra services yet. Browse{' '}
              <Link href={`/stays/${staySlug}#extra-services`} className="font-semibold text-[#FF5A1F] hover:underline">
                additional services on the stay page
              </Link>{' '}
              and request them after booking.
            </>
          )}
        </p>
      )}

      {activeRows.map((r) => {
        const meta = STATUS_META[r.status] ?? STATUS_META.pending;
        const name = isVi
          ? String(r.snapshot?.nameVi ?? r.catalogKey)
          : String(r.snapshot?.nameEn ?? r.catalogKey);
        const isActive = ['pending', 'awaiting_guest', 'confirmed', 'preparing'].includes(r.status);
        const awaitingQuote = r.status === 'awaiting_guest';
        const details = Object.entries(r.guestDetails ?? {});
        const detailsFields = detailsFieldsFor(r.catalogKey);

        return (
          <div key={r.id} className="rounded-xl border border-[#E5DFD3] bg-white p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[#17221E]">{name}</p>
                <p className="mt-0.5 text-[11px] text-[#53635D]">
                  {priceText(r, isVi)}
                  {r.quantity > 1 && ` · ×${r.quantity}`}
                  {r.desiredAt && ` · ${r.desiredAt.slice(0, 16).replace('T', ' ')}`}
                </p>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${meta.cls}`}>
                {isVi ? meta.vi : meta.en}
              </span>
            </div>

            {awaitingQuote && (
              <div className="mt-2 space-y-2 rounded-lg border border-sky-200 bg-sky-50 p-2.5 text-[11px]">
                <p className="font-semibold text-sky-800">
                  {isVi ? 'Báo giá mới' : 'New quote'} #{r.quoteVersion}:{' '}
                  {r.quotePriceVnd !== null && `${r.quotePriceVnd.toLocaleString('vi-VN')}₫`}
                </p>
                {r.quoteNote && <p className="text-sky-700">{r.quoteNote}</p>}
                <p className="text-sky-700">
                  {isVi
                    ? 'Bạn phải đồng ý trước khi dịch vụ được xác nhận. Đồng ý = chấp nhận đúng báo giá này.'
                    : 'You must accept before the service is confirmed. Accepting approves exactly this quote.'}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    onClick={() =>
                      void post(`/api/service-requests/${r.id}/quote`, {
                        accept: true,
                        quoteVersion: r.quoteVersion,
                      }, r.id)
                    }
                    className="rounded-lg bg-[#164E3F] px-3 py-1.5 font-semibold text-white hover:bg-[#0F392E] disabled:opacity-50"
                  >
                    {isVi ? 'Đồng ý báo giá' : 'Accept quote'}
                  </button>
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    onClick={() =>
                      void post(`/api/service-requests/${r.id}/quote`, {
                        accept: false,
                        quoteVersion: r.quoteVersion,
                      }, r.id)
                    }
                    className="rounded-lg border border-[#E5DFD3] px-3 py-1.5 font-semibold text-[#53635D] hover:bg-[#FAF8F3] disabled:opacity-50"
                  >
                    {isVi ? 'Từ chối' : 'Decline'}
                  </button>
                </div>
              </div>
            )}

            {details.length > 0 && (
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                {details.map(([k, v]) => (
                  <div key={k} className="flex gap-1">
                    <dt className="text-[#53635D]">{isVi ? viDetail(k) : enDetail(k)}:</dt>
                    <dd className="font-medium text-[#17221E]">{String(v)}</dd>
                  </div>
                ))}
              </dl>
            )}

            <div className="mt-2.5 flex flex-wrap gap-2">
              {isActive && (
                <button
                  type="button"
                  onClick={() =>
                    setDetailsOpenId(detailsOpenId === r.id ? null : r.id)
                  }
                  className="rounded-lg border border-[#FF5A1F] px-2.5 py-1 text-[11px] font-semibold text-[#FF5A1F] hover:bg-[#FFF3EC]"
                >
                  {details.length > 0
                    ? isVi
                      ? 'Cập nhật thông tin'
                      : 'Update details'
                    : isVi
                      ? 'Cung cấp thông tin'
                      : 'Provide details'}
                </button>
              )}
              {isActive && r.status !== 'completed' && (
                <button
                  type="button"
                  disabled={busyId === r.id}
                  onClick={() => cancelRequest(r)}
                  className="rounded-lg border border-[#E5DFD3] px-2.5 py-1 text-[11px] font-semibold text-[#53635D] hover:bg-[#FAF8F3] disabled:opacity-50"
                >
                  {isVi ? 'Yêu cầu hủy / đổi' : 'Request change / cancel'}
                </button>
              )}
              <a
                href="#support-center"
                className="inline-flex items-center gap-1 rounded-lg border border-[#E5DFD3] px-2.5 py-1 text-[11px] font-semibold text-[#164E3F] hover:bg-[#E7F1EC]"
              >
                <MessageSquare className="h-3 w-3" />
                {isVi ? 'Liên hệ CSKH' : 'Contact support'}
              </a>
            </div>

            {detailsOpenId === r.id && detailsFields && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const payload: Record<string, string> = {};
                  for (const f of detailsFields) {
                    const v = (draft[`${r.id}:${f.key}`] ?? '').trim();
                    if (v) payload[f.key] = v;
                  }
                  void post(`/api/service-requests/${r.id}/details`, { details: payload }, r.id);
                }}
                className="mt-2.5 space-y-2 rounded-lg border border-[#E5DFD3] bg-[#FAF8F3] p-2.5"
              >
                <p className="text-[11px] font-semibold text-[#17221E]">
                  {isVi
                    ? 'Chủ nhà cần thông tin này để chuẩn bị dịch vụ.'
                    : 'The host needs this to prepare the service.'}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {detailsFields.map((f) => (
                    <label key={f.key} className="block text-[11px] text-[#53635D]">
                      {isVi ? f.vi : f.en}
                      {f.key === 'airport' ? (
                        <select
                          value={draft[`${r.id}:${f.key}`] ?? ''}
                          onChange={(e) =>
                            setDraft((d) => ({ ...d, [`${r.id}:${f.key}`]: e.target.value }))
                          }
                          className="mt-0.5 w-full rounded border border-[#E5DFD3] bg-white px-2 py-1.5 text-[11px] text-[#17221E] outline-none focus:border-[#FF5A1F]"
                        >
                          <option value="">—</option>
                          {Object.entries(AIRPORTS).map(([k, label]) => (
                            <option key={k} value={k}>
                              {label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={f.type === 'date' ? 'date' : f.type === 'time' ? 'time' : 'text'}
                          value={draft[`${r.id}:${f.key}`] ?? ''}
                          onChange={(e) =>
                            setDraft((d) => ({ ...d, [`${r.id}:${f.key}`]: e.target.value }))
                          }
                          className="mt-0.5 w-full rounded border border-[#E5DFD3] bg-white px-2 py-1.5 text-[11px] text-[#17221E] outline-none focus:border-[#FF5A1F]"
                        />
                      )}
                    </label>
                  ))}
                </div>
                <p className="text-[10px] text-[#53635D]">
                  {isVi
                    ? 'Chỉ cần thông tin chuyến đi/đặt lịch — không nộp giấy tờ tùy thân, hộ chiếu hay GPLX.'
                    : 'Trip details only — never upload ID papers, passports, or licences.'}
                </p>
                <button
                  type="submit"
                  disabled={busyId === r.id}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#164E3F] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#0F392E] disabled:opacity-50"
                >
                  {busyId === r.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Send className="h-3 w-3" />
                  )}
                  {isVi ? 'Gửi cho chủ nhà' : 'Send to host'}
                </button>
              </form>
            )}
          </div>
        );
      })}

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-[#53635D]">
        <span>
          {isVi
            ? 'Thanh toán trực tiếp cho bên cung cấp sau khi chủ nhà xác nhận.'
            : 'Pay the provider directly after the host confirms.'}
        </span>
        <Link href="#support-center" className="inline-flex items-center gap-1 font-semibold text-[#164E3F] hover:underline">
          <X className="h-3 w-3" aria-hidden="true" />
          {isVi ? 'Phản ánh với VietNomad' : 'Send feedback to VietNomad'}
        </Link>
      </div>
    </div>
  );
}

interface DetailField {
  key: string;
  vi: string;
  en: string;
  type?: 'text' | 'date' | 'time';
}

function detailsFieldsFor(catalogKey: string): DetailField[] | null {
  switch (catalogKey) {
    case 'airport_pickup':
    case 'airport_dropoff':
      return [
        { key: 'airport', vi: 'Sân bay', en: 'Airport' },
        { key: 'flightNo', vi: 'Số chuyến', en: 'Flight number' },
        { key: 'landingAt', vi: 'Giờ hạ cánh', en: 'Landing time', type: 'time' },
        { key: 'pax', vi: 'Số người', en: 'Passengers' },
        { key: 'luggage', vi: 'Hành lý', en: 'Luggage' },
      ];
    case 'motorbike_rental':
    case 'bike_rental':
      return [
        { key: 'pickupDate', vi: 'Ngày nhận', en: 'Pickup date', type: 'date' },
        { key: 'returnDate', vi: 'Ngày trả', en: 'Return date', type: 'date' },
        { key: 'quantity', vi: 'Số lượng', en: 'Quantity' },
      ];
    case 'monitor_rental':
    case 'work_gear_rental':
      return [
        { key: 'neededDate', vi: 'Ngày cần thuê', en: 'Needed date', type: 'date' },
        { key: 'durationDays', vi: 'Số ngày', en: 'Days' },
      ];
    case 'room_cleaning':
      return [
        { key: 'date', vi: 'Ngày dọn', en: 'Cleaning date', type: 'date' },
        { key: 'time', vi: 'Giờ mong muốn', en: 'Preferred time', type: 'time' },
        { key: 'frequency', vi: 'Tần suất', en: 'Frequency' },
      ];
    case 'laundry':
      return [
        { key: 'date', vi: 'Ngày giặt', en: 'Laundry date', type: 'date' },
        { key: 'note', vi: 'Ghi chú', en: 'Note' },
      ];
    case 'coworking_pass':
      return [
        { key: 'startDate', vi: 'Ngày bắt đầu', en: 'Start date', type: 'date' },
        { key: 'days', vi: 'Số ngày', en: 'Days' },
      ];
    default:
      return null;
  }
}

function viDetail(k: string): string {
  const map: Record<string, string> = {
    airport: 'Sân bay',
    flightNo: 'Số chuyến',
    landingAt: 'Giờ hạ cánh',
    pax: 'Số người',
    luggage: 'Hành lý',
    pickupDate: 'Ngày nhận',
    returnDate: 'Ngày trả',
    quantity: 'Số lượng',
    neededDate: 'Ngày cần',
    durationDays: 'Số ngày',
    date: 'Ngày',
    time: 'Giờ',
    frequency: 'Tần suất',
    startDate: 'Ngày bắt đầu',
    days: 'Số ngày',
    note: 'Ghi chú',
  };
  return map[k] ?? k;
}

function enDetail(k: string): string {
  const map: Record<string, string> = {
    airport: 'Airport',
    flightNo: 'Flight',
    landingAt: 'Landing time',
    pax: 'Passengers',
    luggage: 'Luggage',
    pickupDate: 'Pickup date',
    returnDate: 'Return date',
    quantity: 'Quantity',
    neededDate: 'Needed date',
    durationDays: 'Days',
    date: 'Date',
    time: 'Time',
    frequency: 'Frequency',
    startDate: 'Start date',
    days: 'Days',
    note: 'Note',
  };
  return map[k] ?? k;
}
