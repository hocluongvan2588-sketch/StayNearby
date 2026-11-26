'use client';

import { useMemo, useState } from 'react';
import { normalizePlaceExploreGroup, type Locale } from '@/lib/i18n';
import type { LocalDiscoveryPlace } from '@/modules/catalog';
import { LocalPlaceCard } from './LocalPlaceCard';

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
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-[#17221E]">
            {isVi
              ? `Khám phá địa phương tại ${destinationName}`
              : `Explore local places in ${destinationName}`}
          </h2>
          <p className="mt-1 text-sm text-[#53635D]">
            {isVi
              ? 'Quán ăn ngon, quán cà phê, điểm tham quan, không gian sáng tạo và tiện ích hàng ngày.'
              : 'Dining, cafés, cultural sights, wellness spots, coworking, and daily essentials.'}
          </p>
        </div>
        <span className="text-xs font-medium text-[#53635D]">
          {filtered.length} {isVi ? 'địa điểm' : 'places'}
        </span>
      </div>

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

      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((pl) => (
          <LocalPlaceCard key={pl.id} place={pl} locale={locale} />
        ))}
      </div>
    </section>
  );
}
