'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowRight, MapPin, ShieldCheck, Sun } from 'lucide-react';
import type { DestinationSummary } from '@/modules/catalog';
import { usePreferences } from './PreferencesProvider';

export function VietnamMap({ destinations }: { destinations: DestinationSummary[] }) {
  const { locale } = usePreferences();
  const isVi = locale === 'vi';
  const [selected, setSelected] = useState<DestinationSummary>(destinations[0]);

  return (
    <div className="grid items-center gap-8 rounded-2xl border border-[#E5DFD3] bg-white p-6 sm:p-8 lg:grid-cols-12">
      <div className="relative flex items-center justify-center rounded-2xl bg-[#FAF8F3] p-4 lg:col-span-5">
        <svg viewBox="0 0 100 100" className="h-[340px] w-full max-w-[320px]">
          <defs>
            <linearGradient id="vnLand" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#DCECE5" />
              <stop offset="100%" stopColor="#E9E2D2" />
            </linearGradient>
          </defs>
          <path
            d="M36,7 L53,8 L59,15 L52,22 L47,30 L56,37 L67,44 L73,53 L71,66 L64,74 L51,81 L41,89 L35,84 L41,76 L46,66 L54,53 L56,43 L44,32 L38,24 L31,15 Z"
            fill="url(#vnLand)"
            stroke="#164E3F"
            strokeWidth="0.9"
            strokeLinejoin="round"
          />
          <ellipse
            cx="29.5"
            cy="85"
            rx="2.6"
            ry="3.8"
            fill="#DCECE5"
            stroke="#164E3F"
            strokeWidth="0.8"
          />
          <circle cx="84" cy="44" r="1.1" fill="#164E3F" opacity="0.45" />
          <circle cx="87" cy="46" r="0.8" fill="#164E3F" opacity="0.45" />
          <circle cx="85" cy="76" r="1.1" fill="#164E3F" opacity="0.45" />
          <circle cx="88" cy="79" r="0.9" fill="#164E3F" opacity="0.45" />

          {destinations.map((dest) => {
            const active = selected?.id === dest.id;
            return (
              <g
                key={dest.id}
                className="cursor-pointer"
                onClick={() => setSelected(dest)}
              >
                {active && (
                  <circle
                    cx={dest.mapX}
                    cy={dest.mapY}
                    r="5.5"
                    fill="#C25E28"
                    opacity="0.2"
                  />
                )}
                <circle
                  cx={dest.mapX}
                  cy={dest.mapY}
                  r={active ? 2.6 : 2}
                  fill={active ? '#C25E28' : '#164E3F'}
                  stroke="#FFFFFF"
                  strokeWidth="0.8"
                />
                <text
                  x={dest.mapX + 3.6}
                  y={dest.mapY + 1}
                  fontSize="3.6"
                  fontWeight={active ? '700' : '500'}
                  fill={active ? '#C25E28' : '#17221E'}
                >
                  {isVi ? dest.nameVi : dest.nameEn}
                </text>
              </g>
            );
          })}
        </svg>
        <div className="absolute bottom-3 left-3 rounded-lg bg-white/90 px-2.5 py-1 text-[11px] font-medium text-[#53635D]">
          {isVi ? 'Chọn thành phố trên bản đồ' : 'Click any city to preview'}
        </div>
      </div>

      {selected && (
        <div className="space-y-5 lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="text-xs font-semibold text-[#C25E28]">
                {isVi ? selected.regionVi : selected.regionEn}
              </span>
              <h3 className="mt-0.5 text-2xl font-semibold text-[#17221E] sm:text-3xl">
                {isVi ? selected.nameVi : selected.nameEn}
              </h3>
            </div>
            <span className="rounded-full bg-[#FAF8F3] px-3 py-1 text-xs font-semibold text-[#17221E]">
              {selected.liveStaysCount} {isVi ? 'chỗ ở sẵn sàng' : 'open stays'}
            </span>
          </div>

          <p className="text-sm leading-relaxed text-[#53635D]">
            {isVi ? selected.taglineVi : selected.taglineEn}
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 border-l-2 border-[#E5DFD3] pl-4">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#164E3F]">
                <Sun className="h-4 w-4" />
                {isVi ? 'Thời tiết & Chi phí' : 'Season & Living Cost'}
              </div>
              <div className="text-sm font-semibold text-[#17221E]">
                ~${selected.monthlyCostUsd} / {isVi ? 'tháng sinh hoạt' : 'month average'}
              </div>
              <p className="text-xs leading-relaxed text-[#53635D]">
                {isVi ? selected.climateVi : selected.climateEn}
              </p>
            </div>

            <div className="space-y-1.5 border-l-2 border-[#E5DFD3] pl-4">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#164E3F]">
                <ShieldCheck className="h-4 w-4" />
                {isVi ? 'Thủ tục & Lưu trú' : 'Entry & Stay Tips'}
              </div>
              <div className="text-sm font-semibold text-[#17221E]">
                {isVi ? selected.visaSummaryVi : selected.visaSummaryEn}
              </div>
              <p className="text-xs leading-relaxed text-[#53635D]">
                {isVi ? selected.visaDetailsVi : selected.visaDetailsEn}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Link
              href={`/destinations/${selected.slug}`}
              className="inline-flex items-center gap-2 rounded-xl bg-[#164E3F] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0F392E]"
            >
              {isVi
                ? `Khám phá ${selected.nameVi}`
                : `Explore ${selected.nameEn}`}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href={`/stays?destination=${selected.slug}`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#E5DFD3] bg-white px-4 py-2.5 text-sm font-medium text-[#17221E] hover:bg-[#FAF8F3]"
            >
              <MapPin className="h-3.5 w-3.5 text-[#53635D]" />
              {isVi ? 'Xem phòng trống' : 'View available stays'}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
