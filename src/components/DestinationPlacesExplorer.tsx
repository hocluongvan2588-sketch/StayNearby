'use client';

import { useMemo, useState } from 'react';
import { normalizePlaceExploreGroup, type Locale } from '@/lib/i18n';
import type { LocalDiscoveryPlace } from '@/modules/catalog';
import { LocalPlaceCard } from './LocalPlaceCard';
import { LocalPlaceDetailModal } from './LocalPlaceDetailModal';

const CATEGORY_TABS: Array<{ key: string; labelEn: string; labelVi: string }> = [
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

export function DestinationPlacesExplorer({
  destinationName,
  places,
  locale,
}: {
  destinationName: string;
  places: LocalDiscoveryPlace[];
  locale: Locale;
}) {
  const isVi = locale === 'vi';
  const [selectedGroup, setSelectedGroup] = useState('all');
  const [activePlace, setActivePlace] = useState<LocalDiscoveryPlace | null>(null);

  const availableTabs = useMemo(() => {
    const groupsPresent = new Set(
      places.map((p) => normalizePlaceExploreGroup(p.category))
    );
    return CATEGORY_TABS.filter(
      (tab) => tab.key === 'all' || groupsPresent.has(tab.key)
    );
  }, [places]);

  const filtered = useMemo(() => {
    if (selectedGroup === 'all') return places;
    return places.filter(
      (p) => normalizePlaceExploreGroup(p.category) === selectedGroup
    );
  }, [places, selectedGroup]);

  if (places.length === 0) return null;

  return (
    <section className="pt-12">
      <h2 className="text-2xl font-semibold tracking-tight text-[#17221E]">
        {isVi
          ? `Khám phá địa phương tại ${destinationName}`
          : `Explore local places in ${destinationName}`}
      </h2>

      {availableTabs.length > 2 && (
        <div className="mt-5 flex items-center gap-2 overflow-x-auto pb-2">
          {availableTabs.map((tab) => {
            const active = selectedGroup === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setSelectedGroup(tab.key)}
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

      <div className="mt-6 grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((pl) => (
          <LocalPlaceCard
            key={pl.id}
            place={pl}
            locale={locale}
            onOpen={() => setActivePlace(pl)}
          />
        ))}
      </div>

      {activePlace && (
        <LocalPlaceDetailModal
          place={activePlace}
          locale={locale}
          onClose={() => setActivePlace(null)}
        />
      )}
    </section>
  );
}
