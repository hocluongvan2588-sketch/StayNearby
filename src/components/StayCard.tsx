'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  ArrowLeftRight,
  Bookmark,
  CheckCircle2,
  MapPin,
  Monitor,
  Star,
  Utensils,
  Wifi,
  Zap,
} from 'lucide-react';
import {
  formatBusinessModelLabel,
  formatMoneyFromVnd,
  formatPropertyTypeLabel,
  formatVerificationTierLabel,
} from '@/lib/i18n';
import type { StayCardItem } from '@/modules/catalog';
import { usePreferences } from './PreferencesProvider';

export function StayCard({
  stay,
  initialSaved = false,
  isAuthenticated = false,
}: {
  stay: StayCardItem;
  initialSaved?: boolean;
  isAuthenticated?: boolean;
}) {
  const { locale, currency, compareList, toggleCompare } = usePreferences();
  const [saved, setSaved] = useState(initialSaved);
  const [saving, setSaving] = useState(false);

  const isVi = locale === 'vi';
  const isCompared = compareList.some((c) => c.id === stay.id);

  async function handleSaveToggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!isAuthenticated) {
      window.location.assign(`/login?next=/stays/${stay.slug}`);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/saved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stayId: stay.id }),
      });
      const json = await res.json();
      if (json.ok) setSaved(Boolean(json.saved));
    } finally {
      setSaving(false);
    }
  }

  function handleCompareToggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    toggleCompare(stay);
  }

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-[#E5DFD3] bg-white transition duration-300 hover:-translate-y-0.5 hover:border-[#164E3F]/40 lacquer-shadow">
      <Link href={`/stays/${stay.slug}`} className="relative block aspect-[4/3] overflow-hidden bg-[#F2EDE3]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={stay.heroImage}
          alt={isVi ? stay.titleVi : stay.titleEn}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/15" />

        <div className="absolute left-3 right-3 top-3 flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-[#164E3F] px-2.5 py-1 text-xs font-semibold text-white shadow">
              <Wifi className="h-3.5 w-3.5" />
              {stay.wifiDownloadMbps} Mbps
            </span>
            <span
              className={`rounded-full px-2 py-1 text-[10px] font-bold shadow ${
                stay.verificationTier === 'VIETNOMAD_CERTIFIED'
                  ? 'bg-[#0F392E]/90 text-[#9CE3C7] border border-[#9CE3C7]/30'
                  : 'bg-[#FAF8F3]/95 text-[#A67C2E] border border-[#A67C2E]/35'
              }`}
            >
              {formatVerificationTierLabel(stay.verificationTier, locale)}
            </span>
            {stay.dealSavingsPct > 0 && (
              <span className="rounded-full bg-[#C25E28] px-2.5 py-1 text-xs font-semibold text-white shadow">
                {isVi ? `Giảm ${stay.dealSavingsPct}%` : `Save ${stay.dealSavingsPct}%`}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleCompareToggle}
              title={isVi ? 'So sánh' : 'Compare'}
              className={`rounded-full px-2 py-1 text-[11px] font-semibold backdrop-blur-md transition ${
                isCompared
                  ? 'bg-[#A67C2E] text-white'
                  : 'bg-white/90 text-[#17221E] hover:bg-white'
              }`}
            >
              <ArrowLeftRight className="mr-1 inline h-3 w-3" />
              {isCompared ? (isVi ? 'Đã chọn' : 'Added') : isVi ? 'So sánh' : 'Compare'}
            </button>
            <button
              type="button"
              onClick={handleSaveToggle}
              disabled={saving}
              aria-label={isVi ? 'Lưu chỗ ở' : 'Save stay'}
              className={`rounded-full p-1.5 backdrop-blur-md transition ${
                saved ? 'bg-[#C25E28] text-white' : 'bg-white/90 text-[#17221E] hover:bg-white'
              }`}
            >
              <Bookmark className="h-3.5 w-3.5" fill={saved ? 'currentColor' : 'none'} />
            </button>
          </div>
        </div>

        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-xs font-medium text-white">
          <span className="inline-flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 backdrop-blur-sm">
            {stay.businessModel === 'booking_flow' ? (
              <>
                <Zap className="h-3 w-3 text-[#F2D399]" />
                {isVi ? 'Giữ phòng ngay' : 'Instant booking'}
              </>
            ) : (
              <>
                <CheckCircle2 className="h-3 w-3 text-[#9CE3C7]" />
                {formatBusinessModelLabel(stay.businessModel, locale)}
              </>
            )}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-1 backdrop-blur-sm">
            <Star className="h-3 w-3 text-[#F4C15D]" fill="#F4C15D" />
            {stay.googleRating.toFixed(1)} ({stay.googleReviewCount})
          </span>
        </div>
      </Link>

      <div className="flex flex-1 flex-col justify-between p-4">
        <div>
          <div className="mb-1 flex items-center justify-between text-xs text-[#53635D]">
            <span className="inline-flex items-center gap-1 font-medium text-[#164E3F]">
              <MapPin className="h-3.5 w-3.5" />
              {isVi ? stay.destinationNameVi : stay.destinationNameEn}
            </span>
            <span>{formatPropertyTypeLabel(stay.propertyType, locale)}</span>
          </div>

          <Link href={`/stays/${stay.slug}`} className="block">
            <h3 className="font-serif-display text-lg font-semibold leading-snug text-[#17221E] group-hover:text-[#164E3F]">
              {isVi ? stay.titleVi : stay.titleEn}
            </h3>
          </Link>

          <p className="mt-1 line-clamp-2 text-xs text-[#53635D]">
            {isVi ? stay.subtitleVi : stay.subtitleEn}
          </p>

          <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] font-medium text-[#17221E]">
            {stay.hasExternalMonitor && (
              <span className="inline-flex items-center gap-1 rounded-md bg-[#E7F1EC] px-2 py-0.5 text-[#164E3F]">
                <Monitor className="h-3 w-3" /> {isVi ? 'Màn hình 4K' : '4K Monitor'}
              </span>
            )}
            <span className="inline-flex items-center gap-1 rounded-md bg-[#F2EDE3] px-2 py-0.5">
              <Utensils className="h-3 w-3 text-[#53635D]" />
              {stay.kitchenType === 'full'
                ? isVi
                  ? 'Bếp riêng'
                  : 'Full kitchen'
                : isVi
                  ? 'Bếp chung'
                  : 'Shared kitchen'}
            </span>
            {stay.nearestCoworking && (
              <span className="rounded-md bg-[#F2EDE3] px-2 py-0.5 text-[#53635D]">
                {stay.nearestCoworking.distanceKm} km, {stay.nearestCoworking.name}
              </span>
            )}
          </div>
        </div>

        <div className="mt-4 border-t border-[#E5DFD3] pt-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-[#FAF8F3] px-2.5 py-2">
              <div className="text-[11px] text-[#53635D]">
                {isVi ? '1 tuần (7 đêm)' : '1 week (7 nights)'}
              </div>
              <div className="text-sm font-bold text-[#17221E]">
                {formatMoneyFromVnd(stay.weekDisplayVnd, currency)}
              </div>
              <div className="text-[10px] text-[#53635D]">
                {formatMoneyFromVnd(stay.weekNightVnd, currency)}/{isVi ? 'đêm' : 'night'}
              </div>
            </div>

            <div className="rounded-xl border border-[#164E3F]/20 bg-[#E7F1EC]/55 px-2.5 py-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-[#164E3F]">
                  {isVi ? '1 tháng (30 đêm)' : '1 month (30 nights)'}
                </span>
                {stay.stayLongerSavingsPct > 0 && (
                  <span className="rounded bg-[#164E3F] px-1 text-[9px] font-bold text-white">
                    -{stay.stayLongerSavingsPct}%
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-sm font-bold text-[#164E3F]">
                  {formatMoneyFromVnd(stay.monthDisplayVnd, currency)}
                </span>
                {stay.compareMonthDisplayVnd && (
                  <span className="text-[10px] text-[#53635D] line-through">
                    {formatMoneyFromVnd(stay.compareMonthDisplayVnd, currency)}
                  </span>
                )}
              </div>
              <div className="text-[10px] text-[#164E3F]">
                {formatMoneyFromVnd(stay.monthNightVnd, currency)}/{isVi ? 'đêm' : 'night'}
              </div>
            </div>
          </div>

          {stay.businessModel === 'booking_flow' ? (
            <div className="mt-2 rounded-lg bg-[#FAF8F3] px-2.5 py-1.5 text-[11px] font-medium text-[#164E3F]">
              {isVi
                ? `Trả ${formatMoneyFromVnd(stay.monthFeeOnlineVnd, currency)} giữ chỗ hôm nay, trả ${formatMoneyFromVnd(stay.monthPayAtCheckinVnd, currency)} khi nhận phòng`
                : `Pay ${formatMoneyFromVnd(stay.monthFeeOnlineVnd, currency)} today, pay ${formatMoneyFromVnd(stay.monthPayAtCheckinVnd, currency)} at check-in`}
            </div>
          ) : (
            <div className="mt-2 rounded-lg bg-[#FAEDE5]/70 px-2.5 py-1.5 text-[11px] font-medium text-[#C25E28]">
              {isVi
                ? 'Đặt trực tiếp trên website chủ nhà, 0% phí nền tảng'
                : 'Book directly on host website with 0% booking fee'}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
