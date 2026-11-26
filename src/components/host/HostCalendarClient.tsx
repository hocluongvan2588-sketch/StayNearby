'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  Calendar as CalendarIcon,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Layers,
  Loader2,
  Lock,
  RefreshCw,
  Tag,
  Unlock,
} from 'lucide-react';
import { formatVndExact } from '@/lib/i18n';
import { usePreferences } from '@/components/PreferencesProvider';
import type { HostCalendarData } from '@/modules/host-console';

function addDaysUtc(iso: string, delta: number): string {
  const dt = new Date(`${iso}T00:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
}

function shiftMonthFirst(iso: string, deltaMonths: number): string {
  const y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7));
  const dt = new Date(Date.UTC(y, m - 1 + deltaMonths, 1));
  return dt.toISOString().slice(0, 10);
}

export function HostCalendarClient({
  initialData,
}: {
  initialData: HostCalendarData;
}) {
  const { locale, formatMoney } = usePreferences();
  const isVi = locale === 'vi';

  const [data, setData] = useState<HostCalendarData>(initialData);
  const [viewMode, setViewMode] = useState<'single' | 'timeline'>('single');
  const [selectedRoomId, setSelectedRoomId] = useState<string>(
    initialData.rooms[0]?.id ?? ''
  );
  const [rangeStart, setRangeStart] = useState<string>('');
  const [rangeEnd, setRangeEnd] = useState<string>('');
  const [actionMode, setActionMode] = useState<'unblock' | 'block' | 'keep'>('unblock');
  const [customPrice, setCustomPrice] = useState<string>('');
  const [clearPrice, setClearPrice] = useState(false);
  const [minNights, setMinNights] = useState<string>('');
  const [note, setNote] = useState('');

  const [icalUrlInput, setIcalUrlInput] = useState<string>(
    initialData.rooms[0]?.icalUrl ?? ''
  );
  const [copiedId, setCopiedId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const selectedRoom = useMemo(
    () => data.rooms.find((r) => r.id === selectedRoomId) ?? data.rooms[0],
    [data.rooms, selectedRoomId]
  );

  const windowDates = useMemo(() => {
    const out: string[] = [];
    for (let i = 0; i < data.days; i++) {
      out.push(addDaysUtc(data.startDate, i));
    }
    return out;
  }, [data.startDate, data.days]);

  const leadingBlanks = useMemo(() => {
    if (!data.startDate) return 0;
    const dow = new Date(`${data.startDate}T00:00:00Z`).getUTCDay();
    return (dow + 6) % 7;
  }, [data.startDate]);

  function getCellInfo(roomId: string, dt: string) {
    const room = data.rooms.find((r) => r.id === roomId);
    const lock = data.locks.find((l) => l.roomId === roomId && l.stayDate === dt);
    const booking = data.bookings.find(
      (b) => b.roomId === roomId && dt >= b.checkIn && dt < b.checkOut
    );
    const unitsTotal = room?.unitsTotal ?? 1;
    const bookedUnits = lock?.bookedUnits ?? 0;
    const blockedUnits = lock?.blockedUnits ?? 0;

    let state: 'available' | 'booked' | 'pending' | 'blocked' = 'available';
    if (booking) {
      state =
        booking.status === 'PENDING_HOST_APPROVAL' || booking.status === 'PENDING_PAYMENT'
          ? 'pending'
          : 'booked';
    } else if (bookedUnits >= unitsTotal) {
      state = 'booked';
    } else if (bookedUnits + blockedUnits >= unitsTotal || blockedUnits > 0) {
      state = 'blocked';
    }

    const baseNightly =
      room && room.wholesale7Vnd > 0
        ? Math.round(room.wholesale7Vnd / 7)
        : room?.extraNightVnd ?? 0;
    const effectiveNightlyVnd =
      lock?.customNightlyVnd !== null && lock?.customNightlyVnd !== undefined
        ? lock.customNightlyVnd
        : baseNightly;

    return {
      state,
      customNightlyVnd: lock?.customNightlyVnd ?? null,
      effectiveNightlyVnd,
      minNights: lock?.minNights ?? null,
      note: lock?.note ?? '',
      booking,
    };
  }

  async function loadStartDate(startDate: string) {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch(
        `/api/host/calendar?startDate=${encodeURIComponent(startDate)}&days=35`
      );
      const json = await res.json();
      if (!json.ok) {
        setErrorMsg(json.error?.message ?? 'Could not load calendar.');
        return;
      }
      setData(json);
    } finally {
      setLoading(false);
    }
  }

  function handleDayClick(date: string, roomId?: string) {
    if (roomId && roomId !== selectedRoomId) {
      setSelectedRoomId(roomId);
      const rm = data.rooms.find((r) => r.id === roomId);
      setIcalUrlInput(rm?.icalUrl ?? '');
    }
    if (!rangeStart || (rangeStart && rangeEnd)) {
      setRangeStart(date);
      setRangeEnd('');
    } else if (date < rangeStart) {
      setRangeEnd(rangeStart);
      setRangeStart(date);
    } else {
      setRangeEnd(date);
    }
  }

  async function applyRangeUpdate() {
    if (!selectedRoom || !rangeStart) return;
    const end = rangeEnd || rangeStart;
    setSaving(true);
    setErrorMsg('');
    setNotice('');
    try {
      const payload: Record<string, unknown> = {
        roomId: selectedRoom.id,
        startDate: rangeStart,
        endDate: end,
      };
      if (actionMode === 'block') payload.block = true;
      else if (actionMode === 'unblock') payload.block = false;

      if (clearPrice) {
        payload.customNightlyVnd = null;
      } else if (customPrice.trim() !== '') {
        payload.customNightlyVnd = Number(customPrice);
      }
      if (minNights.trim() !== '') {
        payload.minNights = Math.max(7, Number(minNights));
      }
      if (note.trim() !== '') {
        payload.note = note.trim();
      }

      const res = await fetch('/api/host/calendar/range', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.ok) {
        setErrorMsg(json.error?.message ?? 'Could not update calendar.');
        return;
      }
      setNotice(
        isVi
          ? `Đã cập nhật ${json.updatedDays} ngày từ ${rangeStart} đến ${end}.`
          : `Updated ${json.updatedDays} date(s) from ${rangeStart} to ${end}.`
      );
      setCustomPrice('');
      setClearPrice(false);
      await loadStartDate(data.startDate);
    } finally {
      setSaving(false);
    }
  }

  async function handleIcalSync() {
    if (!selectedRoom) return;
    setSaving(true);
    setErrorMsg('');
    setNotice('');
    try {
      const res = await fetch('/api/host/ical', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: selectedRoom.id,
          icalUrl: icalUrlInput.trim(),
        }),
      });
      const json = await res.json();
      if (!json.ok) {
        setErrorMsg(json.error?.message ?? 'iCal sync failed.');
        return;
      }
      setNotice(
        isVi
          ? `Đã đồng bộ iCal (${json.sync?.blockedDatesCount ?? 0} đêm được khóa từ lịch ngoài).`
          : `Synced iCal (${json.sync?.blockedDatesCount ?? 0} blocked date(s)).`
      );
      await loadStartDate(data.startDate);
    } finally {
      setSaving(false);
    }
  }

  function copyExportUrl(roomId: string) {
    const path = `/api/host/ical/export/${roomId}`;
    const full =
      typeof window !== 'undefined' ? `${window.location.origin}${path}` : path;
    navigator.clipboard?.writeText(full);
    setCopiedId(roomId);
    setTimeout(() => setCopiedId(''), 2000);
  }

  if (data.rooms.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[#E5DFD3] bg-white p-10 text-center">
        <CalendarIcon className="mx-auto h-9 w-9 text-[#53635D]" strokeWidth={1.5} />
        <h2 className="mt-3 text-base font-semibold text-[#17221E]">
          {isVi ? 'Bạn chưa có phòng nào để quản lý lịch' : 'No properties in your calendar yet'}
        </h2>
        <p className="mt-1 text-xs text-[#53635D]">
          {isVi
            ? 'Hãy tạo cơ sở lưu trú đầu tiên để mở lịch bán phòng, giá từng ngày và đồng bộ iCal.'
            : 'Create your first listing to manage daily availability, pricing overrides, and iCal sync.'}
        </p>
        <Link
          href="/host/listings/new"
          className="mt-4 inline-flex items-center rounded-lg bg-[#164E3F] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0F392E]"
        >
          {isVi ? 'Tạo cơ sở mới' : 'Create listing'}
        </Link>
      </div>
    );
  }

  const weekdayLabels = isVi
    ? ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']
    : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const effectiveEnd = rangeEnd || rangeStart;
  const displayYm = data.startDate.slice(0, 7);

  return (
    <div className="space-y-5">
      {/* Header Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif-display text-2xl font-semibold text-[#17221E]">
            {isVi ? 'Lịch & Giá bán phòng' : 'Calendar & Pricing'}
          </h1>
          <p className="mt-0.5 text-xs text-[#53635D]">
            {isVi
              ? 'Giá tùy chỉnh theo ngày sẽ ghi đè mức giá gói 7/14/21/30 đêm cho riêng các đêm đó.'
              : 'Custom daily rates override 7/14/21/30-night package rates for those specific nights.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-[#E5DFD3] bg-white p-0.5 text-xs font-medium">
            <button
              type="button"
              onClick={() => setViewMode('single')}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 ${
                viewMode === 'single'
                  ? 'bg-[#164E3F] font-semibold text-white'
                  : 'text-[#53635D] hover:text-[#17221E]'
              }`}
            >
              <CalendarIcon className="h-3.5 w-3.5" />
              {isVi ? 'Theo căn' : 'Single listing'}
            </button>
            <button
              type="button"
              onClick={() => setViewMode('timeline')}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 ${
                viewMode === 'timeline'
                  ? 'bg-[#164E3F] font-semibold text-white'
                  : 'text-[#53635D] hover:text-[#17221E]'
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              {isVi ? 'Đa cơ sở' : 'Multi-listing'}
            </button>
          </div>

          <div className="flex items-center gap-1 rounded-lg border border-[#E5DFD3] bg-white px-2 py-1 text-xs font-semibold text-[#17221E]">
            <button
              type="button"
              onClick={() => loadStartDate(shiftMonthFirst(data.startDate, -1))}
              className="rounded p-1 hover:bg-[#FAF8F3]"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[74px] text-center font-mono">{displayYm}</span>
            <button
              type="button"
              onClick={() => loadStartDate(shiftMonthFirst(data.startDate, 1))}
              className="rounded p-1 hover:bg-[#FAF8F3]"
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {loading && <Loader2 className="h-4 w-4 animate-spin text-[#164E3F]" />}
        </div>
      </div>

      {notice && (
        <div className="rounded-xl border border-[#164E3F]/30 bg-[#E7F1EC] px-4 py-2.5 text-xs font-medium text-[#164E3F]">
          {notice}
        </div>
      )}
      {errorMsg && (
        <div className="rounded-xl border border-[#C25E28]/40 bg-[#FAEDE5] px-4 py-2.5 text-xs font-medium text-[#C25E28]">
          {errorMsg}
        </div>
      )}

      {/* Legend + Room Selector */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E5DFD3] bg-white px-4 py-3">
        {viewMode === 'single' ? (
          <select
            value={selectedRoom?.id ?? ''}
            onChange={(e) => {
              const id = e.target.value;
              setSelectedRoomId(id);
              const rm = data.rooms.find((r) => r.id === id);
              setIcalUrlInput(rm?.icalUrl ?? '');
            }}
            className="rounded-lg border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-1.5 text-xs font-semibold text-[#17221E] outline-none focus:border-[#164E3F]"
          >
            {data.rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {isVi ? `${r.stayTitleVi} — ${r.nameVi}` : `${r.stayTitleEn} — ${r.nameEn}`}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-xs font-semibold text-[#17221E]">
            {isVi
              ? `Đang hiển thị ${data.rooms.length} phòng từ ${data.startDate}`
              : `Showing ${data.rooms.length} rooms starting ${data.startDate}`}
          </span>
        )}

        <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#53635D]">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded border border-[#E5DFD3] bg-white" />
            {isVi ? 'Còn trống' : 'Available'}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded border border-[#164E3F]/40 bg-[#E7F1EC]" />
            {isVi ? 'Đã đặt' : 'Booked'}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded border border-[#A67C2E]/40 bg-[#FDF4DF]" />
            {isVi ? 'Chờ duyệt' : 'Pending'}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded border border-[#D4CEC2] bg-[#EAE5DA]" />
            {isVi ? 'Đã khóa / iCal' : 'Blocked / iCal'}
          </span>
        </div>
      </div>

      {/* Main Split Layout */}
      <div className="grid gap-5 lg:grid-cols-12">
        <div className="lg:col-span-8">
          {viewMode === 'single' && selectedRoom ? (
            <div className="rounded-xl border border-[#E5DFD3] bg-white p-4">
              <div className="grid grid-cols-7 gap-1.5 pb-2 text-center text-[11px] font-semibold text-[#53635D]">
                {weekdayLabels.map((w) => (
                  <div key={w}>{w}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                {Array.from({ length: leadingBlanks }).map((_, idx) => (
                  <div key={`blank-${idx}`} className="h-20 rounded-lg bg-[#FAF8F3]/50" />
                ))}
                {windowDates.map((dt) => {
                  const info = getCellInfo(selectedRoom.id, dt);
                  const isSelected =
                    rangeStart && dt >= rangeStart && dt <= (effectiveEnd || rangeStart);
                  const stateCls =
                    info.state === 'booked'
                      ? 'border-[#164E3F]/40 bg-[#E7F1EC]'
                      : info.state === 'pending'
                        ? 'border-[#A67C2E]/40 bg-[#FDF4DF]'
                        : info.state === 'blocked'
                          ? 'border-[#D4CEC2] bg-[#EAE5DA] text-[#53635D]'
                          : 'border-[#E5DFD3] bg-white hover:border-[#164E3F]';
                  const dayLabel = dt.slice(8, 10);
                  return (
                    <button
                      key={dt}
                      type="button"
                      onClick={() => handleDayClick(dt, selectedRoom.id)}
                      className={`flex h-20 flex-col justify-between rounded-lg border p-2 text-left transition ${stateCls} ${
                        isSelected ? 'ring-2 ring-[#164E3F]' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs font-semibold text-[#17221E]">
                        <span>{Number(dayLabel)}</span>
                        {info.minNights && (
                          <span className="rounded bg-white/80 px-1 text-[9px] text-[#53635D]">
                            {info.minNights}n+
                          </span>
                        )}
                      </div>
                      <div>
                        {info.state === 'booked' || info.state === 'pending' ? (
                          <div className="truncate text-[10px] font-semibold text-[#164E3F]">
                            {info.booking?.guestName ?? info.booking?.bookingCode ?? 'Booked'}
                          </div>
                        ) : info.state === 'blocked' ? (
                          <div className="truncate text-[10px] font-medium text-[#53635D]">
                            {isVi ? 'Đã khóa' : 'Blocked'}
                          </div>
                        ) : (
                          <div
                            className={`truncate text-[10px] font-semibold ${
                              info.customNightlyVnd !== null
                                ? 'text-[#C25E28]'
                                : 'text-[#53635D]'
                            }`}
                          >
                            {formatMoney(info.effectiveNightlyVnd)}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-[#E5DFD3] bg-white">
              <table className="min-w-max border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#E5DFD3] bg-[#FAF8F3]">
                    <th className="sticky left-0 z-10 min-w-[180px] border-r border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2.5 text-left font-semibold text-[#17221E]">
                      {isVi ? 'Cơ sở / Phòng' : 'Listing / Room'}
                    </th>
                    {windowDates.map((d) => (
                      <th
                        key={d}
                        className="min-w-[44px] border-r border-[#E5DFD3] px-1.5 py-2 text-center font-mono text-[11px] font-medium text-[#53635D]"
                      >
                        {d.slice(8, 10)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5DFD3]">
                  {data.rooms.map((rm) => (
                    <tr key={rm.id}>
                      <td className="sticky left-0 z-10 border-r border-[#E5DFD3] bg-white px-3 py-2.5">
                        <div className="max-w-[180px] truncate font-semibold text-[#17221E]">
                          {isVi ? rm.stayTitleVi : rm.stayTitleEn}
                        </div>
                        <div className="max-w-[180px] truncate text-[11px] text-[#53635D]">
                          {isVi ? rm.nameVi : rm.nameEn}
                        </div>
                      </td>
                      {windowDates.map((dt) => {
                        const cell = getCellInfo(rm.id, dt);
                        const bg =
                          cell.state === 'booked'
                            ? 'bg-[#E7F1EC] text-[#164E3F]'
                            : cell.state === 'pending'
                              ? 'bg-[#FDF4DF] text-[#8E651A]'
                              : cell.state === 'blocked'
                                ? 'bg-[#EAE5DA] text-[#53635D]'
                                : 'bg-white text-[#17221E] hover:bg-[#FAF8F3]';
                        const isSel =
                          selectedRoom?.id === rm.id &&
                          rangeStart &&
                          dt >= rangeStart &&
                          dt <= (effectiveEnd || rangeStart);
                        return (
                          <td key={dt} className="border-r border-[#E5DFD3] p-0">
                            <button
                              type="button"
                              onClick={() => handleDayClick(dt, rm.id)}
                              title={
                                cell.booking
                                  ? `${cell.booking.bookingCode}: ${cell.booking.guestName}`
                                  : formatVndExact(cell.effectiveNightlyVnd)
                              }
                              className={`flex h-11 w-full items-center justify-center text-[10px] font-medium ${bg} ${
                                isSel ? 'ring-2 ring-inset ring-[#164E3F]' : ''
                              }`}
                            >
                              {cell.state === 'booked'
                                ? 'B'
                                : cell.state === 'pending'
                                  ? 'P'
                                  : cell.state === 'blocked'
                                    ? '×'
                                    : `${Math.round(cell.effectiveNightlyVnd / 1000)}k`}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Package Pricing Fallback Card */}
          {selectedRoom && (
            <div className="mt-4 rounded-xl border border-[#E5DFD3] bg-white p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[#53635D]">
                  {isVi
                    ? 'Giá gói dài ngày mặc định (khi không cài giá riêng)'
                    : 'Default long-stay packages (fallback for unoverridden nights)'}
                </h3>
                <Link
                  href={`/host/listings/${selectedRoom.stayId}`}
                  className="text-xs font-semibold text-[#164E3F] hover:underline"
                >
                  {isVi ? 'Sửa giá gói' : 'Edit packages'}
                </Link>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                {[
                  { nights: 7, rate: selectedRoom.wholesale7Vnd },
                  { nights: 14, rate: selectedRoom.wholesale14Vnd },
                  { nights: 21, rate: selectedRoom.wholesale21Vnd },
                  { nights: 30, rate: selectedRoom.wholesale30Vnd },
                ].map((p) => (
                  <div
                    key={p.nights}
                    className="rounded-lg border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2 text-xs"
                  >
                    <div className="font-semibold text-[#17221E]">
                      {p.nights} {isVi ? 'đêm' : 'nights'}
                    </div>
                    <div className="mt-0.5 font-medium text-[#164E3F]">
                      {formatMoney(p.rate)}
                    </div>
                    <div className="text-[10px] text-[#53635D]">
                      ~{formatVndExact(Math.round(p.rate / p.nights))}/{isVi ? 'đêm' : 'nt'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Side Control Panel */}
        <aside className="space-y-4 lg:col-span-4">
          <div className="space-y-4 rounded-xl border border-[#E5DFD3] bg-white p-5">
            <h2 className="text-sm font-semibold text-[#17221E]">
              {isVi ? 'Cập nhật ngày & giá' : 'Edit Selected Dates'}
            </h2>

            {!rangeStart ? (
              <p className="rounded-lg border border-dashed border-[#E5DFD3] bg-[#FAF8F3] p-4 text-xs text-[#53635D]">
                {isVi
                  ? 'Chọn ngày bắt đầu và ngày kết thúc trên lịch bên trái để mở bán, khóa ngày hoặc đặt giá tùy chỉnh.'
                  : 'Click a start date and end date on the calendar to open/block dates or override nightly pricing.'}
              </p>
            ) : (
              <div className="space-y-3 text-xs">
                <div className="rounded-lg border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2">
                  <div className="text-[#53635D]">{isVi ? 'Khoảng ngày:' : 'Selected range:'}</div>
                  <div className="mt-0.5 font-mono font-semibold text-[#17221E]">
                    {rangeStart} → {effectiveEnd}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setActionMode('unblock')}
                    className={`inline-flex items-center justify-center gap-1 rounded-lg border py-2 font-medium ${
                      actionMode === 'unblock'
                        ? 'border-[#164E3F] bg-[#E7F1EC] text-[#164E3F]'
                        : 'border-[#E5DFD3] text-[#53635D]'
                    }`}
                  >
                    <Unlock className="h-3.5 w-3.5" />
                    {isVi ? 'Mở bán' : 'Open'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActionMode('block')}
                    className={`inline-flex items-center justify-center gap-1 rounded-lg border py-2 font-medium ${
                      actionMode === 'block'
                        ? 'border-[#C25E28] bg-[#FAEDE5] text-[#C25E28]'
                        : 'border-[#E5DFD3] text-[#53635D]'
                    }`}
                  >
                    <Lock className="h-3.5 w-3.5" />
                    {isVi ? 'Khóa' : 'Block'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActionMode('keep')}
                    className={`inline-flex items-center justify-center gap-1 rounded-lg border py-2 font-medium ${
                      actionMode === 'keep'
                        ? 'border-[#17221E] bg-[#FAF8F3] text-[#17221E]'
                        : 'border-[#E5DFD3] text-[#53635D]'
                    }`}
                  >
                    {isVi ? 'Giữ' : 'Keep'}
                  </button>
                </div>

                <div>
                  <label className="mb-1 flex items-center justify-between font-semibold text-[#17221E]">
                    <span className="inline-flex items-center gap-1">
                      <Tag className="h-3.5 w-3.5 text-[#53635D]" />
                      {isVi ? 'Giá riêng mỗi đêm (VND)' : 'Custom nightly rate (VND)'}
                    </span>
                    <label className="inline-flex items-center gap-1 font-normal text-[#53635D]">
                      <input
                        type="checkbox"
                        checked={clearPrice}
                        onChange={(e) => setClearPrice(e.target.checked)}
                      />
                      {isVi ? 'Về mặc định' : 'Reset'}
                    </label>
                  </label>
                  <input
                    type="number"
                    min={50000}
                    step={10000}
                    disabled={clearPrice}
                    value={customPrice}
                    onChange={(e) => setCustomPrice(e.target.value)}
                    placeholder="750000"
                    className="w-full rounded-lg border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2 outline-none focus:border-[#164E3F] disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="mb-1 block font-semibold text-[#17221E]">
                    {isVi ? 'Số đêm tối thiểu (7–90)' : 'Minimum nights (7–90)'}
                  </label>
                  <input
                    type="number"
                    min={7}
                    max={90}
                    value={minNights}
                    onChange={(e) => setMinNights(e.target.value)}
                    placeholder={`${selectedRoom?.defaultMinNights ?? 7}`}
                    className="w-full rounded-lg border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2 outline-none focus:border-[#164E3F]"
                  />
                </div>

                <div>
                  <label className="mb-1 block font-semibold text-[#17221E]">
                    {isVi ? 'Ghi chú' : 'Note'}
                  </label>
                  <input
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="w-full rounded-lg border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2 outline-none focus:border-[#164E3F]"
                  />
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={applyRangeUpdate}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#164E3F] px-3 py-2.5 text-xs font-semibold text-white hover:bg-[#0F392E] disabled:opacity-60"
                  >
                    {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    {isVi ? 'Lưu cập nhật' : 'Apply changes'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRangeStart('');
                      setRangeEnd('');
                    }}
                    className="rounded-lg border border-[#E5DFD3] px-3 py-2 text-xs font-medium text-[#53635D]"
                  >
                    {isVi ? 'Xóa chọn' : 'Clear'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {selectedRoom && (
            <div className="space-y-3 rounded-xl border border-[#E5DFD3] bg-white p-5 text-xs">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-[#17221E]">
                  {isVi ? 'Đồng bộ lịch iCal (Airbnb / Booking)' : '2-Way iCal Sync'}
                </h2>
                <RefreshCw className="h-4 w-4 text-[#53635D]" />
              </div>

              <div>
                <label className="mb-1 block font-semibold text-[#17221E]">
                  {isVi ? 'Link xuất iCal (RFC 5545)' : 'Export iCal URL'}
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    readOnly
                    value={`/api/host/ical/export/${selectedRoom.id}`}
                    className="w-full rounded-lg border border-[#E5DFD3] bg-[#FAF8F3] px-2.5 py-1.5 font-mono text-[11px] text-[#53635D]"
                  />
                  <button
                    type="button"
                    onClick={() => copyExportUrl(selectedRoom.id)}
                    className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-[#E5DFD3] px-2.5 py-1.5 font-medium text-[#17221E] hover:bg-[#FAF8F3]"
                  >
                    {copiedId === selectedRoom.id ? (
                      <Check className="h-3.5 w-3.5 text-[#164E3F]" />
                    ) : (
                      <Copy className="h-3.5 w-3.5 text-[#53635D]" />
                    )}
                    {isVi ? 'Chép' : 'Copy'}
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1 block font-semibold text-[#17221E]">
                  {isVi ? 'Nhập link iCal ngoài' : 'Import external iCal URL'}
                </label>
                <input
                  type="url"
                  value={icalUrlInput}
                  onChange={(e) => setIcalUrlInput(e.target.value)}
                  placeholder="https://www.airbnb.com/calendar/ical/..."
                  className="w-full rounded-lg border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2 outline-none focus:border-[#164E3F]"
                />
                {selectedRoom.icalLastSyncedAt && (
                  <p className="mt-1 text-[11px] text-[#53635D]">
                    {isVi ? 'Đồng bộ lần cuối:' : 'Last synced:'}{' '}
                    {selectedRoom.icalLastSyncedAt.slice(0, 16).replace('T', ' ')}
                  </p>
                )}
              </div>

              <button
                type="button"
                disabled={saving}
                onClick={handleIcalSync}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#164E3F] bg-white px-3 py-2 font-semibold text-[#164E3F] hover:bg-[#E7F1EC] disabled:opacity-60"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                {isVi ? 'Lưu & Đồng bộ ngay' : 'Save & Sync iCal now'}
              </button>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
