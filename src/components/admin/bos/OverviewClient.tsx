'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Building2,
  CalendarCheck2,
  TrendingUp,
} from 'lucide-react';
import { usePreferences } from '@/components/PreferencesProvider';
import {
  KpiMetric,
  PageHeader,
  StatusBadge,
  fmtVnd,
  statusToTone,
} from './BosPrimitives';
import type { getOverviewDashboardData } from '@/modules/admin-bos';

type OverviewData = Awaited<ReturnType<typeof getOverviewDashboardData>>;

export function OverviewClient({ initialData }: { initialData: OverviewData }) {
  const { locale } = usePreferences();
  const isVi = locale === 'vi';
  const [data, setData] = useState<OverviewData>(initialData);
  const [rangeDays, setRangeDays] = useState<number>(initialData.rangeDays);
  const [loading, setLoading] = useState(false);

  async function changeRange(days: number) {
    setRangeDays(days);
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/overview?days=${days}`);
      if (res.ok) {
        setData((await res.json()) as OverviewData);
      }
    } finally {
      setLoading(false);
    }
  }

  const k = data.kpis;
  const maxTrendGmv = Math.max(1, ...data.monthlyTrend.map((m) => m.gmvVnd));

  return (
    <div className="space-y-5">
      <PageHeader
        title={isVi ? 'Tổng quan điều hành (BOS)' : 'Business Operating Overview'}
        subtitle={
          isVi
            ? `Dữ liệu vận hành thực tế theo Single Source of Truth · Vai trò: ${data.actorSummary.roleName}`
            : `Real-time Single-Source-of-Truth metrics · Role: ${data.actorSummary.roleName}`
        }
        actions={
          <div className="flex items-center gap-1.5">
            {[7, 30, 90, 365].map((d) => (
              <button
                key={d}
                type="button"
                disabled={loading}
                onClick={() => changeRange(d)}
                className={`h-8 rounded-md px-3 text-xs font-medium transition-colors ${
                  rangeDays === d
                    ? 'bg-[#164E3F] text-white'
                    : 'border border-[#E5DFD3] bg-white text-[#53635D] hover:bg-[#FAF8F3] hover:text-[#17221E]'
                }`}
              >
                {d === 365 ? '12M' : `${d}D`}
              </button>
            ))}
            <Link
              href="/admin/finance/reports"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#E5DFD3] bg-white px-3 text-xs font-medium text-[#17221E] hover:bg-[#FAF8F3]"
            >
              <BarChart3 className="h-3.5 w-3.5 text-[#53635D]" />
              {isVi ? 'Báo cáo P&L' : 'P&L Reports'}
            </Link>
          </div>
        }
      />

      {/* Top Financial & Unit Economics Strip */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <KpiMetric
          label={isVi ? 'Tổng giá trị đặt phòng (GMV)' : 'Gross Booking Value (GMV)'}
          value={fmtVnd(k.gmvVnd)}
          hint={`${k.confirmedBookings} ${isVi ? 'đơn xác nhận' : 'confirmed bookings'}`}
        />
        <KpiMetric
          label={isVi ? 'Doanh thu nền tảng (12% fee)' : 'Platform Revenue (12% Fee)'}
          value={fmtVnd(k.platformRevenueVnd)}
          hint={isVi ? '0% hoa hồng chủ nhà' : '0% host commission'}
          accent="emerald"
        />
        <KpiMetric
          label={isVi ? 'Phần chi trả Chủ nhà' : 'Host Payable'}
          value={fmtVnd(k.hostPayableVnd)}
          hint={isVi ? 'Thu tại nơi ở / đối soát' : 'Direct at check-in & payable'}
        />
        <KpiMetric
          label={isVi ? 'Chi phí vận hành (OpEx)' : 'Operating Expenses'}
          value={fmtVnd(k.opexVnd)}
          hint={isVi ? `Trong ${data.rangeDays} ngày` : `In ${data.rangeDays}d window`}
        />
        <KpiMetric
          label={isVi ? 'Lợi nhuận đóng góp' : 'Contribution Profit'}
          value={fmtVnd(k.contributionProfitVnd)}
          hint={`ALOS: ${k.alosNights} ${isVi ? 'đêm' : 'nights'}`}
          accent={k.contributionProfitVnd >= 0 ? 'emerald' : 'terracotta'}
        />
      </div>

      {/* Supply, Marketplace Health & Funnel Strip */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiMetric
          label={isVi ? 'Chỗ ở đang mở / Chờ duyệt' : 'Live / Pending Listings'}
          value={`${k.liveStays} / ${k.pendingStays}`}
          hint={`${k.totalStays} ${isVi ? 'tổng cơ sở' : 'total listings'}`}
        />
        <KpiMetric
          label={isVi ? 'Chủ nhà / Pipeline Lead' : 'Active Hosts / Leads'}
          value={`${k.hostsCount} / ${k.activeLeads}`}
          hint={`${k.guestsCount} ${isVi ? 'khách đăng ký' : 'registered guests'}`}
        />
        <KpiMetric
          label={isVi ? 'Tỷ lệ hủy đơn' : 'Cancellation Rate'}
          value={`${k.cancellationRatePct}%`}
          hint={`${k.cancelledBookings} / ${k.totalBookings} ${isVi ? 'tổng đơn' : 'total'}`}
          accent={k.cancellationRatePct > 15 ? 'terracotta' : 'default'}
        />
        <KpiMetric
          label={isVi ? 'Tỷ lệ chuyển đổi Funnel' : 'Funnel Conversion'}
          value={`${k.conversionRatePct}%`}
          hint={`${k.stayViews} views -> ${k.checkoutStarts} checkouts`}
        />
      </div>

      {/* Main Split: Requires Attention Queue + Destination & Trend Analytics */}
      <div className="grid gap-5 lg:grid-cols-12">
        {/* Requires Attention Queue */}
        <section className="rounded-lg border border-[#E5DFD3] bg-white lg:col-span-5">
          <div className="flex items-center justify-between border-b border-[#E5DFD3] px-4 py-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-[#C25E28]" strokeWidth={1.75} />
              <h2 className="text-sm font-semibold text-[#17221E]">
                {isVi ? 'Hàng đợi cần xử lý' : 'Requires Attention'}
              </h2>
            </div>
            <span className="rounded bg-[#FAEDE5] px-2 py-0.5 text-[11px] font-semibold tabular-nums text-[#C25E28]">
              {data.requiresAttention.length}
            </span>
          </div>

          {data.requiresAttention.length === 0 ? (
            <div className="px-4 py-10 text-center text-xs text-[#53635D]">
              {isVi
                ? 'Tất cả hàng đợi vận hành đều đã xử lý xong.'
                : 'Operational queues are clear — no pending reviews, urgent tickets, or overdue tasks.'}
            </div>
          ) : (
            <div className="divide-y divide-[#E5DFD3]">
              {data.requiresAttention.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-[#FAF8F3]"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <StatusBadge
                        label={item.severity}
                        tone={statusToTone(item.severity)}
                      />
                      <span className="truncate text-xs font-semibold text-[#17221E]">
                        {item.title}
                      </span>
                    </div>
                    <div className="mt-0.5 truncate text-[11px] text-[#53635D]">
                      {item.subtitle}
                    </div>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[#53635D]" />
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Destination Performance + Monthly Trend */}
        <div className="space-y-5 lg:col-span-7">
          <section className="rounded-lg border border-[#E5DFD3] bg-white">
            <div className="flex items-center justify-between border-b border-[#E5DFD3] px-4 py-3">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-[#164E3F]" strokeWidth={1.75} />
                <h2 className="text-sm font-semibold text-[#17221E]">
                  {isVi ? 'Hiệu suất theo điểm đến' : 'Destination Supply & GMV'}
                </h2>
              </div>
              <Link
                href="/admin/growth/destinations"
                className="inline-flex items-center gap-1 text-xs font-medium text-[#164E3F] hover:underline"
              >
                {isVi ? 'Quản lý điểm đến' : 'Manage hubs'}
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead className="border-b border-[#E5DFD3] bg-[#FAF8F3] text-[11px] font-medium text-[#53635D]">
                  <tr>
                    <th className="px-4 py-2">Destination</th>
                    <th className="px-4 py-2 text-right">Live Stays</th>
                    <th className="px-4 py-2 text-right">Bookings</th>
                    <th className="px-4 py-2 text-right">GMV</th>
                    <th className="px-4 py-2 text-right">Platform Rev</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5DFD3]">
                  {data.destinations.map((d) => (
                    <tr key={d.id} className="hover:bg-[#FAF8F3]/60">
                      <td className="px-4 py-2 font-medium text-[#17221E]">{d.nameEn}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-[#53635D]">
                        {d.staysCount}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-[#17221E]">
                        {d.bookingsCount}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-[#17221E]">
                        {fmtVnd(d.gmvVnd)}
                      </td>
                      <td className="px-4 py-2 text-right font-medium tabular-nums text-[#164E3F]">
                        {fmtVnd(d.revenueVnd)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-lg border border-[#E5DFD3] bg-white">
            <div className="flex items-center justify-between border-b border-[#E5DFD3] px-4 py-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-[#164E3F]" strokeWidth={1.75} />
                <h2 className="text-sm font-semibold text-[#17221E]">
                  {isVi ? 'Xu hướng 6 tháng gần nhất' : '6-Month GMV & Revenue Trend'}
                </h2>
              </div>
              <span className="text-[11px] text-[#53635D]">
                <CalendarCheck2 className="mr-1 inline h-3.5 w-3.5" />
                Live ledger
              </span>
            </div>
            <div className="p-4">
              {data.monthlyTrend.length === 0 ? (
                <div className="py-6 text-center text-xs text-[#53635D]">
                  No booking volume recorded in the last 6 months yet.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {data.monthlyTrend.map((m) => {
                    const widthPct = Math.max(4, Math.round((m.gmvVnd / maxTrendGmv) * 100));
                    return (
                      <div key={m.month} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium tabular-nums text-[#17221E]">{m.month}</span>
                          <span className="tabular-nums text-[#53635D]">
                            {m.bookingsCount} bookings · GMV {fmtVnd(m.gmvVnd)} · Rev{' '}
                            <strong className="text-[#164E3F]">
                              {fmtVnd(m.platformRevenueVnd)}
                            </strong>
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-[#FAF8F3]">
                          <div
                            className="h-full rounded-full bg-[#164E3F]"
                            style={{ width: `${widthPct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
