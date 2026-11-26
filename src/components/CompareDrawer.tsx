'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowLeftRight, Check, Minus, Wifi, X } from 'lucide-react';
import {
  formatBusinessModelLabel,
  formatCancellationPolicyLabel,
  formatMoneyFromVnd,
} from '@/lib/i18n';
import { usePreferences } from './PreferencesProvider';

export function CompareDrawer() {
  const { locale, currency, compareList, toggleCompare, clearCompare } = usePreferences();
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
                ? `Đã chọn so sánh (${compareList.length}/3)`
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
              {isVi ? 'Bỏ chọn hết' : 'Clear'}
            </button>
            <button
              type="button"
              onClick={() => setOpenModal(true)}
              className="rounded-lg bg-[#C25E28] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#ad5020]"
            >
              {isVi ? 'So sánh ngay' : 'Compare now'}
            </button>
          </div>
        </div>
      </div>

      {openModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between border-b border-[#E5DFD3] pb-3">
              <div>
                <h3 className="font-serif-display text-2xl font-semibold text-[#17221E]">
                  {isVi ? 'So sánh các chỗ ở đã chọn' : 'Compare selected stays'}
                </h3>
                <p className="text-xs text-[#53635D]">
                  {isVi
                    ? 'Đối chiếu tốc độ Wi-Fi, bàn làm việc và giá thuê 1 tuần, 1 tháng.'
                    : 'Check Wi-Fi speeds, desk setups, and weekly or monthly rates side by side.'}
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
                    <th className="py-3 pr-4 text-xs uppercase tracking-wider text-[#53635D]">
                      {isVi ? 'Tiêu chí' : 'Feature'}
                    </th>
                    {compareList.map((s) => (
                      <th key={s.id} className="w-1/4 py-3 px-3 align-top">
                        <Link
                          href={`/stays/${s.slug}`}
                          onClick={() => setOpenModal(false)}
                          className="font-serif-display block text-base font-semibold text-[#164E3F] hover:underline"
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
                      {isVi ? 'Tốc độ Wi-Fi' : 'Wi-Fi speed'}
                    </td>
                    {compareList.map((s) => (
                      <td key={s.id} className="px-3 py-3 font-semibold text-[#164E3F]">
                        <Wifi className="mr-1 inline h-4 w-4" />
                        {s.wifiDownloadMbps} / {s.wifiUploadMbps} Mbps ({s.wifiJitterMs}ms)
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 font-medium text-[#53635D]">
                      {isVi ? 'Giá 1 tháng' : '1 month'}
                    </td>
                    {compareList.map((s) => (
                      <td key={s.id} className="px-3 py-3 font-bold text-[#17221E]">
                        {formatMoneyFromVnd(s.monthDisplayVnd, currency)}
                        <div className="text-[11px] font-normal text-[#53635D]">
                          {formatMoneyFromVnd(s.monthNightVnd, currency)} / {isVi ? 'đêm' : 'night'}
                        </div>
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 font-medium text-[#53635D]">
                      {isVi ? 'Giá 1 tuần (7 đêm)' : '1 week (7 nights)'}
                    </td>
                    {compareList.map((s) => (
                      <td key={s.id} className="px-3 py-3">
                        {formatMoneyFromVnd(s.weekDisplayVnd, currency)}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 font-medium text-[#53635D]">
                      {isVi ? 'Cách đặt phòng' : 'Booking method'}
                    </td>
                    {compareList.map((s) => (
                      <td key={s.id} className="px-3 py-3">
                        {formatBusinessModelLabel(s.businessModel, locale)}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 font-medium text-[#53635D]">
                      {isVi ? 'Màn hình 4K' : '4K monitor'}
                    </td>
                    {compareList.map((s) => (
                      <td key={s.id} className="px-3 py-3">
                        {s.hasExternalMonitor ? (
                          <Check className="h-4 w-4 text-[#164E3F]" />
                        ) : (
                          <Minus className="h-4 w-4 text-[#53635D]" />
                        )}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 font-medium text-[#53635D]">
                      {isVi ? 'Chỗ làm việc gần nhất' : 'Nearest coworking'}
                    </td>
                    {compareList.map((s) => (
                      <td key={s.id} className="px-3 py-3">
                        {s.nearestCoworking
                          ? `${s.nearestCoworking.distanceKm} km, ${s.nearestCoworking.name}`
                          : isVi
                            ? 'Không có'
                            : 'None nearby'}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 font-medium text-[#53635D]">
                      {isVi ? 'Bếp và giặt đồ' : 'Kitchen & laundry'}
                    </td>
                    {compareList.map((s) => (
                      <td key={s.id} className="px-3 py-3">
                        {isVi
                          ? `${s.kitchenType === 'full' ? 'Bếp riêng' : 'Bếp chung'}, ${s.laundryType === 'in_unit' ? 'Máy giặt riêng' : 'Giặt chung'}`
                          : `${s.kitchenType === 'full' ? 'Full kitchen' : 'Shared kitchen'}, ${s.laundryType === 'in_unit' ? 'In-unit washer' : 'Building laundry'}`}
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
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
