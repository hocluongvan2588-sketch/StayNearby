'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, Compass, Search, Wifi } from 'lucide-react';
import { getTodayIsoVietnam, addDaysIso } from '@/lib/dates';
import type { DestinationSummary } from '@/modules/catalog';
import { usePreferences } from './PreferencesProvider';

export function HomeSearchBar({ destinations }: { destinations: DestinationSummary[] }) {
  const router = useRouter();
  const { locale } = usePreferences();
  const isVi = locale === 'vi';

  const defaultCheckIn = addDaysIso(getTodayIsoVietnam(), 7);
  const [destination, setDestination] = useState('all');
  const [nights, setNights] = useState('30');
  const [checkIn, setCheckIn] = useState(defaultCheckIn);
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
      className="grid gap-3 rounded-2xl border border-[#E5DFD3] bg-white/95 p-3 shadow-2xl backdrop-blur-md sm:grid-cols-2 lg:grid-cols-12"
    >
      <label className="flex flex-col justify-center rounded-xl bg-[#FAF8F3] px-3.5 py-2.5 lg:col-span-3">
        <span className="mb-0.5 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-[#53635D]">
          <Compass className="h-3.5 w-3.5 text-[#164E3F]" />
          {isVi ? 'Điểm đến Việt Nam' : 'Vietnam Hub'}
        </span>
        <select
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          className="bg-transparent text-sm font-semibold text-[#17221E] outline-none"
        >
          <option value="all">{isVi ? 'Tất cả 6 thành phố' : 'Anywhere in Vietnam'}</option>
          {destinations.map((d) => (
            <option key={d.id} value={d.slug}>
              {isVi ? d.nameVi : d.nameEn} (~{d.avgWifiMbps} Mbps)
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col justify-center rounded-xl bg-[#FAF8F3] px-3.5 py-2.5 lg:col-span-3">
        <span className="mb-0.5 text-[11px] font-semibold uppercase tracking-wider text-[#53635D]">
          {isVi ? 'Thời lượng lưu trú (tối thiểu 7 đêm)' : 'Length of Stay (7N min)'}
        </span>
        <select
          value={nights}
          onChange={(e) => setNights(e.target.value)}
          className="bg-transparent text-sm font-semibold text-[#17221E] outline-none"
        >
          <option value="7">{isVi ? '1 tuần (7 đêm)' : '1 week (7 nights)'}</option>
          <option value="14">{isVi ? '2 tuần (14 đêm)' : '2 weeks (14 nights)'}</option>
          <option value="21">{isVi ? '3 tuần (21 đêm)' : '3 weeks (21 nights)'}</option>
          <option value="30">{isVi ? '1 tháng (30 đêm) — Giá tốt nhất' : '1 month (30 nights) — Best value'}</option>
        </select>
      </label>

      <label className="flex flex-col justify-center rounded-xl bg-[#FAF8F3] px-3.5 py-2.5 lg:col-span-2">
        <span className="mb-0.5 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-[#53635D]">
          <Calendar className="h-3.5 w-3.5 text-[#164E3F]" />
          {isVi ? 'Ngày nhận phòng' : 'Check-in'}
        </span>
        <input
          type="date"
          value={checkIn}
          min={getTodayIsoVietnam()}
          onChange={(e) => setCheckIn(e.target.value)}
          className="bg-transparent text-sm font-semibold text-[#17221E] outline-none"
        />
      </label>

      <label className="flex flex-col justify-center rounded-xl bg-[#FAF8F3] px-3.5 py-2.5 lg:col-span-2">
        <span className="mb-0.5 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-[#53635D]">
          <Wifi className="h-3.5 w-3.5 text-[#164E3F]" />
          {isVi ? 'Wi-Fi tối thiểu' : 'Min Tested Wi-Fi'}
        </span>
        <select
          value={minWifi}
          onChange={(e) => setMinWifi(e.target.value)}
          className="bg-transparent text-sm font-semibold text-[#17221E] outline-none"
        >
          <option value="">{isVi ? 'Mọi tốc độ đã kiểm định' : 'Any verified speed'}</option>
          <option value="100">100+ Mbps</option>
          <option value="250">250+ Mbps</option>
          <option value="400">400+ Mbps Fiber</option>
        </select>
      </label>

      <button
        type="submit"
        className="flex items-center justify-center gap-2 rounded-xl bg-[#164E3F] px-5 py-3 text-sm font-semibold text-white shadow transition hover:bg-[#0F392E] sm:col-span-2 lg:col-span-2"
      >
        <Search className="h-4 w-4" />
        {isVi ? 'Xem chỗ ở' : 'Show Stays'}
      </button>
    </form>
  );
}
