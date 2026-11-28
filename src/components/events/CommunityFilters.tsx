'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import type { Locale } from '@/lib/i18n';
import type { EventTaxonomy } from '@/modules/platform-settings';

interface CityOption {
  id: string;
  nameEn: string;
  nameVi: string;
}

/**
 * Event filter bar for /community (spec §3): city, time window, price,
 * organizing language, category. Writes straight to the URL (server-rendered
 * results) — a plain row of selects, no card wrapper.
 */
export function CommunityFilters({
  cities,
  taxonomy,
  locale,
}: {
  cities: CityOption[];
  taxonomy: EventTaxonomy;
  locale: Locale;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const isVi = locale === 'vi';

  const current = {
    destination: params.get('destination') ?? '',
    when: params.get('when') ?? '',
    price: params.get('price') ?? '',
    language: params.get('language') ?? '',
    category: params.get('category') ?? '',
  };

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    const qs = next.toString();
    router.replace(qs ? `/community?${qs}` : '/community');
  }

  const selectClass =
    'h-10 w-full rounded-lg border border-[#E5DFD3] bg-white px-3 text-sm font-medium text-[#17221E] focus:border-[#164E3F] focus:outline-none';

  const label = (text: string) => (
    <span className="mb-1 block text-xs font-semibold text-[#53635D]">{text}</span>
  );

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="w-[11rem]">
        {label(isVi ? 'Thành phố' : 'City')}
        <select
          className={selectClass}
          value={current.destination}
          onChange={(e) => update('destination', e.target.value)}
        >
          <option value="">{isVi ? 'Tất cả thành phố' : 'All cities'}</option>
          {cities.map((c) => (
            <option key={c.id} value={c.id}>
              {isVi ? c.nameVi : c.nameEn}
            </option>
          ))}
        </select>
      </div>

      <div className="w-[10rem]">
        {label(isVi ? 'Thời gian' : 'When')}
        <select
          className={selectClass}
          value={current.when}
          onChange={(e) => update('when', e.target.value)}
        >
          <option value="upcoming">{isVi ? 'Sắp tới' : 'Upcoming'}</option>
          <option value="today">{isVi ? 'Hôm nay' : 'Today'}</option>
          <option value="weekend">{isVi ? 'Cuối tuần này' : 'This weekend'}</option>
        </select>
      </div>

      <div className="w-[9rem]">
        {label(isVi ? 'Chi phí' : 'Price')}
        <select
          className={selectClass}
          value={current.price}
          onChange={(e) => update('price', e.target.value)}
        >
          <option value="">{isVi ? 'Miễn phí & có phí' : 'Free & paid'}</option>
          <option value="free">{isVi ? 'Miễn phí' : 'Free'}</option>
          <option value="paid">{isVi ? 'Có phí' : 'Paid'}</option>
        </select>
      </div>

      <div className="w-[10rem]">
        {label(isVi ? 'Ngôn ngữ' : 'Language')}
        <select
          className={selectClass}
          value={current.language}
          onChange={(e) => update('language', e.target.value)}
        >
          <option value="">{isVi ? 'Tất cả' : 'Any'}</option>
          {taxonomy.languages.map((l) => (
            <option key={l.slug} value={l.slug}>
              {isVi ? l.nameVi : l.nameEn}
            </option>
          ))}
        </select>
      </div>

      <div className="w-[12rem]">
        {label(isVi ? 'Danh mục' : 'Category')}
        <select
          className={selectClass}
          value={current.category}
          onChange={(e) => update('category', e.target.value)}
        >
          <option value="">{isVi ? 'Tất cả danh mục' : 'All categories'}</option>
          {taxonomy.categories.map((c) => (
            <option key={c.slug} value={c.slug}>
              {isVi ? c.nameVi : c.nameEn}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
