'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, Clock, Compass, MapPin, Search } from 'lucide-react';
import {
  MAX_NIGHTS,
  STAY_PACKAGE_TIERS,
  clampStayNights,
} from '@/lib/business-rules';
import { addDaysIso, getTodayIsoVietnam } from '@/lib/dates';
import type { DestinationSummary, LifestyleItem } from '@/modules/catalog';
import { usePreferences } from './PreferencesProvider';

export function HomeSearchBar({
  destinations,
  lifestyles = [],
}: {
  destinations: DestinationSummary[];
  lifestyles?: LifestyleItem[];
}) {
  const router = useRouter();
  const { locale, platformConfig } = usePreferences();
  const isVi = locale === 'vi';
  const minNights = platformConfig.defaultMinNights;

  const defaultCheckIn = addDaysIso(getTodayIsoVietnam(), 7);
  const [destination, setDestination] = useState('all');
  const [checkIn, setCheckIn] = useState(defaultCheckIn);
  const [nights, setNights] = useState('14');
  const [customNights, setCustomNights] = useState(() => String(minNights));
  const [lifestyle, setLifestyle] = useState('all');

  // Quick picks come from shared Business Rules, filtered by the platform minimum.
  const tierOptions = STAY_PACKAGE_TIERS.filter((n) => n >= minNights);
  const showCustomInput = nights === 'custom' || tierOptions.length === 0;
  const selectValue =
    tierOptions.length === 0 || nights === 'custom'
      ? 'custom'
      : tierOptions.some((t) => t === Number(nights))
        ? nights
        : String(tierOptions[0]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (destination !== 'all') params.set('destination', destination);
    if (lifestyle !== 'all') params.set('lifestyle', lifestyle);
    const rawNights =
      selectValue === 'custom' ? Number(customNights) : Number(selectValue);
    params.set('nights', String(clampStayNights(rawNights || minNights, minNights)));
    if (checkIn) params.set('checkIn', checkIn);
    router.push(`/stays?${params.toString()}`);
  }

  return (
    <form
      onSubmit={handleSearch}
      className="flex flex-col gap-2 rounded-2xl border border-[#E5DFD3] bg-white p-2 shadow-xl lg:max-w-5xl lg:flex-row lg:items-center lg:gap-1 lg:rounded-full lg:p-1.5"
    >
      <div className="grid flex-1 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex cursor-pointer flex-col justify-center border-b border-[#E5DFD3] px-4 py-2.5 transition hover:bg-[#FAF8F3] sm:rounded-tl-xl sm:border-r lg:rounded-full lg:border-b-0 lg:px-5">
          <span className="mb-0.5 flex items-center gap-1.5 whitespace-nowrap text-[11px] font-semibold uppercase tracking-wider text-[#53635D]">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-[#164E3F]" />
            {isVi ? 'Điểm đến' : 'Destination'}
          </span>
          <select
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            className="w-full cursor-pointer truncate bg-transparent text-sm font-semibold text-[#17221E] outline-none"
          >
            <option value="all">{isVi ? 'Khắp Việt Nam' : 'Anywhere in Vietnam'}</option>
            {destinations.map((d) => (
              <option key={d.id} value={d.slug}>
                {isVi ? d.nameVi : d.nameEn}
              </option>
            ))}
          </select>
        </label>

        <label className="flex cursor-pointer flex-col justify-center border-b border-[#E5DFD3] px-4 py-2.5 transition hover:bg-[#FAF8F3] sm:rounded-tr-xl lg:rounded-full lg:border-b-0 lg:border-r lg:px-5">
          <span className="mb-0.5 flex items-center gap-1.5 whitespace-nowrap text-[11px] font-semibold uppercase tracking-wider text-[#53635D]">
            <Calendar className="h-3.5 w-3.5 shrink-0 text-[#164E3F]" />
            {isVi ? 'Nhận phòng' : 'Check-in'}
          </span>
          <input
            type="date"
            value={checkIn}
            min={getTodayIsoVietnam()}
            onChange={(e) => setCheckIn(e.target.value)}
            className="w-full cursor-pointer bg-transparent text-sm font-semibold text-[#17221E] outline-none"
          />
        </label>

        <label className="flex cursor-pointer flex-col justify-center border-b border-[#E5DFD3] px-4 py-2.5 transition hover:bg-[#FAF8F3] sm:rounded-bl-xl sm:border-b-0 sm:border-r lg:rounded-full lg:px-5">
          <span className="mb-0.5 flex items-center gap-1.5 whitespace-nowrap text-[11px] font-semibold uppercase tracking-wider text-[#53635D]">
            <Clock className="h-3.5 w-3.5 shrink-0 text-[#164E3F]" />
            {isVi ? 'Thời gian lưu trú' : 'Stay length'}
          </span>
          {tierOptions.length > 0 && (
            <select
              value={selectValue}
              onChange={(e) => setNights(e.target.value)}
              className="w-full cursor-pointer truncate bg-transparent text-sm font-semibold text-[#17221E] outline-none"
            >
              {tierOptions.map((n) => (
                <option key={n} value={String(n)}>
                  {n === 30
                    ? isVi
                      ? '1 tháng (30 đêm)'
                      : '1 month (30 nights)'
                    : isVi
                      ? `${n / 7} tuần (${n} đêm)`
                      : `${n / 7} ${n === 7 ? 'week' : 'weeks'} (${n} nights)`}
                </option>
              ))}
              <option value="custom">
                {isVi ? 'Tùy chỉnh (đêm)' : 'Custom (nights)'}
              </option>
            </select>
          )}
          {showCustomInput && (
            <input
              type="number"
              inputMode="numeric"
              min={minNights}
              max={MAX_NIGHTS}
              value={customNights}
              onChange={(e) => setCustomNights(e.target.value)}
              placeholder={isVi ? `Tối thiểu ${minNights} đêm` : `Min ${minNights} nights`}
              className="w-full bg-transparent text-sm font-semibold text-[#17221E] outline-none placeholder:font-normal placeholder:text-[#8A9691]"
              aria-label={isVi ? 'Số đêm tùy chỉnh' : 'Custom nights'}
            />
          )}
        </label>

        <label className="flex cursor-pointer flex-col justify-center px-4 py-2.5 transition hover:bg-[#FAF8F3] sm:rounded-br-xl lg:rounded-full lg:px-5">
          <span className="mb-0.5 flex items-center gap-1.5 whitespace-nowrap text-[11px] font-semibold uppercase tracking-wider text-[#53635D]">
            <Compass className="h-3.5 w-3.5 shrink-0 text-[#164E3F]" />
            {isVi ? 'Phong cách' : 'Travel style'}
          </span>
          <select
            value={lifestyle}
            onChange={(e) => setLifestyle(e.target.value)}
            className="w-full cursor-pointer truncate bg-transparent text-sm font-semibold text-[#17221E] outline-none"
          >
            <option value="all">{isVi ? 'Mọi phong cách' : 'Any experience'}</option>
            {lifestyles.map((l) => (
              <option key={l.id} value={l.slug}>
                {isVi ? l.nameVi : l.nameEn}
              </option>
            ))}
          </select>
        </label>
      </div>

      <button
        type="submit"
        className="flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-[#164E3F] px-7 py-3.5 text-sm font-semibold text-white shadow-md transition hover:bg-[#0F392E] lg:rounded-full"
      >
        <Search className="h-4 w-4" />
        {isVi ? 'Tìm chỗ ở' : 'Search stays'}
      </button>
    </form>
  );
}
