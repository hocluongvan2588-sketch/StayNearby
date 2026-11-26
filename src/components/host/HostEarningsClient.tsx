'use client';

import { useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Download,
  Loader2,
  ReceiptText,
  Wallet,
} from 'lucide-react';
import {
  formatBookingStatusLabel,
  formatVndExact,
} from '@/lib/i18n';
import { usePreferences } from '@/components/PreferencesProvider';
import type { HostEarningsData } from '@/modules/host-console';

export function HostEarningsClient({
  initialData,
}: {
  initialData: HostEarningsData;
}) {
  const { locale, formatMoney, hostCommissionPct } = usePreferences();
  const isVi = locale === 'vi';

  const [data, setData] = useState<HostEarningsData>(initialData);
  const [stayId, setStayId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(false);

  async function applyFilter(nextStayId = stayId, nextFrom = from, nextTo = to) {
    setLoading(true);
    try {
      const sp = new URLSearchParams();
      if (nextStayId) sp.set('stayId', nextStayId);
      if (nextFrom) sp.set('from', nextFrom);
      if (nextTo) sp.set('to', nextTo);
      const res = await fetch(`/api/host/earnings?${sp.toString()}`);
      const json = await res.json();
      if (json.ok) setData(json);
    } finally {
      setLoading(false);
    }
  }

  const exportUrl = (() => {
    const sp = new URLSearchParams();
    if (stayId) sp.set('stayId', stayId);
    if (from) sp.set('from', from);
    if (to) sp.set('to', to);
    const qs = sp.toString();
    return `/api/host/earnings/export${qs ? `?${qs}` : ''}`;
  })();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-serif-display text-2xl font-semibold text-[#17221E]">
            {isVi ? 'Doanh thu & Thanh toán' : 'Earnings & Payouts'}
          </h1>
          <p className="mt-0.5 text-xs text-[#53635D]">
            {isVi
              ? `${hostCommissionPct}% hoa hồng chủ nhà. Bạn thu đủ 100% tiền phòng khi khách nhận phòng.`
              : `${hostCommissionPct}% host commission. Collect 100% of your room rate at check-in.`}
          </p>
        </div>

        <a
          href={exportUrl}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#164E3F] bg-white px-3.5 py-2 text-xs font-semibold text-[#164E3F] hover:bg-[#E7F1EC]"
        >
          <Download className="h-3.5 w-3.5" />
          {isVi ? 'Xuất báo cáo CSV' : 'Export CSV report'}
        </a>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#E5DFD3] bg-white p-3 text-xs">
        <select
          value={stayId}
          onChange={(e) => {
            const v = e.target.value;
            setStayId(v);
            applyFilter(v, from, to);
          }}
          className="rounded-lg border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-1.5 font-medium"
        >
          <option value="">{isVi ? 'Tất cả cơ sở' : 'All properties'}</option>
          {data.stays.map((s) => (
            <option key={s.id} value={s.id}>
              {isVi ? s.titleVi : s.titleEn}
            </option>
          ))}
        </select>

        <input
          type="date"
          value={from}
          onChange={(e) => {
            const v = e.target.value;
            setFrom(v);
            applyFilter(stayId, v, to);
          }}
          className="rounded-lg border border-[#E5DFD3] bg-[#FAF8F3] px-2.5 py-1.5"
        />
        <span className="text-[#53635D]">→</span>
        <input
          type="date"
          value={to}
          onChange={(e) => {
            const v = e.target.value;
            setTo(v);
            applyFilter(stayId, from, v);
          }}
          className="rounded-lg border border-[#E5DFD3] bg-[#FAF8F3] px-2.5 py-1.5"
        />
        {loading && <Loader2 className="h-4 w-4 animate-spin text-[#164E3F]" />}
      </div>

      {/* KPI Cards */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-[#E5DFD3] bg-white p-5">
          <div className="flex items-center justify-between text-xs text-[#53635D]">
            <span>{isVi ? 'Tổng doanh thu Host' : 'Gross host revenue'}</span>
            <Wallet className="h-4 w-4 text-[#164E3F]" />
          </div>
          <div className="mt-2 text-xl font-semibold text-[#17221E]">
            {formatMoney(data.summary.hostGrossEarnedVnd)}
          </div>
          <div className="mt-1 text-[11px] text-[#53635D]">
            {formatVndExact(data.summary.hostGrossEarnedVnd)}
          </div>
        </div>

        <div className="rounded-xl border border-[#E5DFD3] bg-white p-5">
          <div className="flex items-center justify-between text-xs text-[#53635D]">
            <span>{isVi ? 'Đã thu tại check-in' : 'Collected at check-in'}</span>
            <CheckCircle2 className="h-4 w-4 text-[#164E3F]" />
          </div>
          <div className="mt-2 text-xl font-semibold text-[#164E3F]">
            {formatMoney(data.summary.hostCollectedVnd)}
          </div>
          <div className="mt-1 text-[11px] text-[#53635D]">
            {formatVndExact(data.summary.hostCollectedVnd)}
          </div>
        </div>

        <div className="rounded-xl border border-[#E5DFD3] bg-white p-5">
          <div className="flex items-center justify-between text-xs text-[#53635D]">
            <span>{isVi ? 'Dự kiến thu sắp tới' : 'Upcoming collections'}</span>
            <Clock className="h-4 w-4 text-[#A67C2E]" />
          </div>
          <div className="mt-2 text-xl font-semibold text-[#17221E]">
            {formatMoney(data.summary.hostPendingVnd)}
          </div>
          <div className="mt-1 text-[11px] text-[#53635D]">
            {formatVndExact(data.summary.hostPendingVnd)}
          </div>
        </div>

        <div className="rounded-xl border border-[#E5DFD3] bg-white p-5">
          <div className="flex items-center justify-between text-xs text-[#53635D]">
            <span>{isVi ? 'Hoa hồng chủ nhà' : 'Host commission'}</span>
            <ReceiptText className="h-4 w-4 text-[#164E3F]" />
          </div>
          <div className="mt-2 text-xl font-semibold text-[#164E3F]">0%</div>
          <div className="mt-1 text-[11px] text-[#53635D]">
            {isVi
              ? `Điều chỉnh: ${formatVndExact(data.summary.adjustmentsNetVnd)}`
              : `Adjustments: ${formatVndExact(data.summary.adjustmentsNetVnd)}`}
          </div>
        </div>
      </section>

      {/* Revenue by Property */}
      <section className="rounded-xl border border-[#E5DFD3] bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-[#17221E]">
          {isVi ? 'Doanh thu theo từng cơ sở' : 'Breakdown by property'}
        </h2>
        {data.byStay.length === 0 ? (
          <p className="text-xs text-[#53635D]">
            {isVi ? 'Chưa có cơ sở lưu trú.' : 'No properties found.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-[#E5DFD3] text-[#53635D]">
                  <th className="py-2 font-semibold">{isVi ? 'Cơ sở' : 'Property'}</th>
                  <th className="py-2 font-semibold">{isVi ? 'Số đơn' : 'Bookings'}</th>
                  <th className="py-2 font-semibold">{isVi ? 'Đã thu' : 'Collected'}</th>
                  <th className="py-2 font-semibold">{isVi ? 'Chờ thu' : 'Pending check-in'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5DFD3]">
                {data.byStay.map((p) => (
                  <tr key={p.stayId}>
                    <td className="py-2.5 font-semibold text-[#17221E]">
                      {isVi ? p.stayTitleVi : p.stayTitleEn}
                    </td>
                    <td className="py-2.5">{p.bookingsCount}</td>
                    <td className="py-2.5 font-semibold text-[#164E3F]">
                      {formatVndExact(p.collectedVnd)}
                    </td>
                    <td className="py-2.5 text-[#53635D]">
                      {formatVndExact(p.pendingVnd)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Transaction History */}
      <section className="rounded-xl border border-[#E5DFD3] bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-[#17221E]">
          {isVi ? 'Lịch sử giao dịch chi tiết' : 'Transaction History'}
        </h2>
        {data.transactions.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[#E5DFD3] bg-[#FAF8F3] p-8 text-center text-xs text-[#53635D]">
            {isVi
              ? 'Chưa có giao dịch đặt phòng nào trong bộ lọc hiện tại.'
              : 'No transactions match the selected filter.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-[#E5DFD3] text-[#53635D]">
                  <th className="py-2 font-semibold">{isVi ? 'Mã đơn' : 'Code'}</th>
                  <th className="py-2 font-semibold">{isVi ? 'Chỗ ở' : 'Property'}</th>
                  <th className="py-2 font-semibold">{isVi ? 'Ngày ở' : 'Dates'}</th>
                  <th className="py-2 font-semibold">{isVi ? 'Host nhận (100%)' : 'Host payout'}</th>
                  <th className="py-2 font-semibold">{isVi ? 'Trạng thái' : 'Status'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5DFD3]">
                {data.transactions.map((t) => (
                  <tr key={t.id}>
                    <td className="py-2.5 font-mono font-semibold text-[#164E3F]">
                      {t.bookingCode}
                    </td>
                    <td className="py-2.5 font-medium text-[#17221E]">
                      {isVi ? t.stayTitleVi : t.stayTitleEn}
                    </td>
                    <td className="py-2.5 text-[#53635D]">
                      {t.checkIn} → {t.checkOut} ({t.nights}n)
                    </td>
                    <td className="py-2.5 font-semibold text-[#17221E]">
                      {formatVndExact(t.hostNetVnd)}
                    </td>
                    <td className="py-2.5">
                      <span className="rounded border border-[#E5DFD3] bg-[#FAF8F3] px-2 py-0.5 text-[11px] font-medium">
                        {formatBookingStatusLabel(t.status, locale)}
                      </span>
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
