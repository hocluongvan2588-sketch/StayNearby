'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, SlidersHorizontal, Wifi } from 'lucide-react';
import { addDaysIso, getTodayIsoVietnam } from '@/lib/dates';
import type { DestinationSummary, LifestyleItem, StayCardItem } from '@/modules/catalog';
import { usePreferences } from './PreferencesProvider';
import { StayCard } from './StayCard';

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
  const savedSet = new Set(savedIds);

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
            {isVi ? 'Kho phòng dài ngày đang trống' : 'Live Vietnam Nomad Inventory'}
          </span>
          <h1 className="font-serif-display mt-1 text-3xl font-semibold text-[#17221E] sm:text-4xl">
            {isVi
              ? `${stays.length} chỗ ở sẵn sàng cho ${filters.nights} đêm`
              : `${stays.length} Work-Ready Stays for ${filters.nights} nights`}
          </h1>
          <p className="mt-1 text-sm text-[#53635D]">
            {isVi
              ? `Nhận phòng từ ${filters.checkIn} · Luôn bao gồm Wi-Fi kiểm định, bàn làm việc & bếp.`
              : `Check-in ${filters.checkIn} · Always includes verified Wi-Fi, workspace, and kitchen.`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => pushFilters({ checkIn: addDaysIso(filters.checkIn, -1) })}
            className="inline-flex items-center gap-1 rounded-xl border border-[#E5DFD3] bg-white px-3 py-2 text-xs font-medium hover:bg-[#FAF8F3]"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            {isVi ? 'Ngày trước' : 'Previous Day'}
          </button>
          <button
            type="button"
            onClick={() => pushFilters({ checkIn: addDaysIso(filters.checkIn, 1) })}
            className="inline-flex items-center gap-1 rounded-xl border border-[#E5DFD3] bg-white px-3 py-2 text-xs font-medium hover:bg-[#FAF8F3]"
          >
            {isVi ? 'Ngày sau' : 'Next Day'}
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
          <select
            value={filters.sort}
            onChange={(e) => pushFilters({ sort: e.target.value })}
            className="rounded-xl border border-[#E5DFD3] bg-white px-3 py-2 text-xs font-semibold text-[#17221E]"
          >
            <option value="wifi_desc">{isVi ? 'Wi-Fi nhanh nhất' : 'Fastest Tested Wi-Fi'}</option>
            <option value="price_asc">{isVi ? 'Giá tháng thấp → cao' : 'Monthly Price: Low to High'}</option>
            <option value="savings_desc">{isVi ? 'Ưu đãi giảm nhiều nhất' : 'Biggest Long-Stay Savings'}</option>
            <option value="rating_desc">{isVi ? 'Google Reviews cao nhất' : 'Highest Google Rating'}</option>
          </select>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        {/* Filter Sidebar matching NomadStays */}
        <aside className="space-y-6 rounded-3xl border border-[#E5DFD3] bg-white p-5 lg:col-span-3 h-fit">
          <div className="flex items-center justify-between border-b border-[#E5DFD3] pb-3">
            <span className="flex items-center gap-2 text-sm font-bold text-[#17221E]">
              <SlidersHorizontal className="h-4 w-4 text-[#164E3F]" />
              {isVi ? 'Bộ lọc Nomad' : 'Nomad Filters'}
            </span>
            <Link href="/stays" className="text-xs font-medium text-[#C25E28] hover:underline">
              {isVi ? 'Đặt lại' : 'Reset'}
            </Link>
          </div>

          {/* Destination */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-[#53635D]">
              {isVi ? 'Điểm đến Việt Nam' : 'Vietnam Hub'}
            </label>
            <select
              value={filters.destination}
              onChange={(e) => pushFilters({ destination: e.target.value })}
              className="w-full rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2 text-sm font-medium"
            >
              <option value="all">{isVi ? 'Tất cả thành phố' : 'Anywhere in Vietnam'}</option>
              {destinations.map((d) => (
                <option key={d.id} value={d.slug}>
                  {isVi ? d.nameVi : d.nameEn}
                </option>
              ))}
            </select>
          </div>

          {/* Length of Stay */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-[#53635D]">
              {isVi ? 'Độ dài gói (tối thiểu 7 đêm)' : 'Length of Stay'}
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
                  {n === 30 ? (isVi ? '1 tháng (30đ)' : '1 month') : `${n / 7} ${isVi ? 'tuần' : n === 7 ? 'week' : 'weeks'}`}
                </button>
              ))}
            </div>
          </div>

          {/* Check-in Date */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-[#53635D]">
              {isVi ? 'Ngày nhận phòng' : 'Check-In Date'}
            </label>
            <input
              type="date"
              min={getTodayIsoVietnam()}
              value={filters.checkIn}
              onChange={(e) => pushFilters({ checkIn: e.target.value })}
              className="w-full rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2 text-sm font-medium"
            />
          </div>

          {/* Lifestyle */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-[#53635D]">
              {isVi ? 'Lối sống' : 'Lifestyle'}
            </label>
            <select
              value={filters.lifestyle}
              onChange={(e) => pushFilters({ lifestyle: e.target.value })}
              className="w-full rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2 text-sm font-medium"
            >
              <option value="all">{isVi ? 'Tất cả lối sống' : 'All Lifestyles'}</option>
              {lifestyles.map((l) => (
                <option key={l.id} value={l.slug}>
                  {isVi ? l.nameVi : l.nameEn}
                </option>
              ))}
            </select>
          </div>

          {/* Min Wi-Fi */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-[#53635D]">
              <Wifi className="h-3.5 w-3.5 text-[#164E3F]" />
              {isVi ? 'Tốc độ Wi-Fi tối thiểu' : 'Min Verified Wi-Fi'}
            </label>
            <select
              value={filters.minWifi}
              onChange={(e) => pushFilters({ minWifi: e.target.value })}
              className="w-full rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2 text-sm font-medium"
            >
              <option value="">{isVi ? 'Mọi tốc độ' : 'Any speed'}</option>
              <option value="150">150+ Mbps</option>
              <option value="300">300+ Mbps</option>
              <option value="450">450+ Mbps</option>
            </select>
          </div>

          {/* Booking Model */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-[#53635D]">
              {isVi ? 'Kênh đặt phòng' : 'Booking Channel'}
            </label>
            <select
              value={filters.model}
              onChange={(e) => pushFilters({ model: e.target.value })}
              className="w-full rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2 text-sm font-medium"
            >
              <option value="all">{isVi ? 'Tất cả (Instant + Direct)' : 'All Models'}</option>
              <option value="booking_flow">BookingFlow (Instant Confirm)</option>
              <option value="stay_direct">StayDirect™ (0% Traveler Fee)</option>
            </select>
          </div>

          {/* Remote Work & Stay Features */}
          <div className="space-y-2 border-t border-[#E5DFD3] pt-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-[#53635D]">
              {isVi ? 'Trang bị làm việc & sống' : 'Remote Work & Living'}
            </div>
            {[
              { key: 'monitor', val: filters.monitor, label: isVi ? 'Màn hình 4K ngoài' : 'External 4K Monitor' },
              { key: 'booth', val: filters.booth, label: isVi ? 'Có bốt gọi / họp riêng' : 'Video Call Booths' },
              { key: 'kitchen', val: filters.kitchen, label: isVi ? 'Bếp nấu riêng hoàn chỉnh' : 'Full Private Kitchen' },
              { key: 'laundry', val: filters.laundry, label: isVi ? 'Máy giặt trong căn hộ' : 'In-Unit Laundry' },
              { key: 'pet', val: filters.pet, label: isVi ? 'Thân thiện thú cưng' : 'Pet Friendly' },
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

        {/* Results Grid */}
        <div className="lg:col-span-9">
          {stays.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-[#E5DFD3] bg-white p-12 text-center">
              <h2 className="font-serif-display text-2xl font-semibold text-[#17221E]">
                {isVi ? 'Không có chỗ ở khớp toàn bộ bộ lọc' : 'No stays match every strict filter'}
              </h2>
              <p className="mt-2 text-sm text-[#53635D]">
                {isVi
                  ? 'Hãy nới lỏng tiêu chí màn hình rời hoặc ngày nhận phòng để xem kho phòng đang mở.'
                  : 'Try relaxing the external monitor requirement or shifting your check-in date.'}
              </p>
              <Link
                href="/stays"
                className="mt-5 inline-block rounded-xl bg-[#164E3F] px-5 py-2.5 text-sm font-semibold text-white"
              >
                {isVi ? 'Xem lại tất cả chỗ ở' : 'Show all verified stays'}
              </Link>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              {stays.map((s) => (
                <StayCard
                  key={s.id}
                  stay={s}
                  initialSaved={savedSet.has(s.id)}
                  isAuthenticated={isAuthenticated}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
