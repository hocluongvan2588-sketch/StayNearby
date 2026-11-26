'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, SlidersHorizontal, Wifi } from 'lucide-react';
import { addDaysIso, getTodayIsoVietnam } from '@/lib/dates';
import type { DestinationSummary, LifestyleItem, StayCardItem } from '@/modules/catalog';
import { usePreferences } from './PreferencesProvider';
import { PaginatedStayGrid } from './PaginatedStayGrid';

export interface SearchFilterState {
  destination: string;
  lifestyle: string;
  checkIn: string;
  nights: number;
  minWifi: string;
  model: string;
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
  const { locale } = usePreferences();
  const isVi = locale === 'vi';

  function pushFilters(next: Partial<SearchFilterState>) {
    const merged = { ...filters, ...next };
    const sp = new URLSearchParams();
    if (merged.destination && merged.destination !== 'all') sp.set('destination', merged.destination);
    if (merged.lifestyle && merged.lifestyle !== 'all') sp.set('lifestyle', merged.lifestyle);
    if (merged.checkIn) sp.set('checkIn', merged.checkIn);
    if (merged.nights) sp.set('nights', String(merged.nights));
    if (merged.minWifi) sp.set('minWifi', merged.minWifi);
    if (merged.model && merged.model !== 'all') sp.set('model', merged.model);
    if (merged.monitor) sp.set('monitor', '1');
    if (merged.booth) sp.set('booth', '1');
    if (merged.kitchen) sp.set('kitchen', '1');
    if (merged.laundry) sp.set('laundry', '1');
    if (merged.pet) sp.set('pet', '1');
    if (merged.sort && merged.sort !== 'wifi_desc') sp.set('sort', merged.sort);
    router.push(`/stays?${sp.toString()}`);
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col justify-between gap-4 border-b border-[#E5DFD3] pb-6 md:flex-row md:items-end">
        <div>
          <span className="text-xs font-semibold uppercase tracking-widest text-[#C25E28]">
            {isVi ? 'Phòng đang mở đặt' : 'Live availability'}
          </span>
          <h1 className="font-serif-display mt-1 text-3xl font-semibold text-[#17221E] sm:text-4xl">
            {isVi
              ? `${stays.length} chỗ ở phù hợp cho ${filters.nights} đêm`
              : `${stays.length} stays available for ${filters.nights} nights`}
          </h1>
          <p className="mt-1 text-sm text-[#53635D]">
            {isVi
              ? `Nhận phòng ngày ${filters.checkIn}. Tất cả chỗ ở đều có Wi-Fi đo thật, bàn làm việc và bếp.`
              : `Check-in ${filters.checkIn}. Includes verified Wi-Fi, a dedicated desk, and kitchen access.`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => pushFilters({ checkIn: addDaysIso(filters.checkIn, -1) })}
            className="inline-flex items-center gap-1 rounded-xl border border-[#E5DFD3] bg-white px-3 py-2 text-xs font-medium hover:bg-[#FAF8F3]"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            {isVi ? 'Lùi 1 ngày' : 'Previous day'}
          </button>
          <button
            type="button"
            onClick={() => pushFilters({ checkIn: addDaysIso(filters.checkIn, 1) })}
            className="inline-flex items-center gap-1 rounded-xl border border-[#E5DFD3] bg-white px-3 py-2 text-xs font-medium hover:bg-[#FAF8F3]"
          >
            {isVi ? 'Tiến 1 ngày' : 'Next day'}
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
          <select
            value={filters.sort}
            onChange={(e) => pushFilters({ sort: e.target.value })}
            className="rounded-xl border border-[#E5DFD3] bg-white px-3 py-2 text-xs font-semibold text-[#17221E]"
          >
            <option value="wifi_desc">{isVi ? 'Wi-Fi nhanh nhất' : 'Fastest Wi-Fi'}</option>
            <option value="price_asc">{isVi ? 'Giá tháng tăng dần' : 'Lowest monthly price'}</option>
            <option value="savings_desc">{isVi ? 'Giảm giá nhiều nhất' : 'Biggest monthly savings'}</option>
            <option value="rating_desc">{isVi ? 'Đánh giá cao nhất' : 'Highest Google rating'}</option>
          </select>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[248px_1fr] lg:items-start">
        <aside className="space-y-6 rounded-3xl border border-[#E5DFD3] bg-white p-5">
          <div className="flex items-center justify-between border-b border-[#E5DFD3] pb-3">
            <span className="flex items-center gap-2 text-sm font-bold text-[#17221E]">
              <SlidersHorizontal className="h-4 w-4 text-[#164E3F]" />
              {isVi ? 'Bộ lọc tìm kiếm' : 'Filters'}
            </span>
            <Link href="/stays" className="text-xs font-medium text-[#C25E28] hover:underline">
              {isVi ? 'Xóa bộ lọc' : 'Reset'}
            </Link>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-[#53635D]">
              {isVi ? 'Thành phố' : 'City'}
            </label>
            <select
              value={filters.destination}
              onChange={(e) => pushFilters({ destination: e.target.value })}
              className="w-full rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2 text-sm font-medium"
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
            <label className="text-xs font-semibold uppercase tracking-wider text-[#53635D]">
              {isVi ? 'Số đêm (từ 7 đêm)' : 'Length of stay'}
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {[7, 14, 21, 30].map((n) => (
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
                  {n === 30 ? (isVi ? '1 tháng' : '1 month') : `${n / 7} ${isVi ? 'tuần' : n === 7 ? 'week' : 'weeks'}`}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-[#53635D]">
              {isVi ? 'Ngày nhận phòng' : 'Check-in date'}
            </label>
            <input
              type="date"
              min={getTodayIsoVietnam()}
              value={filters.checkIn}
              onChange={(e) => pushFilters({ checkIn: e.target.value })}
              className="w-full rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2 text-sm font-medium"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-[#53635D]">
              {isVi ? 'Phong cách ở' : 'Lifestyle'}
            </label>
            <select
              value={filters.lifestyle}
              onChange={(e) => pushFilters({ lifestyle: e.target.value })}
              className="w-full rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2 text-sm font-medium"
            >
              <option value="all">{isVi ? 'Tất cả' : 'All lifestyles'}</option>
              {lifestyles.map((l) => (
                <option key={l.id} value={l.slug}>
                  {isVi ? l.nameVi : l.nameEn}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-[#53635D]">
              <Wifi className="h-3.5 w-3.5 text-[#164E3F]" />
              {isVi ? 'Wi-Fi tối thiểu' : 'Min Wi-Fi speed'}
            </label>
            <select
              value={filters.minWifi}
              onChange={(e) => pushFilters({ minWifi: e.target.value })}
              className="w-full rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2 text-sm font-medium"
            >
              <option value="">{isVi ? 'Tất cả tốc độ' : 'Any speed'}</option>
              <option value="150">150+ Mbps</option>
              <option value="300">300+ Mbps</option>
              <option value="450">450+ Mbps</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-[#53635D]">
              {isVi ? 'Hình thức đặt phòng' : 'Booking method'}
            </label>
            <select
              value={filters.model}
              onChange={(e) => pushFilters({ model: e.target.value })}
              className="w-full rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2 text-sm font-medium"
            >
              <option value="all">{isVi ? 'Tất cả' : 'All booking methods'}</option>
              <option value="booking_flow">{isVi ? 'Đặt qua VietNomad (giữ chỗ 12%)' : 'Book on VietNomad (12% fee)'}</option>
              <option value="stay_direct">{isVi ? 'Đặt trực tiếp chủ nhà (0% phí sàn)' : 'Direct Host Booking (0% fee)'}</option>
            </select>
          </div>

          <div className="space-y-2 border-t border-[#E5DFD3] pt-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-[#53635D]">
              {isVi ? 'Tiện nghi' : 'Amenities'}
            </div>
            {[
              { key: 'monitor', val: filters.monitor, label: isVi ? 'Có màn hình 4K rời' : 'External 4K monitor' },
              { key: 'booth', val: filters.booth, label: isVi ? 'Có phòng gọi điện riêng' : 'Call booths available' },
              { key: 'kitchen', val: filters.kitchen, label: isVi ? 'Bếp riêng đầy đủ' : 'Full private kitchen' },
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
        </aside>

        <div>
          {stays.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-[#E5DFD3] bg-white p-12 text-center">
              <h2 className="font-serif-display text-2xl font-semibold text-[#17221E]">
                {isVi ? 'Chưa có phòng khớp hết các điều kiện bạn chọn' : 'No stays match all selected filters'}
              </h2>
              <p className="mt-2 text-sm text-[#53635D]">
                {isVi
                  ? 'Hãy bỏ bớt tiêu chí như màn hình rời hoặc đổi ngày nhận phòng để xem thêm lựa chọn.'
                  : 'Try unchecking a filter or changing your check-in date to see more stays.'}
              </p>
              <Link
                href="/stays"
                className="mt-5 inline-block rounded-xl bg-[#164E3F] px-5 py-2.5 text-sm font-semibold text-white"
              >
                {isVi ? 'Xem lại tất cả chỗ ở' : 'Show all stays'}
              </Link>
            </div>
          ) : (
            <PaginatedStayGrid
              stays={stays}
              savedIds={savedIds}
              isAuthenticated={isAuthenticated}
              gapClass="gap-5"
            />
          )}
        </div>
      </div>
    </div>
  );
}
