'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
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
  const { locale, currency } = usePreferences();
  const [saved, setSaved] = useState(initialSaved);
  const [saving, setSaving] = useState(false);

  const isVi = locale === 'vi';
  const minReserveFeeVnd =
    stay.businessModel === 'booking_flow' ? stay.weekFeeOnlineVnd : 0;

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
            <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-[#164E3F] px-2.5 py-1 text-xs font-semibold text-white shadow">
              <Wifi className="h-3.5 w-3.5" />
              {stay.wifiDownloadMbps} Mbps
            </span>
            <span
              className={`whitespace-nowrap rounded-full px-2 py-1 text-[10px] font-bold shadow ${
                stay.verificationTier === 'VIETNOMAD_CERTIFIED'
                  ? 'border border-[#9CE3C7]/30 bg-[#0F392E]/90 text-[#9CE3C7]'
                  : 'border border-[#A67C2E]/35 bg-[#FAF8F3]/95 text-[#A67C2E]'
              }`}
            >
              {formatVerificationTierLabel(stay.verificationTier, locale)}
            </span>
            {stay.dealSavingsPct > 0 && (
              <span className="whitespace-nowrap rounded-full bg-[#C25E28] px-2.5 py-1 text-xs font-semibold text-white shadow">
                {isVi ? `Giảm ${stay.dealSavingsPct}%` : `Save ${stay.dealSavingsPct}%`}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={handleSaveToggle}
            disabled={saving}
            title={isVi ? 'Lưu chỗ ở' : 'Save stay'}
            aria-label={isVi ? 'Lưu chỗ ở' : 'Save stay'}
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full backdrop-blur-md transition ${
              saved ? 'bg-[#C25E28] text-white' : 'bg-white/90 text-[#17221E] hover:bg-white'
            }`}
          >
            <Bookmark className="h-3.5 w-3.5" fill={saved ? 'currentColor' : 'none'} />
          </button>
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
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              {isVi ? stay.destinationNameVi : stay.destinationNameEn}
            </span>
            <span className="truncate">{formatPropertyTypeLabel(stay.propertyType, locale)}</span>
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
              <span className="max-w-full truncate rounded-md bg-[#F2EDE3] px-2 py-0.5 text-[#53635D]">
                {stay.nearestCoworking.distanceKm} km, {stay.nearestCoworking.name}
              </span>
            )}
          </div>
        </div>

        <Link
          href={`/stays/${stay.slug}`}
          className="mt-4 block rounded-xl border border-[#164E3F]/15 bg-[#E7F1EC]/65 px-3.5 py-2.5 text-xs font-medium text-[#164E3F] transition group-hover:bg-[#E7F1EC]"
        >
          {isVi ? (
            <>
              Trả{' '}
              <span className="text-sm font-bold text-[#0F392E]">
                {formatMoneyFromVnd(minReserveFeeVnd, currency)}
              </span>{' '}
              để giữ chỗ hôm nay
            </>
          ) : (
            <>
              Pay{' '}
              <span className="text-sm font-bold text-[#0F392E]">
                {formatMoneyFromVnd(minReserveFeeVnd, currency)}
              </span>{' '}
              to reserve today
            </>
          )}
        </Link>
      </div>
    </article>
  );
}
