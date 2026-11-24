'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Calendar, Check, Lock, Tag, Unlock } from 'lucide-react';
import { addDaysIso, formatVnd, getTodayIsoInTimezone } from '@/lib/format';
import type { ErrorCode } from '@/lib/errors';
import type { HostCalendarData, HostListingItem } from '@/modules/host';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { StatusBadge } from '@/components/ui/StatusBadge';

interface HostCalendarManagerProps {
  listings: HostListingItem[];
  selectedListingId: string;
  initialCalendar: HostCalendarData;
}

export function HostCalendarManager({
  listings,
  selectedListingId,
  initialCalendar,
}: HostCalendarManagerProps) {
  const router = useRouter();
  const [calendar, setCalendar] = useState<HostCalendarData>(initialCalendar);
  const todayIso = getTodayIsoInTimezone(calendar.timezone);

  const [blockStart, setBlockStart] = useState(addDaysIso(todayIso, 3));
  const [blockEnd, setBlockEnd] = useState(addDaysIso(todayIso, 5));
  const [blockReason, setBlockReason] = useState('Bảo trì căn hộ');

  const [rateStart, setRateStart] = useState(addDaysIso(todayIso, 7));
  const [rateEnd, setRateEnd] = useState(addDaysIso(todayIso, 10));
  const [rateValue, setRateValue] = useState(
    String(calendar.baseNightlyRateVnd)
  );

  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<{ code?: ErrorCode; message: string } | null>(
    null
  );

  async function refreshCalendar() {
    const res = await fetch(
      `/api/host/listings/${selectedListingId}/calendar`
    );
    const json = await res.json();
    if (res.ok && json.ok) {
      setCalendar(json.calendar as HostCalendarData);
    }
    router.refresh();
  }

  async function handleBlockSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(
        `/api/host/listings/${selectedListingId}/calendar/blocks`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            startDate: blockStart,
            endDate: blockEnd,
            reason: blockReason.trim() || undefined,
          }),
        }
      );
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError({
          code: json?.error?.code ?? 'VALIDATION_ERROR',
          message: json?.error?.message ?? 'Không thể khóa ngày.',
        });
        return;
      }
      setNotice(`Đã khóa ${json.blockedDates.length} đêm (${blockStart} -> ${blockEnd}).`);
      await refreshCalendar();
    } catch {
      setError({ code: 'INTERNAL_ERROR', message: 'Lỗi kết nối máy chủ.' });
    } finally {
      setBusy(false);
    }
  }

  async function handleUnblock() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(
        `/api/host/listings/${selectedListingId}/calendar/blocks`,
        {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            startDate: blockStart,
            endDate: blockEnd,
          }),
        }
      );
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError({
          code: json?.error?.code ?? 'VALIDATION_ERROR',
          message: json?.error?.message ?? 'Không thể mở khóa ngày.',
        });
        return;
      }
      setNotice(`Đã mở khóa ${json.unblockedCount} đêm tự khóa trong khoảng đã chọn.`);
      await refreshCalendar();
    } catch {
      setError({ code: 'INTERNAL_ERROR', message: 'Lỗi kết nối máy chủ.' });
    } finally {
      setBusy(false);
    }
  }

  async function handleRateSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const rateNum = Number.parseInt(rateValue, 10);
      const res = await fetch(
        `/api/host/listings/${selectedListingId}/calendar/rates`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            startDate: rateStart,
            endDate: rateEnd,
            nightlyRateVnd: rateNum,
          }),
        }
      );
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError({
          code: json?.error?.code ?? 'VALIDATION_ERROR',
          message: json?.error?.message ?? 'Không thể cập nhật giá.',
        });
        return;
      }
      setNotice(
        `Đã đặt giá ${formatVnd(rateNum, 'vi')} / đêm cho ${json.updatedDates.length} đêm.`
      );
      await refreshCalendar();
    } catch {
      setError({ code: 'INTERNAL_ERROR', message: 'Lỗi kết nối máy chủ.' });
    } finally {
      setBusy(false);
    }
  }

  async function handleClearRates() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(
        `/api/host/listings/${selectedListingId}/calendar/rates`,
        {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            startDate: rateStart,
            endDate: rateEnd,
          }),
        }
      );
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError({
          code: json?.error?.code ?? 'VALIDATION_ERROR',
          message: json?.error?.message ?? 'Không thể xóa giá ghi đè.',
        });
        return;
      }
      setNotice(`Đã khôi phục giá mặc định cho ${json.clearedCount} đêm.`);
      await refreshCalendar();
    } catch {
      setError({ code: 'INTERNAL_ERROR', message: 'Lỗi kết nối máy chủ.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Chọn chỗ ở */}
      <div className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <label
            htmlFor="calendar-listing-select"
            className="block text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]"
          >
            Chọn chỗ ở quản lý lịch & giá
          </label>
          <select
            id="calendar-listing-select"
            value={selectedListingId}
            onChange={(e) =>
              router.push(`/host/calendar?listing=${encodeURIComponent(e.target.value)}`)
            }
            className="min-h-[44px] min-w-[260px] px-3 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] text-sm font-medium"
          >
            {listings.map((l) => (
              <option key={l.id} value={l.id}>
                {l.titleEn} ({l.areaNameVi})
              </option>
            ))}
          </select>
        </div>

        <div className="text-sm text-right">
          <p className="text-xs text-[var(--color-text-muted)]">Giá cơ bản hiện tại</p>
          <p className="font-semibold tabular-nums text-[var(--color-text)]">
            {formatVnd(calendar.baseNightlyRateVnd, 'vi')} / đêm
          </p>
        </div>
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

      {/* Form Khóa/Mở khóa & Giá theo ngày */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <form
          onSubmit={handleBlockSubmit}
          className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-4"
        >
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-[var(--color-primary)]" aria-hidden="true" />
            <h2 className="text-base font-semibold text-[var(--color-text)]">
              Khóa / Mở khóa ngày [Từ ngày, Đến ngày)
            </h2>
          </div>
          <p className="text-xs text-[var(--color-text-muted)]">
            Ngày trả phòng không bị khóa (cho phép nhận khách mới trong ngày trả phòng). Không thể khóa đè lên đêm đã có đơn xác nhận.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="block-start"
                className="block text-xs font-medium text-[var(--color-text-muted)] mb-1"
              >
                Từ đêm (check-in)
              </label>
              <input
                id="block-start"
                type="date"
                min={todayIso}
                required
                value={blockStart}
                onChange={(e) => setBlockStart(e.target.value)}
                className="w-full min-h-[44px] px-3 rounded-[12px] border border-[var(--color-border)] text-sm"
              />
            </div>
            <div>
              <label
                htmlFor="block-end"
                className="block text-xs font-medium text-[var(--color-text-muted)] mb-1"
              >
                Đến trước ngày (check-out)
              </label>
              <input
                id="block-end"
                type="date"
                min={addDaysIso(blockStart || todayIso, 1)}
                required
                value={blockEnd}
                onChange={(e) => setBlockEnd(e.target.value)}
                className="w-full min-h-[44px] px-3 rounded-[12px] border border-[var(--color-border)] text-sm"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="block-reason"
              className="block text-xs font-medium text-[var(--color-text-muted)] mb-1"
            >
              Lý do khóa lịch
            </label>
            <input
              id="block-reason"
              type="text"
              maxLength={300}
              value={blockReason}
              onChange={(e) => setBlockReason(e.target.value)}
              className="w-full min-h-[44px] px-3 rounded-[12px] border border-[var(--color-border)] text-sm"
            />
          </div>

          <div className="flex flex-wrap gap-2.5 pt-1">
            <button
              type="submit"
              disabled={busy}
              className="flex-1 min-h-[44px] px-4 rounded-[12px] bg-[var(--color-primary)] text-white text-sm font-semibold hover:bg-[var(--color-primary-hover)] disabled:opacity-60"
            >
              Khóa khoảng ngày
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={handleUnblock}
              className="min-h-[44px] px-4 rounded-[12px] border border-[var(--color-border)] text-sm font-medium text-[var(--color-text)] inline-flex items-center gap-1.5 hover:border-[var(--color-primary)] disabled:opacity-60"
            >
              <Unlock className="w-4 h-4" aria-hidden="true" />
              <span>Mở khóa</span>
            </button>
          </div>
        </form>

        <form
          onSubmit={handleRateSubmit}
          className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-4"
        >
          <div className="flex items-center gap-2">
            <Tag className="w-5 h-5 text-[var(--color-primary)]" aria-hidden="true" />
            <h2 className="text-base font-semibold text-[var(--color-text)]">
              Đặt giá đặc biệt theo ngày (VND)
            </h2>
          </div>
          <p className="text-xs text-[var(--color-text-muted)]">
            Giá mới áp dụng ngay cho lượt báo giá mới của khách; các đơn đã gửi trước đó vẫn giữ nguyên bản chụp giá cũ.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="rate-start"
                className="block text-xs font-medium text-[var(--color-text-muted)] mb-1"
              >
                Từ đêm
              </label>
              <input
                id="rate-start"
                type="date"
                min={todayIso}
                required
                value={rateStart}
                onChange={(e) => setRateStart(e.target.value)}
                className="w-full min-h-[44px] px-3 rounded-[12px] border border-[var(--color-border)] text-sm"
              />
            </div>
            <div>
              <label
                htmlFor="rate-end"
                className="block text-xs font-medium text-[var(--color-text-muted)] mb-1"
              >
                Đến trước ngày
              </label>
              <input
                id="rate-end"
                type="date"
                min={addDaysIso(rateStart || todayIso, 1)}
                required
                value={rateEnd}
                onChange={(e) => setRateEnd(e.target.value)}
                className="w-full min-h-[44px] px-3 rounded-[12px] border border-[var(--color-border)] text-sm"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="rate-value"
              className="block text-xs font-medium text-[var(--color-text-muted)] mb-1"
            >
              Giá mỗi đêm (số nguyên VND)
            </label>
            <input
              id="rate-value"
              type="number"
              min={50000}
              step={10000}
              required
              value={rateValue}
              onChange={(e) => setRateValue(e.target.value)}
              className="w-full min-h-[44px] px-3 rounded-[12px] border border-[var(--color-border)] text-sm tabular-nums"
            />
          </div>

          <div className="flex flex-wrap gap-2.5 pt-1">
            <button
              type="submit"
              disabled={busy}
              className="flex-1 min-h-[44px] px-4 rounded-[12px] bg-[var(--color-primary)] text-white text-sm font-semibold hover:bg-[var(--color-primary-hover)] disabled:opacity-60"
            >
              Áp dụng giá theo ngày
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={handleClearRates}
              className="min-h-[44px] px-4 rounded-[12px] border border-[var(--color-border)] text-sm font-medium text-[var(--color-text)] hover:border-[var(--color-primary)] disabled:opacity-60"
            >
              Về giá mặc định
            </button>
          </div>
        </form>
      </div>

      {/* Bảng chi tiết 60 ngày tới */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[var(--color-hairline)] bg-[var(--color-surface-ivory)] flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[var(--color-primary)]" aria-hidden="true" />
            <h3 className="text-sm font-semibold text-[var(--color-text)]">
              Các đêm đang khóa trong 60 ngày tới ({calendar.blockedNights.length})
            </h3>
          </div>
          {calendar.blockedNights.length === 0 ? (
            <p className="p-5 text-sm text-[var(--color-text-muted)]">
              Tất cả các đêm trong 60 ngày tới hiện đang trống.
            </p>
          ) : (
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-[var(--color-hairline)] text-xs text-[var(--color-text-muted)]">
                  <th className="py-2.5 px-4">Đêm</th>
                  <th className="py-2.5 px-4">Nguồn khóa</th>
                  <th className="py-2.5 px-4">Chi tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-hairline)]">
                {calendar.blockedNights.map((night) => (
                  <tr key={night.date}>
                    <td className="py-2.5 px-4 tabular-nums font-medium">
                      {night.date}
                    </td>
                    <td className="py-2.5 px-4">
                      <StatusBadge
                        label={
                          night.sourceType === 'booking'
                            ? 'Đơn đã xác nhận'
                            : 'Chủ nhà khóa'
                        }
                        tone={night.sourceType === 'booking' ? 'success' : 'warning'}
                      />
                    </td>
                    <td className="py-2.5 px-4 text-xs text-[var(--color-text-muted)]">
                      {night.sourceType === 'booking'
                        ? `${night.bookingCode} (${night.guestName || 'Khách'})`
                        : night.blockReason || 'Chủ nhà khóa lịch'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[var(--color-hairline)] bg-[var(--color-surface-ivory)] flex items-center gap-2">
            <Tag className="w-4 h-4 text-[var(--color-primary)]" aria-hidden="true" />
            <h3 className="text-sm font-semibold text-[var(--color-text)]">
              Các đêm có giá ghi đè ({calendar.rateOverrides.length})
            </h3>
          </div>
          {calendar.rateOverrides.length === 0 ? (
            <p className="p-5 text-sm text-[var(--color-text-muted)]">
              Chưa có đêm nào đặt giá đặc biệt; áp dụng đồng giá mặc định.
            </p>
          ) : (
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-[var(--color-hairline)] text-xs text-[var(--color-text-muted)]">
                  <th className="py-2.5 px-4">Đêm</th>
                  <th className="py-2.5 px-4">Giá áp dụng (VND)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-hairline)]">
                {calendar.rateOverrides.map((rate) => (
                  <tr key={rate.date}>
                    <td className="py-2.5 px-4 tabular-nums font-medium">
                      {rate.date}
                    </td>
                    <td className="py-2.5 px-4 tabular-nums font-semibold text-[var(--color-primary)]">
                      {formatVnd(rate.nightlyRateVnd, 'vi')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}
