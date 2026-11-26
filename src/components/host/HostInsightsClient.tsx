'use client';

import { useState } from 'react';
import {
  BarChart3,
  Clock,
  Eye,
  Loader2,
  Percent,
  TrendingUp,
} from 'lucide-react';
import { formatMoneyFromVnd, formatVndExact } from '@/lib/i18n';
import { usePreferences } from '@/components/PreferencesProvider';
import type { HostInsightsData } from '@/modules/host-console';

export function HostInsightsClient({
  initialData,
}: {
  initialData: HostInsightsData;
}) {
  const { locale, currency } = usePreferences();
  const isVi = locale === 'vi';

  const [data, setData] = useState<HostInsightsData>(initialData);
  const [stayId, setStayId] = useState('');
  const [range, setRange] = useState<'7d' | '30d' | '90d' | 'all'>(initialData.range);
  const [loading, setLoading] = useState(false);

  async function reload(
    nextStayId = stayId,
    nextRange: '7d' | '30d' | '90d' | 'all' = range
  ) {
    setLoading(true);
    try {
      const sp = new URLSearchParams();
      if (nextStayId) sp.set('stayId', nextStayId);
      sp.set('range', nextRange);
      const res = await fetch(`/api/host/insights?${sp.toString()}`);
      const json = await res.json();
      if (json.ok) setData(json);
    } finally {
      setLoading(false);
    }
  }

  const m = data.metrics;
  const rangeLabel =
    range === '7d'
      ? isVi ? '7 ngày' : '7D'
      : range === '30d'
        ? isVi ? '30 ngày' : '30D'
        : range === '90d'
          ? isVi ? '90 ngày' : '90D'
          : isVi ? 'Tất cả' : 'All';

  const cards = [
    {
      label: isVi ? 'Lượt xem trang chỗ ở' : 'Listing page views',
      val: String(m.viewsCount),
      sub: isVi ? `Từ dữ liệu truy cập thực (${rangeLabel})` : `Recorded stay visits (${rangeLabel})`,
      icon: Eye,
    },
    {
      label: isVi ? 'Tỷ lệ chuyển đổi đặt phòng' : 'Booking conversion',
      val: `${m.conversionRatePct.toFixed(1)}%`,
      sub: isVi
        ? `${m.bookingsCount} đơn xác nhận / ${m.viewsCount} lượt xem`
        : `${m.bookingsCount} confirmed / ${m.viewsCount} views`,
      icon: Percent,
    },
    {
      label: isVi ? 'Tỷ lệ lấp đầy (Occupancy)' : 'Occupancy rate',
      val: `${m.occupancyRatePct.toFixed(1)}%`,
      sub: isVi ? 'Trên tổng số đêm phòng mở' : 'Of available room nights',
      icon: BarChart3,
    },
    {
      label: isVi ? 'Độ dài lưu trú TB (ALOS)' : 'Avg length of stay (ALOS)',
      val: m.avgLengthOfStay > 0 ? `${m.avgLengthOfStay.toFixed(1)} ${isVi ? 'đêm' : 'n'}` : '—',
      sub: isVi ? 'Số đêm trung bình mỗi đơn' : 'Nights per confirmed booking',
      icon: Clock,
    },
    {
      label: isVi ? 'Giá đêm TB (ADR)' : 'Avg daily rate (ADR)',
      val: m.adrVnd > 0 ? formatMoneyFromVnd(m.adrVnd, currency) : '—',
      sub: m.adrVnd > 0 ? formatVndExact(m.adrVnd) : isVi ? 'Chưa có đơn trong kỳ' : 'No bookings in window',
      icon: TrendingUp,
    },
    {
      label: isVi ? 'Doanh thu / đêm khả dụng (RevPAR)' : 'RevPAR',
      val: formatMoneyFromVnd(m.revParVnd, currency),
      sub: formatVndExact(m.revParVnd),
      icon: TrendingUp,
    },
    {
      label: isVi ? 'Tỷ lệ hủy đơn' : 'Cancellation rate',
      val: `${m.cancellationRatePct.toFixed(1)}%`,
      sub: isVi ? 'Tính trên đơn đã hủy & xác nhận' : 'Ratio of cancelled vs total processed',
      icon: Percent,
    },
    {
      label: isVi ? 'Thời gian phản hồi tin nhắn' : 'Avg response time',
      val:
        m.avgResponseMinutes !== null
          ? `${m.avgResponseMinutes} ${isVi ? 'phút' : 'min'}`
          : '—',
      sub: isVi ? 'Tính trên các hội thoại khách hàng' : 'Measured from guest inbox threads',
      icon: Clock,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-serif-display text-2xl font-semibold text-[#17221E]">
            {isVi ? 'Hiệu suất & Chỉ số vận hành (Insights)' : 'Performance & Insights'}
          </h1>
          <p className="mt-0.5 text-xs text-[#53635D]">
            {isVi
              ? 'Toàn bộ chỉ số được tính trực tiếp từ lượt xem, đặt phòng và tin nhắn thực trong hệ thống.'
              : 'All KPIs are computed directly from live database views, bookings, and response logs.'}
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
            className="rounded-lg border border-[#E5DFD3] bg-white px-3 py-2 text-xs font-medium"
          >
            <option value="">{isVi ? 'Tất cả cơ sở' : 'All properties'}</option>
            {data.stays.map((s) => (
              <option key={s.id} value={s.id}>
                {isVi ? s.titleVi : s.titleEn}
              </option>
            ))}
          </select>

          <div className="flex rounded-lg border border-[#E5DFD3] bg-white p-0.5 text-xs">
            {(['7d', '30d', '90d', 'all'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => {
                  setRange(r);
                  reload(stayId, r);
                }}
                className={`rounded-md px-2.5 py-1.5 font-medium ${
                  range === r ? 'bg-[#164E3F] text-white' : 'text-[#53635D]'
                }`}
              >
                {r === 'all' ? (isVi ? 'Tất cả' : 'All') : r.toUpperCase()}
              </button>
            ))}
          </div>
          {loading && <Loader2 className="h-4 w-4 animate-spin text-[#164E3F]" />}
        </div>
      </div>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="rounded-xl border border-[#E5DFD3] bg-white p-5">
              <div className="flex items-center justify-between text-xs text-[#53635D]">
                <span>{c.label}</span>
                <Icon className="h-4 w-4 text-[#164E3F]" strokeWidth={1.75} />
              </div>
              <div className="mt-2 text-xl font-semibold text-[#17221E]">{c.val}</div>
              <div className="mt-1 text-[11px] text-[#53635D]">{c.sub}</div>
            </div>
          );
        })}
      </section>

      <section className="rounded-xl border border-[#E5DFD3] bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-[#17221E]">
          {isVi ? 'Chi tiết từng cơ sở lưu trú' : 'Breakdown by listing'}
        </h2>
        {data.byProperty.length === 0 ? (
          <p className="text-xs text-[#53635D]">
            {isVi ? 'Chưa có cơ sở lưu trú.' : 'No listings found.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-[#E5DFD3] text-[#53635D]">
                  <th className="py-2 font-semibold">{isVi ? 'Chỗ ở' : 'Listing'}</th>
                  <th className="py-2 font-semibold">{isVi ? 'Lượt xem' : 'Views'}</th>
                  <th className="py-2 font-semibold">{isVi ? 'Đơn đặt' : 'Bookings'}</th>
                  <th className="py-2 font-semibold">{isVi ? 'Lấp đầy' : 'Occupancy'}</th>
                  <th className="py-2 font-semibold">{isVi ? 'Doanh thu Host' : 'Host revenue'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5DFD3]">
                {data.byProperty.map((p) => (
                  <tr key={p.stayId}>
                    <td className="py-2.5 font-semibold text-[#17221E]">
                      {isVi ? p.titleVi : p.titleEn}
                    </td>
                    <td className="py-2.5">{p.viewsCount}</td>
                    <td className="py-2.5">{p.bookingsCount}</td>
                    <td className="py-2.5">{p.occupancyRatePct.toFixed(1)}%</td>
                    <td className="py-2.5 font-semibold text-[#164E3F]">
                      {formatVndExact(p.revenueVnd)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
