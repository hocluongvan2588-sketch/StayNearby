'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, Clock, MapPin, Search, Wifi } from 'lucide-react';
import { getTodayIsoVietnam, addDaysIso } from '@/lib/dates';
import type { DestinationSummary } from '@/modules/catalog';
import { usePreferences } from './PreferencesProvider';

export function HomeSearchBar({ destinations }: { destinations: DestinationSummary[] }) {
  const router = useRouter();
  const { locale } = usePreferences();
  const isVi = locale === 'vi';

  const defaultCheckIn = addDaysIso(getTodayIsoVietnam(), 7);
  const [destination, setDestination] = useState('all');
  const [checkIn, setCheckIn] = useState(defaultCheckIn);
  const [nights, setNights] = useState('30');
  const [minWifi, setMinWifi] = useState('');

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (destination !== 'all') params.set('destination', destination);
    params.set('nights', nights);
    if (checkIn) params.set('checkIn', checkIn);
    if (minWifi) params.set('minWifi', minWifi);
    router.push(`/stays?${params.toString()}`);
  }

  return (
    <form
      onSubmit={handleSearch}
      className="flex flex-col gap-2 rounded-2xl border border-[#E5DFD3] bg-white p-2 shadow-2xl lg:max-w-5xl lg:flex-row lg:items-center lg:gap-1 lg:rounded-full lg:p-1.5"
    >
      <div className="grid flex-1 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex cursor-pointer flex-col justify-center border-b border-[#E5DFD3] px-4 py-2 transition hover:bg-[#FAF8F3] sm:rounded-tl-xl sm:border-r lg:rounded-full lg:border-b-0 lg:px-5">
          <span className="mb-0.5 flex items-center gap-1.5 whitespace-nowrap text-[11px] font-semibold uppercase tracking-wider text-[#53635D]">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-[#164E3F]" />
            {isVi ? 'Thành phố' : 'Location'}
          </span>
          <select
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            className="w-full cursor-pointer truncate bg-transparent text-sm font-semibold text-[#17221E] outline-none"
          >
            <option value="all">{isVi ? 'Tất cả thành phố' : 'All cities'}</option>
            {destinations.map((d) => (
              <option key={d.id} value={d.slug}>
                {isVi ? d.nameVi : d.nameEn}
              </option>
            ))}
          </select>
        </label>

        <label className="flex cursor-pointer flex-col justify-center border-b border-[#E5DFD3] px-4 py-2 transition hover:bg-[#FAF8F3] sm:rounded-tr-xl lg:rounded-full lg:border-b-0 lg:border-r lg:px-5">
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

        <label className="flex cursor-pointer flex-col justify-center border-b border-[#E5DFD3] px-4 py-2 transition hover:bg-[#FAF8F3] sm:rounded-bl-xl sm:border-b-0 sm:border-r lg:rounded-full lg:px-5">
          <span className="mb-0.5 flex items-center gap-1.5 whitespace-nowrap text-[11px] font-semibold uppercase tracking-wider text-[#53635D]">
            <Clock className="h-3.5 w-3.5 shrink-0 text-[#164E3F]" />
            {isVi ? 'Thời gian ở' : 'Stay length'}
          </span>
          <select
            value={nights}
            onChange={(e) => setNights(e.target.value)}
            className="w-full cursor-pointer truncate bg-transparent text-sm font-semibold text-[#17221E] outline-none"
          >
            <option value="7">{isVi ? '7 đêm (1 tuần)' : '7 nights (1 wk)'}</option>
            <option value="14">{isVi ? '14 đêm (2 tuần)' : '14 nights (2 wks)'}</option>
            <option value="21">{isVi ? '21 đêm (3 tuần)' : '21 nights (3 wks)'}</option>
            <option value="30">{isVi ? '30 đêm (1 tháng)' : '30 nights (1 mo)'}</option>
          </select>
        </label>

        <label className="flex cursor-pointer flex-col justify-center px-4 py-2 transition hover:bg-[#FAF8F3] sm:rounded-br-xl lg:rounded-full lg:px-5">
          <span className="mb-0.5 flex items-center gap-1.5 whitespace-nowrap text-[11px] font-semibold uppercase tracking-wider text-[#53635D]">
            <Wifi className="h-3.5 w-3.5 shrink-0 text-[#164E3F]" />
            {isVi ? 'Wi-Fi tối thiểu' : 'Min Wi-Fi'}
          </span>
          <select
            value={minWifi}
            onChange={(e) => setMinWifi(e.target.value)}
            className="w-full cursor-pointer truncate bg-transparent text-sm font-semibold text-[#17221E] outline-none"
          >
            <option value="">{isVi ? 'Mọi tốc độ' : 'Any speed'}</option>
            <option value="100">100+ Mbps</option>
            <option value="250">250+ Mbps</option>
            <option value="400">400+ Mbps</option>
          </select>
        </label>
      </div>

      <button
        type="submit"
        className="flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-[#164E3F] px-7 py-3.5 text-sm font-semibold text-white shadow-md transition hover:bg-[#0F392E] lg:rounded-full"
      >
        <Search className="h-4 w-4" />
        {isVi ? 'Tìm phòng' : 'Search'}
      </button>
    </form>
  );
}
