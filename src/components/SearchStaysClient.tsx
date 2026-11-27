'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, SlidersHorizontal } from 'lucide-react';
import {
  MAX_NIGHTS,
  STAY_PACKAGE_TIERS,
  clampStayNights,
} from '@/lib/business-rules';
import { addDaysIso, getTodayIsoVietnam } from '@/lib/dates';
import { formatCountNoun, formatNightsLabel } from '@/lib/i18n';
import type { DestinationSummary, LifestyleItem, StayCardItem } from '@/modules/catalog';
import { usePreferences } from './PreferencesProvider';
import { PaginatedStayGrid } from './PaginatedStayGrid';

export interface SearchFilterState {
  destination: string;
  lifestyle: string;
  checkIn: string;
  nights: number;
  minWifi: string;
  wifiVerified: boolean;
  workReady: boolean;
  workspace: boolean;
  chair: boolean;
  monitor: boolean;
  booth: boolean;
  kitchen: boolean;
  laundry: boolean;
  pet: boolean;
  sort: string;
}

export function SearchStaysClient({
  stays,
  destinations,
  lifestyles,
  filters,
  savedIds,
  isAuthenticated,
}: {
  stays: StayCardItem[];
  destinations: DestinationSummary[];
  lifestyles: LifestyleItem[];
  filters: SearchFilterState;
  savedIds: string[];
  isAuthenticated: boolean;
}) {
  const router = useRouter();
  const { locale, platformConfig } = usePreferences();
  const isVi = locale === 'vi';
  const minNights = platformConfig.defaultMinNights;
  const tierOptions = STAY_PACKAGE_TIERS.filter((n) => n >= minNights);

  function pushFilters(next: Partial<SearchFilterState>) {
    const merged = { ...filters, ...next };
    const sp = new URLSearchParams();
    if (merged.destination && merged.destination !== 'all') sp.set('destination', merged.destination);
    if (merged.lifestyle && merged.lifestyle !== 'all') sp.set('lifestyle', merged.lifestyle);
    if (merged.checkIn) sp.set('checkIn', merged.checkIn);
    if (merged.nights) sp.set('nights', String(merged.nights));
    if (merged.minWifi) sp.set('minWifi', merged.minWifi);
    if (merged.wifiVerified) sp.set('wifiVerified', '1');
    if (merged.workReady) sp.set('workReady', '1');
    if (merged.workspace) sp.set('workspace', '1');
    if (merged.chair) sp.set('chair', '1');
    if (merged.monitor) sp.set('monitor', '1');
    if (merged.booth) sp.set('booth', '1');
    if (merged.kitchen) sp.set('kitchen', '1');
    if (merged.laundry) sp.set('laundry', '1');
    if (merged.pet) sp.set('pet', '1');
    if (merged.sort && merged.sort !== 'featured') sp.set('sort', merged.sort);
    router.push(`/stays?${sp.toString()}`);
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col justify-between gap-4 border-b border-[#E5DFD3] pb-6 md:flex-row md:items-end">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-[#17221E] sm:text-[34px]">
            {isVi
              ? `${stays.length} chỗ ở sẵn sàng cho ${filters.nights} đêm`
              : `${formatCountNoun(stays.length, 'stay', 'stays', 'chỗ ở', locale)} available for ${formatNightsLabel(filters.nights, locale)}`}
          </h1>
          <p className="mt-1.5 text-sm text-[#53635D]">
            {isVi
              ? `Nhận phòng ${filters.checkIn}. Tùy chỉnh theo thành phố, phong cách, tiện nghi sinh hoạt hoặc không gian làm việc.`
              : `Check-in ${filters.checkIn}. Refine by city, travel style, home comforts, or optional remote-work setup.`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => pushFilters({ checkIn: addDaysIso(filters.checkIn, -1) })}
            className="inline-flex items-center gap-1 rounded-xl border border-[#E5DFD3] bg-white px-3 py-2 text-xs font-medium text-[#17221E] hover:bg-[#FAF8F3]"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            {isVi ? 'Lùi 1 ngày' : 'Previous day'}
          </button>
          <button
            type="button"
            onClick={() => pushFilters({ checkIn: addDaysIso(filters.checkIn, 1) })}
            className="inline-flex items-center gap-1 rounded-xl border border-[#E5DFD3] bg-white px-3 py-2 text-xs font-medium text-[#17221E] hover:bg-[#FAF8F3]"
          >
            {isVi ? 'Tiến 1 ngày' : 'Next day'}
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
          <select
            value={filters.sort}
            onChange={(e) => pushFilters({ sort: e.target.value })}
            className="rounded-xl border border-[#E5DFD3] bg-white px-3 py-2 text-xs font-semibold text-[#17221E] outline-none"
          >
            <option value="featured">{isVi ? 'Nổi bật nhất' : 'Featured'}</option>
            <option value="price_asc">{isVi ? 'Giá tốt nhất' : 'Lowest price'}</option>
            <option value="rating_desc">{isVi ? 'Đánh giá cao nhất' : 'Highest rated'}</option>
            <option value="savings_desc">{isVi ? 'Ưu đãi lưu trú dài nhiều nhất' : 'Best stay savings'}</option>
            <option value="wifi_desc">{isVi ? 'Wi-Fi nhanh nhất' : 'Fastest Wi-Fi'}</option>
          </select>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[260px_1fr] lg:items-start">
        <aside className="space-y-6 rounded-2xl border border-[#E5DFD3] bg-white p-5">
          <div className="flex items-center justify-between border-b border-[#E5DFD3] pb-3">
            <span className="flex items-center gap-2 text-sm font-semibold text-[#17221E]">
              <SlidersHorizontal className="h-4 w-4 text-[#164E3F]" />
              {isVi ? 'Bộ lọc chỗ ở' : 'Filters'}
            </span>
            <Link href="/stays" className="text-xs font-medium text-[#C25E28] hover:underline">
              {isVi ? 'Xóa bộ lọc' : 'Reset filters'}
            </Link>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#53635D]">
              {isVi ? 'Thành phố' : 'Destination'}
            </label>
            <select
              value={filters.destination}
              onChange={(e) => pushFilters({ destination: e.target.value })}
              className="w-full rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2 text-sm font-medium text-[#17221E] outline-none"
            >
              <option value="all">{isVi ? 'Tất cả thành phố' : 'All cities'}</option>
              {destinations.map((d) => (
                <option key={d.id} value={d.slug}>
                  {isVi ? d.nameVi : d.nameEn}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#53635D]">
              {isVi ? 'Thời gian lưu trú' : 'Length of stay'}
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {tierOptions.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => pushFilters({ nights: n })}
                  className={`rounded-xl px-2.5 py-2 text-xs font-semibold transition ${
                    filters.nights === n
                      ? 'bg-[#164E3F] text-white'
                      : 'border border-[#E5DFD3] bg-[#FAF8F3] text-[#17221E] hover:bg-[#E7F1EC]'
                  }`}
                >
                  {n === 30
                    ? isVi
                      ? '1 tháng'
                      : '1 month'
                    : `${n / 7} ${isVi ? 'tuần' : n === 7 ? 'week' : 'weeks'}`}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <input
                key={filters.nights}
                type="number"
                inputMode="numeric"
                min={minNights}
                max={MAX_NIGHTS}
                defaultValue={filters.nights}
                aria-label={isVi ? 'Số đêm tùy chỉnh' : 'Custom nights'}
                placeholder={isVi ? `Tối thiểu ${minNights}` : `Min ${minNights}`}
                onBlur={(e) => {
                  const v = clampStayNights(
                    Number(e.target.value) || minNights,
                    minNights
                  );
                  if (v !== filters.nights) pushFilters({ nights: v });
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur();
                }}
                className="h-9 w-24 rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-2.5 text-xs font-semibold tabular-nums text-[#17221E] outline-none"
              />
              <span className="text-[11px] text-[#53635D]">
                {isVi ? 'đêm tùy chỉnh' : 'custom nights'}
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#53635D]">
              {isVi ? 'Ngày nhận phòng' : 'Check-in date'}
            </label>
            <input
              type="date"
              min={getTodayIsoVietnam()}
              value={filters.checkIn}
              onChange={(e) => pushFilters({ checkIn: e.target.value })}
              className="w-full rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2 text-sm font-medium text-[#17221E] outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#53635D]">
              {isVi ? 'Phong cách trải nghiệm' : 'Travel style'}
            </label>
            <select
              value={filters.lifestyle}
              onChange={(e) => pushFilters({ lifestyle: e.target.value })}
              className="w-full rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2 text-sm font-medium text-[#17221E] outline-none"
            >
              <option value="all">{isVi ? 'Tất cả phong cách' : 'All styles'}</option>
              {lifestyles.map((l) => (
                <option key={l.id} value={l.slug}>
                  {isVi ? l.nameVi : l.nameEn}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2 border-t border-[#E5DFD3] pt-3">
            <div className="text-xs font-semibold text-[#53635D]">
              {isVi ? 'Tiện nghi sinh hoạt' : 'Home & Living'}
            </div>
            {[
              { key: 'kitchen', val: filters.kitchen, label: isVi ? 'Bếp riêng đầy đủ' : 'Full kitchen' },
              { key: 'laundry', val: filters.laundry, label: isVi ? 'Máy giặt trong phòng' : 'In-unit washer' },
              { key: 'pet', val: filters.pet, label: isVi ? 'Cho phép thú cưng' : 'Pet friendly' },
            ].map((item) => (
              <label key={item.key} className="flex cursor-pointer items-center gap-2 text-sm text-[#17221E]">
                <input
                  type="checkbox"
                  checked={item.val}
                  onChange={(e) => pushFilters({ [item.key]: e.target.checked })}
                  className="h-4 w-4 rounded accent-[#164E3F]"
                />
                <span>{item.label}</span>
              </label>
            ))}
          </div>

          <div className="space-y-2 border-t border-[#E5DFD3] pt-3">
            <div className="text-xs font-semibold text-[#53635D]">
              {isVi ? 'Làm việc từ xa (tùy chọn)' : 'Workspace & Internet (Optional)'}
            </div>
            <select
              value={filters.minWifi}
              onChange={(e) => pushFilters({ minWifi: e.target.value })}
              className="mb-1.5 w-full rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2 text-xs font-medium text-[#17221E] outline-none"
            >
              <option value="">{isVi ? 'Wi-Fi: Mọi tốc độ' : 'Wi-Fi: Any speed'}</option>
              <option value="50">50+ Mbps</option>
              <option value="150">150+ Mbps</option>
              <option value="300">300+ Mbps</option>
            </select>
            {[
              { key: 'workspace', val: filters.workspace, label: isVi ? 'Bàn làm việc riêng' : 'Dedicated desk' },
              { key: 'chair', val: filters.chair, label: isVi ? 'Ghế công thái học' : 'Ergonomic chair' },
              { key: 'monitor', val: filters.monitor, label: isVi ? 'Màn hình ngoài' : 'External monitor' },
              { key: 'wifiVerified', val: filters.wifiVerified, label: isVi ? 'Wi-Fi đã kiểm định' : 'Wi-Fi Verified' },
              { key: 'workReady', val: filters.workReady, label: isVi ? 'Chuẩn Work-Ready' : 'Work-Ready' },
            ].map((item) => (
              <label key={item.key} className="flex cursor-pointer items-center gap-2 text-sm text-[#17221E]">
                <input
                  type="checkbox"
                  checked={item.val}
                  onChange={(e) => pushFilters({ [item.key]: e.target.checked })}
                  className="h-4 w-4 rounded accent-[#164E3F]"
                />
                <span>{item.label}</span>
              </label>
            ))}
          </div>
        </aside>

        <div>
          {stays.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#E5DFD3] bg-white p-12 text-center">
              <h2 className="text-xl font-semibold text-[#17221E]">
                {isVi
                  ? 'Chưa có chỗ ở khớp hết tiêu chí bạn chọn'
                  : 'No stays match all selected filters'}
              </h2>
              <p className="mt-2 text-sm text-[#53635D]">
                {isVi
                  ? 'Hãy thử bỏ bớt bộ lọc hoặc chọn ngày nhận phòng khác.'
                  : 'Try clearing a filter or selecting a different check-in date.'}
              </p>
              <Link
                href="/stays"
                className="mt-5 inline-block rounded-xl bg-[#164E3F] px-5 py-2.5 text-sm font-semibold text-white"
              >
                {isVi ? 'Xem tất cả chỗ ở' : 'Show all stays'}
              </Link>
            </div>
          ) : (
            <PaginatedStayGrid
              stays={stays}
              savedIds={savedIds}
              isAuthenticated={isAuthenticated}
              gapClass="gap-6"
            />
          )}
        </div>
      </div>
    </div>
  );
}
