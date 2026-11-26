'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { normalizePlaceExploreGroup, type Locale } from '@/lib/i18n';
import type { CoworkingSpot, LocalDiscoveryPlace } from '@/modules/catalog';
import { LocalPlaceCard } from './LocalPlaceCard';

const CATEGORY_TABS: Array<{
  key: string;
  labelEn: string;
  labelVi: string;
}> = [
  { key: 'all', labelEn: 'All places', labelVi: 'Tất cả' },
  { key: 'food', labelEn: 'Food & Restaurants', labelVi: 'Ẩm thực & Nhà hàng' },
  { key: 'coffee', labelEn: 'Coffee & Cafés', labelVi: 'Cà phê' },
  { key: 'attractions', labelEn: 'Attractions', labelVi: 'Điểm tham quan' },
  { key: 'experiences', labelEn: 'Local Experiences', labelVi: 'Trải nghiệm bản địa' },
  { key: 'things_to_do', labelEn: 'Things to Do', labelVi: 'Hoạt động' },
  { key: 'entertainment', labelEn: 'Entertainment', labelVi: 'Giải trí' },
  { key: 'shopping', labelEn: 'Shopping', labelVi: 'Mua sắm' },
  { key: 'wellness', labelEn: 'Wellness & Fitness', labelVi: 'Sức khỏe & Thể thao' },
  { key: 'coworking', labelEn: 'Coworking', labelVi: 'Coworking' },
  { key: 'essentials', labelEn: 'Daily Essentials', labelVi: 'Tiện ích thiết yếu' },
];

export function StayNeighborhoodExplore({
  destinationSlug,
  destinationName,
  neighborhoodName,
  localPlaces,
  nearbyCoworking,
  locale,
}: {
  destinationSlug: string;
  destinationName: string;
  neighborhoodName: string;
  localPlaces: LocalDiscoveryPlace[];
  nearbyCoworking: CoworkingSpot[];
  locale: Locale;
}) {
  const isVi = locale === 'vi';
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [showAll, setShowAll] = useState(false);

  const combinedPlaces = useMemo<LocalDiscoveryPlace[]>(() => {
    const base = [...localPlaces];
    const existingNames = new Set(base.map((p) => p.name.toLowerCase().trim()));

    nearbyCoworking.forEach((cw, idx) => {
      const normalized = cw.name.toLowerCase().trim();
      if (!normalized || existingNames.has(normalized)) return;
      // Avoid near-duplicates like "Enouvo Space" vs "Enouvo Space — An Thuong"
      const duplicatePrefix = base.some(
        (p) =>
          p.name.toLowerCase().includes(normalized) ||
          normalized.includes(p.name.toLowerCase())
      );
      if (duplicatePrefix) return;

      base.push({
        id: `cw-spot-${idx}`,
        slug: `coworking-${idx}`,
        name: cw.name,
        category: 'coworking',
        address: neighborhoodName || destinationName,
        lat: null,
        lng: null,
        priceRange: cw.dayPassVnd === 0 ? (isVi ? 'Miễn phí' : 'Free') : '$$',
        openingHours: '',
        descriptionEn: cw.noteEn,
        descriptionVi: cw.noteVi,
        imageUrl: '/images/workspaces/vietnam-coworking-lounge.jpg',
        neighborhoodNameEn: neighborhoodName || null,
        neighborhoodNameVi: neighborhoodName || null,
        verificationStatus: 'verified',
        distanceLabel: `${cw.distanceKm} km`,
        rating: null,
        reviewCount: null,
      });
    });

    return base;
  }, [destinationName, isVi, localPlaces, nearbyCoworking, neighborhoodName]);

  const availableTabs = useMemo(() => {
    const groupsPresent = new Set(
      combinedPlaces.map((p) => normalizePlaceExploreGroup(p.category))
    );
    return CATEGORY_TABS.filter(
      (tab) => tab.key === 'all' || groupsPresent.has(tab.key)
    );
  }, [combinedPlaces]);

  const filtered = useMemo(() => {
    if (selectedGroup === 'all') return combinedPlaces;
    return combinedPlaces.filter(
      (p) => normalizePlaceExploreGroup(p.category) === selectedGroup
    );
  }, [combinedPlaces, selectedGroup]);

  if (combinedPlaces.length === 0) return null;

  const visiblePlaces = showAll ? filtered : filtered.slice(0, 6);

  return (
    <section className="py-10">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-[22px] font-semibold tracking-tight text-[#17221E] sm:text-[24px]">
            {isVi ? 'Khám phá quanh khu vực' : 'Explore the neighborhood'}
          </h2>
          <p className="mt-1 text-sm text-[#53635D]">
            {isVi
              ? `Ẩm thực, quán cà phê, điểm tham quan và nhịp sống địa phương quanh ${neighborhoodName || destinationName}.`
              : `Dining, cafés, sights, and daily essentials around ${neighborhoodName || destinationName}.`}
          </p>
        </div>

        <Link
          href={`/destinations/${destinationSlug}`}
          className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-[#164E3F] hover:underline"
        >
          {isVi ? `Cẩm nang ${destinationName}` : `Explore ${destinationName}`}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {/* Category Filter Tabs */}
      {availableTabs.length > 2 && (
        <div className="mt-5 flex items-center gap-2 overflow-x-auto pb-2">
          {availableTabs.map((tab) => {
            const active = selectedGroup === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  setSelectedGroup(tab.key);
                  setShowAll(false);
                }}
                className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-semibold transition ${
                  active
                    ? 'bg-[#17221E] text-white'
                    : 'border border-[#E5DFD3] bg-white text-[#53635D] hover:border-[#17221E]/40 hover:text-[#17221E]'
                }`}
              >
                {isVi ? tab.labelVi : tab.labelEn}
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {visiblePlaces.map((pl) => (
          <LocalPlaceCard key={pl.id} place={pl} locale={locale} />
        ))}
      </div>

      {filtered.length > 6 && (
        <div className="mt-6">
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="inline-flex items-center justify-center rounded-xl border border-[#17221E] bg-white px-5 py-2.5 text-sm font-semibold text-[#17221E] transition hover:bg-[#FAF8F3]"
          >
            {showAll
              ? isVi
                ? 'Thu gọn danh sách'
                : 'Show fewer places'
              : isVi
                ? `Xem thêm ${filtered.length - 6} địa điểm`
                : `Show all ${filtered.length} places`}
          </button>
        </div>
      )}
    </section>
  );
}
