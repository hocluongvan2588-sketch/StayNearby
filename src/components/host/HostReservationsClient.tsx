'use client';

import { useState } from 'react';
import { CalendarCheck, CheckCircle2, Loader2, Search } from 'lucide-react';
import {
  formatBookingStatusLabel,
  formatVndExact,
} from '@/lib/i18n';
import { usePreferences } from '@/components/PreferencesProvider';
import {
  ReservationSideDrawer,
  type HostReservationItem,
} from './ReservationSideDrawer';
import type { HostReservationsData } from '@/modules/host-console';

export type HostReservationsPayload = HostReservationsData;

type TabKey = keyof HostReservationsPayload['counts'];

export function HostReservationsClient({
  initialData,
}: {
  initialData: HostReservationsPayload;
}) {
  const { locale, formatMoney } = usePreferences();
  const isVi = locale === 'vi';

  const [data, setData] = useState<HostReservationsPayload>(initialData);
  const [statusTab, setStatusTab] = useState<TabKey>('all');
  const [stayId, setStayId] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [selected, setSelected] = useState<HostReservationItem | null>(null);

  async function reload(
    nextTab: TabKey = statusTab,
    nextStayId: string = stayId,
    nextSearch: string = search
  ) {
    setLoading(true);
    setErrorMsg('');
    try {
      const sp = new URLSearchParams();
      sp.set('status', nextTab);
      if (nextStayId) sp.set('stayId', nextStayId);
      if (nextSearch.trim()) sp.set('q', nextSearch.trim());
      const res = await fetch(`/api/host/reservations?${sp.toString()}`);
      const json = await res.json();
      if (!json.ok) {
        setErrorMsg(json.error?.message ?? 'Could not fetch reservations.');
        return;
      }
      setData(json);
    } finally {
      setLoading(false);
    }
  }

  const tabs: Array<{ key: TabKey; en: string; vi: string }> = [
    { key: 'all', en: 'All', vi: 'Tất cả' },
    { key: 'pending', en: 'Pending', vi: 'Chờ duyệt' },
    { key: 'confirmed', en: 'Confirmed', vi: 'Đã xác nhận' },
    { key: 'upcoming', en: 'Upcoming', vi: 'Sắp đến' },
    { key: 'in_house', en: 'In-house', vi: 'Đang lưu trú' },
    { key: 'completed', en: 'Completed', vi: 'Hoàn tất' },
    { key: 'cancelled', en: 'Cancelled', vi: 'Đã hủy' },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-serif-display text-2xl font-semibold text-[#17221E]">
          {isVi ? 'Quản lý đặt phòng' : 'Reservations'}
        </h1>
        <p className="mt-0.5 text-xs text-[#53635D]">
          {isVi
            ? 'Nhấp vào từng đơn để xem thông tin khách, phân bổ thanh toán và xác nhận check-in.'
            : 'Click any reservation to open details, verify payment split, approve requests, or confirm check-in.'}
        </p>
      </div>

      {notice && (
        <div className="flex items-center gap-2 rounded-xl border border-[#164E3F]/30 bg-[#E7F1EC] px-4 py-2.5 text-xs font-medium text-[#164E3F]">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}
      {errorMsg && (
        <div className="rounded-xl border border-[#C25E28]/40 bg-[#FAEDE5] px-4 py-2.5 text-xs font-medium text-[#C25E28]">
          {errorMsg}
        </div>
      )}

      {/* Status Tabs */}
      <div className="flex flex-wrap gap-1.5 border-b border-[#E5DFD3] pb-3 text-xs">
        {tabs.map((t) => {
          const active = statusTab === t.key;
          const cnt = data.counts[t.key];
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => {
                setStatusTab(t.key);
                reload(t.key, stayId, search);
              }}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-medium transition ${
                active
                  ? 'border-[#164E3F] bg-[#164E3F] text-white'
                  : 'border-[#E5DFD3] bg-white text-[#53635D] hover:bg-[#FAF8F3]'
              }`}
            >
              <span>{isVi ? t.vi : t.en}</span>
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                  active ? 'bg-white/20 text-white' : 'bg-[#FAF8F3] text-[#17221E]'
                }`}
              >
                {cnt}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[#53635D]" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              const v = e.target.value;
              setSearch(v);
              reload(statusTab, stayId, v);
            }}
            placeholder={
              isVi
                ? 'Tìm theo mã đơn (VN-...), tên khách hoặc email...'
                : 'Search booking code, guest name, or email...'
            }
            className="w-full rounded-lg border border-[#E5DFD3] bg-white py-2 pl-9 pr-3 text-xs text-[#17221E] outline-none focus:border-[#164E3F]"
          />
        </div>
        <select
          value={stayId}
          onChange={(e) => {
            const v = e.target.value;
            setStayId(v);
            reload(statusTab, v, search);
          }}
          className="rounded-lg border border-[#E5DFD3] bg-white px-3 py-2 text-xs font-medium text-[#17221E] outline-none focus:border-[#164E3F]"
        >
          <option value="">{isVi ? 'Tất cả cơ sở' : 'All properties'}</option>
          {data.stays.map((s) => (
            <option key={s.id} value={s.id}>
              {isVi ? s.titleVi : s.titleEn}
            </option>
          ))}
        </select>
        {loading && <Loader2 className="h-4 w-4 animate-spin text-[#164E3F]" />}
      </div>

      {/* Reservations List */}
      {data.reservations.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#E5DFD3] bg-white p-10 text-center">
          <CalendarCheck className="mx-auto h-9 w-9 text-[#53635D]" strokeWidth={1.5} />
          <p className="mt-3 text-sm font-medium text-[#17221E]">
            {isVi ? 'Không tìm thấy đơn đặt phòng phù hợp' : 'No matching reservations'}
          </p>
          <p className="mt-1 text-xs text-[#53635D]">
            {isVi
              ? 'Thử thay đổi bộ lọc trạng thái hoặc từ khóa tìm kiếm.'
              : 'Try adjusting the status tab or search filters.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[#E5DFD3] bg-white">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-[#E5DFD3] bg-[#FAF8F3] text-[#53635D]">
                <th className="px-4 py-3 font-semibold">{isVi ? 'Mã đơn' : 'Code'}</th>
                <th className="px-4 py-3 font-semibold">{isVi ? 'Khách' : 'Guest'}</th>
                <th className="px-4 py-3 font-semibold">{isVi ? 'Cơ sở' : 'Stay'}</th>
                <th className="px-4 py-3 font-semibold">{isVi ? 'Ngày ở' : 'Dates'}</th>
                <th className="px-4 py-3 font-semibold">{isVi ? 'Host nhận (100%)' : 'Host payout'}</th>
                <th className="px-4 py-3 font-semibold">{isVi ? 'Trạng thái' : 'Status'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5DFD3]">
              {data.reservations.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => setSelected(row)}
                  className="cursor-pointer transition hover:bg-[#FAF8F3]"
                >
                  <td className="px-4 py-3 font-mono font-semibold text-[#164E3F]">
                    {row.bookingCode}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-[#17221E]">{row.guestName}</div>
                    <div className="text-[11px] text-[#53635D]">
                      {row.guestsCount} {isVi ? 'khách' : 'guests'} · {row.nationality}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="max-w-[200px] truncate font-medium text-[#17221E]">
                      {isVi ? row.stayTitleVi : row.stayTitleEn}
                    </div>
                    <div className="text-[11px] text-[#53635D]">
                      {isVi ? row.roomNameVi : row.roomNameEn}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-[#17221E]">
                      {row.checkIn} → {row.checkOut}
                    </div>
                    <div className="text-[11px] text-[#53635D]">
                      {row.nights} {isVi ? 'đêm' : 'nights'}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-[#17221E]">
                      {formatMoney(row.payAtCheckinVnd)}
                    </div>
                    <div className="text-[11px] text-[#53635D]">
                      {formatVndExact(row.payAtCheckinVnd)}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-md border px-2 py-0.5 text-[11px] font-semibold ${
                        row.status === 'PENDING_HOST_APPROVAL'
                          ? 'border-[#A67C2E]/40 bg-[#FDF4DF] text-[#8E651A]'
                          : row.status === 'RENT_PAID_AT_CHECKIN'
                            ? 'border-[#164E3F]/30 bg-[#E7F1EC] text-[#164E3F]'
                            : row.status.includes('CANCELLED') || row.status.includes('REFUND')
                              ? 'border-[#C25E28]/35 bg-[#FAEDE5] text-[#C25E28]'
                              : 'border-[#E5DFD3] bg-[#FAF8F3] text-[#17221E]'
                      }`}
                    >
                      {formatBookingStatusLabel(row.status, locale)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ReservationSideDrawer
        key={selected?.id ?? 'none'}
        reservation={selected}
        onClose={() => setSelected(null)}
        onUpdated={(msg) => {
          setNotice(msg);
          reload();
        }}
      />
    </div>
  );
}
