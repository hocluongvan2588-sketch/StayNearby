'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowLeftRight, Check, Minus, X } from 'lucide-react';
import {
  formatBusinessModelLabel,
  formatCancellationPolicyLabel,
  formatKitchenTypeLabel,
  formatLaundryTypeLabel,
} from '@/lib/i18n';
import { usePreferences } from './PreferencesProvider';

export function CompareDrawer() {
  const { locale, formatMoney, compareList, toggleCompare, clearCompare } =
    usePreferences();
  const [openModal, setOpenModal] = useState(false);

  if (compareList.length === 0) return null;
  const isVi = locale === 'vi';

  return (
    <>
      <div className="fixed bottom-4 left-1/2 z-40 w-[94%] max-w-3xl -translate-x-1/2 rounded-2xl border border-[#164E3F]/25 bg-[#0F392E] px-4 py-3 text-white shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm">
            <ArrowLeftRight className="h-4 w-4 text-[#E6B87A]" />
            <span className="font-semibold">
              {isVi
                ? `So sánh chỗ ở (${compareList.length}/3)`
                : `Compare stays (${compareList.length}/3)`}
            </span>
            <div className="hidden gap-1.5 sm:flex">
              {compareList.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggleCompare(s)}
                  className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-0.5 text-xs hover:bg-white/25"
                >
                  {isVi ? s.titleVi : s.titleEn}
                  <X className="h-3 w-3" />
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={clearCompare}
              className="rounded-lg px-2.5 py-1.5 text-xs text-[#CDE0D9] hover:text-white"
            >
              {isVi ? 'Bỏ chọn' : 'Clear'}
            </button>
            <button
              type="button"
              onClick={() => setOpenModal(true)}
              className="rounded-lg bg-[#C25E28] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#ad5020]"
            >
              {isVi ? 'So sánh' : 'Compare'}
            </button>
          </div>
        </div>
      </div>

      {openModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between border-b border-[#E5DFD3] pb-3">
              <div>
                <h3 className="text-xl font-semibold text-[#17221E]">
                  {isVi ? 'So sánh các chỗ ở đã chọn' : 'Compare selected stays'}
                </h3>
                <p className="text-xs text-[#53635D]">
                  {isVi
                    ? 'Đối chiếu giá, tiện nghi sinh hoạt, chính sách hủy và kết nối internet.'
                    : 'Compare rates, home amenities, cancellation terms, and internet setup side by side.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpenModal(false)}
                className="rounded-full border border-[#E5DFD3] p-2 hover:bg-[#FAF8F3]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[#E5DFD3]">
                    <th className="py-3 pr-4 text-xs font-semibold text-[#53635D]">
                      {isVi ? 'Tiêu chí' : 'Feature'}
                    </th>
                    {compareList.map((s) => (
                      <th key={s.id} className="w-1/4 py-3 px-3 align-top">
                        <Link
                          href={`/stays/${s.slug}`}
                          onClick={() => setOpenModal(false)}
                          className="block text-base font-semibold text-[#164E3F] hover:underline"
                        >
                          {isVi ? s.titleVi : s.titleEn}
                        </Link>
                        <span className="text-xs font-normal text-[#53635D]">
                          {isVi ? s.destinationNameVi : s.destinationNameEn}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5DFD3] text-xs sm:text-sm">
                  <tr>
                    <td className="py-3 pr-4 font-medium text-[#53635D]">
                      {isVi ? 'Giá 1 tuần (7 đêm)' : '1 week (7 nights)'}
                    </td>
                    {compareList.map((s) => (
                      <td key={s.id} className="px-3 py-3 font-semibold text-[#17221E]">
                        {formatMoney(s.weekDisplayVnd)}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 font-medium text-[#53635D]">
                      {isVi ? 'Giá 1 tháng (30 đêm)' : '1 month (30 nights)'}
                    </td>
                    {compareList.map((s) => (
                      <td key={s.id} className="px-3 py-3 font-semibold text-[#17221E]">
                        {formatMoney(s.monthDisplayVnd)}
                        <div className="text-[11px] font-normal text-[#53635D]">
                          {formatMoney(s.monthNightVnd)} / {isVi ? 'đêm' : 'night'}
                        </div>
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 font-medium text-[#53635D]">
                      {isVi ? 'Bếp & Giặt đồ' : 'Kitchen & Laundry'}
                    </td>
                    {compareList.map((s) => (
                      <td key={s.id} className="px-3 py-3">
                        {formatKitchenTypeLabel(s.kitchenType, locale)} ·{' '}
                        {formatLaundryTypeLabel(s.laundryType, locale)}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 font-medium text-[#53635D]">
                      {isVi ? 'Chính sách hủy' : 'Cancellation'}
                    </td>
                    {compareList.map((s) => (
                      <td key={s.id} className="px-3 py-3">
                        {formatCancellationPolicyLabel(s.cancellationPolicy, locale)}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 font-medium text-[#53635D]">
                      {isVi ? 'Phương thức đặt' : 'Booking flow'}
                    </td>
                    {compareList.map((s) => (
                      <td key={s.id} className="px-3 py-3">
                        {formatBusinessModelLabel(s.businessModel, locale)}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 font-medium text-[#53635D]">
                      {isVi ? 'Wi-Fi' : 'Wi-Fi'}
                    </td>
                    {compareList.map((s) => (
                      <td key={s.id} className="px-3 py-3">
                        {s.wifiDownloadMbps > 0
                          ? `${s.wifiDownloadMbps} Mbps`
                          : isVi
                            ? 'Chưa cập nhật'
                            : 'N/A'}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 font-medium text-[#53635D]">
                      {isVi ? 'Bàn làm việc riêng' : 'Dedicated desk'}
                    </td>
                    {compareList.map((s) => (
                      <td key={s.id} className="px-3 py-3">
                        {s.hasWorkspace ? (
                          <Check className="h-4 w-4 text-[#164E3F]" />
                        ) : (
                          <Minus className="h-4 w-4 text-[#53635D]" />
                        )}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
