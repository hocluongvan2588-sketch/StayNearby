'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CalendarCheck,
  CalendarRange,
  CheckCircle2,
  Clock,
  DoorClosed,
  DoorOpen,
  Loader2,
  MessageSquare,
  Star,
  TrendingUp,
} from 'lucide-react';
import { formatBookingStatusLabel, formatMoneyFromVnd, formatVndExact } from '@/lib/i18n';
import { usePreferences } from '@/components/PreferencesProvider';
import {
  ReservationSideDrawer,
  type HostReservationItem,
} from './ReservationSideDrawer';
import type { HostOverviewData } from '@/modules/host-console';

export type HostOverviewPayload = HostOverviewData;

export function HostOverviewClient({
  hostName,
  initialData,
}: {
  hostName: string;
  initialData: HostOverviewPayload;
}) {
  const { locale, currency } = usePreferences();
  const isVi = locale === 'vi';

  const [data, setData] = useState<HostOverviewPayload>(initialData);
  const [stayId, setStayId] = useState<string>('');
  const [range, setRange] = useState<'7d' | '30d' | '90d' | 'all'>(initialData.range);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [notice, setNotice] = useState('');
  const [activeTab, setActiveTab] = useState<'checkins' | 'checkouts' | 'pending' | 'unread'>(
    initialData.operations.pendingBookings.length > 0
      ? 'pending'
      : initialData.operations.checkInsToday.length > 0
        ? 'checkins'
        : 'checkouts'
  );
  const [selectedReservation, setSelectedReservation] =
    useState<HostReservationItem | null>(null);

  async function reload(nextStayId = stayId, nextRange = range) {
    setLoading(true);
    setErrorMsg('');
    try {
      const sp = new URLSearchParams();
      if (nextStayId) sp.set('stayId', nextStayId);
      sp.set('range', nextRange);
      const res = await fetch(`/api/host/overview?${sp.toString()}`);
      const json = await res.json();
      if (!json.ok) {
        setErrorMsg(json.error?.message ?? 'Failed to load overview.');
        return;
      }
      setData(json);
    } catch {
      setErrorMsg(isVi ? 'Không thể tải lại dữ liệu.' : 'Could not refresh overview.');
    } finally {
      setLoading(false);
    }
  }

  const maxRev = Math.max(1, ...data.chartSeries.map((c) => c.revenueVnd));
  const maxNights = Math.max(1, ...data.chartSeries.map((c) => c.bookedNights));

  const opsCounts = {
    checkins: data.operations.checkInsToday.length,
    checkouts: data.operations.checkOutsToday.length,
    pending: data.operations.pendingBookings.length,
    unread: data.operations.unreadConversations.length,
  };

  return (
    <div className="space-y-6">
      {/* Page Title & Global Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-serif-display text-2xl font-semibold text-[#17221E] sm:text-3xl">
            {isVi ? `Chào ${hostName.split(' ')[0]}, công việc hôm nay` : `Welcome back, ${hostName.split(' ')[0]}`}
          </h1>
          <p className="mt-1 text-sm text-[#53635D]">
            {isVi
              ? `Ngày ${data.today} · Theo dõi khách nhận/trả phòng, yêu cầu chờ duyệt và hiệu quả kinh doanh.`
              : `Today (${data.today}) · Track check-ins, pending approvals, unread messages, and revenue.`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={stayId}
            onChange={(e) => {
              const v = e.target.value;
              setStayId(v);
              reload(v, range);
            }}
            aria-label={isVi ? 'Lọc theo cơ sở' : 'Filter by property'}
            className="rounded-lg border border-[#E5DFD3] bg-white px-3 py-2 text-xs font-medium text-[#17221E] outline-none focus:border-[#164E3F]"
          >
            <option value="">
              {isVi ? `Tất cả cơ sở (${data.stays.length})` : `All properties (${data.stays.length})`}
            </option>
            {data.stays.map((s) => (
              <option key={s.id} value={s.id}>
                {isVi ? s.titleVi : s.titleEn}
              </option>
            ))}
          </select>

          <div className="flex rounded-lg border border-[#E5DFD3] bg-white p-0.5 text-xs font-medium">
            {(['7d', '30d', '90d', 'all'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => {
                  setRange(r);
                  reload(stayId, r);
                }}
                className={`rounded-md px-2.5 py-1.5 transition ${
                  range === r
                    ? 'bg-[#164E3F] font-semibold text-white'
                    : 'text-[#53635D] hover:text-[#17221E]'
                }`}
              >
                {r === '7d'
                  ? isVi
                    ? '7 ngày'
                    : '7D'
                  : r === '30d'
                    ? isVi
                      ? '30 ngày'
                      : '30D'
                    : r === '90d'
                      ? isVi
                        ? '90 ngày'
                        : '90D'
                      : isVi
                        ? 'Tất cả'
                        : 'All'}
              </button>
            ))}
          </div>

          {loading && <Loader2 className="h-4 w-4 animate-spin text-[#164E3F]" />}
        </div>
      </div>

      {notice && (
        <div className="flex items-center gap-2 rounded-xl border border-[#164E3F]/30 bg-[#E7F1EC] px-4 py-3 text-xs font-medium text-[#164E3F]">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}
      {errorMsg && (
        <div className="rounded-xl border border-[#C25E28]/40 bg-[#FAEDE5] px-4 py-3 text-xs font-medium text-[#C25E28]">
          {errorMsg}
        </div>
      )}

      {/* Action-First Today Operations */}
      <section className="rounded-xl border border-[#E5DFD3] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E5DFD3] px-5 py-3.5">
          <h2 className="text-sm font-semibold text-[#17221E]">
            {isVi ? 'Công việc cần xử lý hôm nay' : 'Today’s Action Queue'}
          </h2>
          <div className="flex flex-wrap gap-1.5 text-xs">
            {(
              [
                {
                  key: 'checkins' as const,
                  labelEn: 'Check-ins',
                  labelVi: 'Nhận phòng',
                  count: opsCounts.checkins,
                  icon: DoorOpen,
                },
                {
                  key: 'checkouts' as const,
                  labelEn: 'Check-outs',
                  labelVi: 'Trả phòng',
                  count: opsCounts.checkouts,
                  icon: DoorClosed,
                },
                {
                  key: 'pending' as const,
                  labelEn: 'Pending',
                  labelVi: 'Chờ duyệt',
                  count: opsCounts.pending,
                  icon: Clock,
                },
                {
                  key: 'unread' as const,
                  labelEn: 'Unread inbox',
                  labelVi: 'Tin chưa đọc',
                  count: opsCounts.unread,
                  icon: MessageSquare,
                },
              ] as const
            ).map((t) => {
              const Icon = t.icon;
              const active = activeTab === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setActiveTab(t.key)}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-medium transition ${
                    active
                      ? 'border-[#164E3F] bg-[#E7F1EC] text-[#164E3F]'
                      : 'border-[#E5DFD3] bg-white text-[#53635D] hover:bg-[#FAF8F3]'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
                  <span>{isVi ? t.labelVi : t.labelEn}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                      t.count > 0
                        ? active
                          ? 'bg-[#164E3F] text-white'
                          : 'bg-[#FAF8F3] text-[#17221E]'
                        : 'bg-[#FAF8F3] text-[#53635D]'
                    }`}
                  >
                    {t.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-5">
          {activeTab === 'checkins' && (
            <TodayReservationList
              items={data.operations.checkInsToday}
              emptyText={
                isVi
                  ? 'Không có khách nhận phòng trong ngày hôm nay.'
                  : 'No guest check-ins scheduled for today.'
              }
              onSelect={setSelectedReservation}
              isVi={isVi}
            />
          )}
          {activeTab === 'checkouts' && (
            <TodayReservationList
              items={data.operations.checkOutsToday}
              emptyText={
                isVi
                  ? 'Không có khách trả phòng trong ngày hôm nay.'
                  : 'No guest check-outs scheduled for today.'
              }
              onSelect={setSelectedReservation}
              isVi={isVi}
            />
          )}
          {activeTab === 'pending' && (
            <TodayReservationList
              items={data.operations.pendingBookings}
              emptyText={
                isVi
                  ? 'Hiện không có đơn đặt phòng nào đang chờ xử lý.'
                  : 'No pending reservation requests right now.'
              }
              onSelect={setSelectedReservation}
              isVi={isVi}
            />
          )}
          {activeTab === 'unread' && (
            <div>
              {data.operations.unreadConversations.length === 0 ? (
                <p className="py-6 text-center text-xs text-[#53635D]">
                  {isVi
                    ? 'Tất cả tin nhắn khách hàng đều đã được đọc.'
                    : 'All guest conversations are up to date.'}
                </p>
              ) : (
                <div className="divide-y divide-[#E5DFD3]">
                  {data.operations.unreadConversations.map((c) => (
                    <Link
                      key={c.id}
                      href={`/host/messages?c=${c.id}`}
                      className="flex items-center justify-between gap-4 py-3 hover:bg-[#FAF8F3] px-2 rounded-lg"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-[#17221E]">
                            {c.guestName}
                          </span>
                          <span className="rounded bg-[#FAEDE5] px-1.5 py-0.5 text-[10px] font-semibold text-[#C25E28]">
                            {c.unreadCount} {isVi ? 'mới' : 'unread'}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-[#53635D]">
                          {isVi ? c.stayTitleVi : c.stayTitleEn} · {c.preview}
                        </p>
                      </div>
                      <ArrowRight className="h-4 w-4 shrink-0 text-[#53635D]" />
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Important Tasks & Alerts */}
          {data.operations.alerts.length > 0 && (
            <div className="mt-4 space-y-2 border-t border-[#E5DFD3] pt-4">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[#53635D]">
                {isVi ? 'Thông báo & Nhắc việc quan trọng' : 'Important Tasks & Alerts'}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {data.operations.alerts.map((al) => (
                  <Link
                    key={al.id}
                    href={al.href}
                    className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition ${
                      al.severity === 'warning'
                        ? 'border-[#C25E28]/35 bg-[#FAEDE5]/60 text-[#C25E28]'
                        : 'border-[#E5DFD3] bg-[#FAF8F3] text-[#17221E] hover:border-[#164E3F]/40'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      {isVi ? al.titleVi : al.titleEn}
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0" />
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 4 Core KPIs */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-[#E5DFD3] bg-white p-5">
          <div className="flex items-center justify-between text-xs font-medium text-[#53635D]">
            <span>{isVi ? 'Doanh thu Host trong kỳ' : 'Host revenue (0% fee)'}</span>
            <TrendingUp className="h-4 w-4 text-[#164E3F]" strokeWidth={1.75} />
          </div>
          <div className="mt-2 text-xl font-semibold text-[#17221E] sm:text-2xl">
            {formatMoneyFromVnd(data.kpis.periodRevenueVnd, currency)}
          </div>
          <div className="mt-1 text-[11px] text-[#53635D]">
            {formatVndExact(data.kpis.periodRevenueVnd)}
          </div>
        </div>

        <div className="rounded-xl border border-[#E5DFD3] bg-white p-5">
          <div className="flex items-center justify-between text-xs font-medium text-[#53635D]">
            <span>{isVi ? 'Tỷ lệ lấp đầy' : 'Occupancy rate'}</span>
            <CalendarRange className="h-4 w-4 text-[#164E3F]" strokeWidth={1.75} />
          </div>
          <div className="mt-2 text-xl font-semibold text-[#17221E] sm:text-2xl">
            {data.kpis.occupancyPct.toFixed(1)}%
          </div>
          <div className="mt-1 text-[11px] text-[#53635D]">
            {isVi ? 'Tính trên số phòng đang mở' : 'Across managed inventory'}
          </div>
        </div>

        <div className="rounded-xl border border-[#E5DFD3] bg-white p-5">
          <div className="flex items-center justify-between text-xs font-medium text-[#53635D]">
            <span>{isVi ? 'Số đêm đã đặt' : 'Booked nights'}</span>
            <CalendarCheck className="h-4 w-4 text-[#164E3F]" strokeWidth={1.75} />
          </div>
          <div className="mt-2 text-xl font-semibold text-[#17221E] sm:text-2xl">
            {data.kpis.bookedNights}
          </div>
          <div className="mt-1 text-[11px] text-[#53635D]">
            {isVi ? 'Đêm lưu trú xác nhận trong kỳ' : 'Confirmed room nights'}
          </div>
        </div>

        <div className="rounded-xl border border-[#E5DFD3] bg-white p-5">
          <div className="flex items-center justify-between text-xs font-medium text-[#53635D]">
            <span>{isVi ? 'Đánh giá trung bình' : 'Average rating'}</span>
            <Star className="h-4 w-4 text-[#A67C2E]" strokeWidth={1.75} />
          </div>
          <div className="mt-2 text-xl font-semibold text-[#17221E] sm:text-2xl">
            {data.kpis.avgRating !== null ? data.kpis.avgRating.toFixed(1) : '—'}
          </div>
          <div className="mt-1 text-[11px] text-[#53635D]">
            {data.kpis.reviewsCount > 0
              ? `${data.kpis.reviewsCount} ${isVi ? 'đánh giá khách thực tế' : 'guest reviews'}`
              : isVi
                ? 'Chưa có đánh giá từ khách lưu trú'
                : 'No guest reviews recorded yet'}
          </div>
        </div>
      </section>

      {/* Revenue Chart & Upcoming Reservations */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Clean SVG Revenue & Nights Chart */}
        <section className="rounded-xl border border-[#E5DFD3] bg-white p-5 lg:col-span-7">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-[#17221E]">
                {isVi ? 'Biểu đồ doanh thu & số đêm đặt' : 'Revenue & Booked Nights'}
              </h3>
              <p className="text-xs text-[#53635D]">
                {isVi
                  ? 'Tính trên giá thuê Host thực nhận (0% hoa hồng).'
                  : 'Based on 100% host room revenue (0% host commission).'}
              </p>
            </div>
            <Link
              href="/host/insights"
              className="text-xs font-semibold text-[#164E3F] hover:underline"
            >
              {isVi ? 'Xem Insights' : 'View Insights'}
            </Link>
          </div>

          {data.chartSeries.every((c) => c.revenueVnd === 0 && c.bookedNights === 0) ? (
            <div className="flex h-52 flex-col items-center justify-center rounded-lg border border-dashed border-[#E5DFD3] bg-[#FAF8F3] text-center px-4">
              <p className="text-xs font-medium text-[#53635D]">
                {isVi
                  ? 'Chưa phát sinh đơn đặt phòng trong khoảng thời gian đã chọn.'
                  : 'No confirmed bookings recorded in the selected date window.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid h-48 items-end gap-2 border-b border-[#E5DFD3] pb-2" style={{ gridTemplateColumns: `repeat(${data.chartSeries.length}, minmax(0, 1fr))` }}>
                {data.chartSeries.map((pt) => {
                  const revH = Math.max(4, Math.round((pt.revenueVnd / maxRev) * 140));
                  const nightH = Math.max(4, Math.round((pt.bookedNights / maxNights) * 140));
                  return (
                    <div key={pt.label} className="group flex h-full flex-col items-center justify-end gap-1">
                      <div className="flex items-end gap-1 h-[148px]">
                        <div
                          title={`${pt.label}: ${formatVndExact(pt.revenueVnd)}`}
                          style={{ height: `${pt.revenueVnd > 0 ? revH : 2}px` }}
                          className="w-3 rounded-t bg-[#164E3F] transition-opacity group-hover:opacity-85 sm:w-4"
                        />
                        <div
                          title={`${pt.label}: ${pt.bookedNights} nights`}
                          style={{ height: `${pt.bookedNights > 0 ? nightH : 2}px` }}
                          className="w-2 rounded-t bg-[#A67C2E]/65 sm:w-2.5"
                        />
                      </div>
                      <span className="text-[10px] text-[#53635D]">{pt.label}</span>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center gap-4 text-[11px] text-[#53635D]">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-xs bg-[#164E3F]" />
                  {isVi ? 'Doanh thu nhận phòng' : 'Host revenue'}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-xs bg-[#A67C2E]/70" />
                  {isVi ? 'Số đêm đã đặt' : 'Booked nights'}
                </span>
              </div>
            </div>
          )}
        </section>

        {/* Upcoming Reservations */}
        <section className="rounded-xl border border-[#E5DFD3] bg-white p-5 lg:col-span-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#17221E]">
              {isVi ? 'Đặt phòng sắp tới' : 'Upcoming Reservations'}
            </h3>
            <Link
              href="/host/reservations"
              className="text-xs font-semibold text-[#164E3F] hover:underline"
            >
              {isVi ? 'Tất cả' : 'View all'}
            </Link>
          </div>

          {data.upcomingBookings.length === 0 ? (
            <div className="flex h-52 flex-col items-center justify-center rounded-lg border border-dashed border-[#E5DFD3] bg-[#FAF8F3] text-center px-4">
              <p className="text-xs text-[#53635D]">
                {isVi ? 'Chưa có booking sắp tới.' : 'No upcoming reservations yet.'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#E5DFD3]">
              {data.upcomingBookings.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setSelectedReservation(b)}
                  className="flex w-full items-center justify-between gap-3 py-3 text-left transition hover:bg-[#FAF8F3] px-2 rounded-lg"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-mono font-semibold text-[#164E3F]">
                        {b.bookingCode}
                      </span>
                      <span className="truncate font-semibold text-[#17221E]">
                        {b.guestName}
                      </span>
                    </div>
                    <div className="mt-0.5 truncate text-xs text-[#53635D]">
                      {isVi ? b.stayTitleVi : b.stayTitleEn} · {b.checkIn} ({b.nights}n)
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-xs font-semibold text-[#17221E]">
                      {formatMoneyFromVnd(b.payAtCheckinVnd, currency)}
                    </div>
                    <div className="text-[11px] text-[#53635D]">
                      {formatBookingStatusLabel(b.status, locale)}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>

      <ReservationSideDrawer
        key={selectedReservation?.id ?? 'none'}
        reservation={selectedReservation}
        onClose={() => setSelectedReservation(null)}
        onUpdated={(msg) => {
          setNotice(msg);
          reload();
        }}
      />
    </div>
  );
}

function TodayReservationList({
  items,
  emptyText,
  onSelect,
  isVi,
}: {
  items: HostReservationItem[];
  emptyText: string;
  onSelect: (item: HostReservationItem) => void;
  isVi: boolean;
}) {
  if (items.length === 0) {
    return <p className="py-6 text-center text-xs text-[#53635D]">{emptyText}</p>;
  }
  return (
    <div className="divide-y divide-[#E5DFD3]">
      {items.map((item) => (
        <div
          key={item.id}
          className="flex flex-wrap items-center justify-between gap-3 py-3"
        >
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-semibold text-[#164E3F]">
                {item.bookingCode}
              </span>
              <span className="text-sm font-semibold text-[#17221E]">
                {item.guestName}
              </span>
              <span className="rounded bg-[#FAF8F3] border border-[#E5DFD3] px-1.5 py-0.5 text-[11px] text-[#53635D]">
                {item.nights} {isVi ? 'đêm' : 'nights'}
              </span>
            </div>
            <div className="mt-0.5 text-xs text-[#53635D]">
              {isVi ? item.stayTitleVi : item.stayTitleEn} · {item.checkIn} → {item.checkOut} ·{' '}
              {isVi ? 'Thu tại chỗ:' : 'Collect:'} {formatVndExact(item.payAtCheckinVnd)}
            </div>
          </div>
          <button
            type="button"
            onClick={() => onSelect(item)}
            className="rounded-lg border border-[#E5DFD3] bg-white px-3 py-1.5 text-xs font-semibold text-[#17221E] hover:bg-[#FAF8F3]"
          >
            {isVi ? 'Xem & xử lý' : 'Inspect'}
          </button>
        </div>
      ))}
    </div>
  );
}
