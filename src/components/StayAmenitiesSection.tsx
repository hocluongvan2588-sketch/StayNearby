'use client';

import { useMemo, useState } from 'react';
import {
  Accessibility,
  Building2,
  Car,
  Check,
  Coffee,
  KeyRound,
  Laptop,
  Monitor,
  PawPrint,
  Shirt,
  Sun,
  Tv,
  Utensils,
  Waves,
  Wifi,
  Wind,
  X,
} from 'lucide-react';
import {
  formatKitchenTypeLabel,
  formatLaundryTypeLabel,
  type Locale,
} from '@/lib/i18n';

interface AmenityDisplayItem {
  key: string;
  label: string;
  group: 'living' | 'connectivity' | 'access';
  iconName:
    | 'kitchen'
    | 'laundry'
    | 'wifi'
    | 'desk'
    | 'monitor'
    | 'pet'
    | 'wheelchair'
    | 'ac'
    | 'sun'
    | 'pool'
    | 'elevator'
    | 'tv'
    | 'coffee'
    | 'key'
    | 'car'
    | 'check';
}

function AmenityIcon({ name }: { name: AmenityDisplayItem['iconName'] }) {
  const cls = 'h-5 w-5 shrink-0 text-[#17221E] stroke-[1.6]';
  switch (name) {
    case 'kitchen':
      return <Utensils className={cls} />;
    case 'laundry':
      return <Shirt className={cls} />;
    case 'wifi':
      return <Wifi className={cls} />;
    case 'desk':
      return <Laptop className={cls} />;
    case 'monitor':
      return <Monitor className={cls} />;
    case 'pet':
      return <PawPrint className={cls} />;
    case 'wheelchair':
      return <Accessibility className={cls} />;
    case 'ac':
      return <Wind className={cls} />;
    case 'sun':
      return <Sun className={cls} />;
    case 'pool':
      return <Waves className={cls} />;
    case 'elevator':
      return <Building2 className={cls} />;
    case 'tv':
      return <Tv className={cls} />;
    case 'coffee':
      return <Coffee className={cls} />;
    case 'key':
      return <KeyRound className={cls} />;
    case 'car':
      return <Car className={cls} />;
    default:
      return <Check className={cls} />;
  }
}

function inferIconAndGroup(text: string): {
  iconName: AmenityDisplayItem['iconName'];
  group: AmenityDisplayItem['group'];
} {
  const lower = text.toLowerCase();
  if (lower.includes('kitchen') || lower.includes('bếp') || lower.includes('cook')) {
    return { iconName: 'kitchen', group: 'living' };
  }
  if (lower.includes('wash') || lower.includes('laundry') || lower.includes('giặt')) {
    return { iconName: 'laundry', group: 'living' };
  }
  if (lower.includes('wi-fi') || lower.includes('wifi') || lower.includes('fiber') || lower.includes('internet')) {
    return { iconName: 'wifi', group: 'connectivity' };
  }
  if (lower.includes('monitor') || lower.includes('màn hình')) {
    return { iconName: 'monitor', group: 'connectivity' };
  }
  if (lower.includes('desk') || lower.includes('workspace') || lower.includes('chair') || lower.includes('bàn')) {
    return { iconName: 'desk', group: 'connectivity' };
  }
  if (lower.includes('pet') || lower.includes('thú cưng')) {
    return { iconName: 'pet', group: 'access' };
  }
  if (lower.includes('wheelchair') || lower.includes('xe lăn')) {
    return { iconName: 'wheelchair', group: 'access' };
  }
  if (lower.includes('ac') || lower.includes('air') || lower.includes('điều hòa')) {
    return { iconName: 'ac', group: 'living' };
  }
  if (lower.includes('balcony') || lower.includes('terrace') || lower.includes('ban công') || lower.includes('garden') || lower.includes('vườn')) {
    return { iconName: 'sun', group: 'living' };
  }
  if (lower.includes('pool') || lower.includes('hồ bơi') || lower.includes('beach')) {
    return { iconName: 'pool', group: 'living' };
  }
  if (lower.includes('elevator') || lower.includes('lift') || lower.includes('thang máy')) {
    return { iconName: 'elevator', group: 'access' };
  }
  if (lower.includes('tv')) {
    return { iconName: 'tv', group: 'living' };
  }
  if (lower.includes('coffee') || lower.includes('espresso') || lower.includes('cà phê')) {
    return { iconName: 'coffee', group: 'living' };
  }
  if (lower.includes('lock') || lower.includes('key') || lower.includes('khóa') || lower.includes('check-in')) {
    return { iconName: 'key', group: 'access' };
  }
  if (lower.includes('park') || lower.includes('đỗ xe')) {
    return { iconName: 'car', group: 'access' };
  }
  return { iconName: 'check', group: 'living' };
}

export function StayAmenitiesSection({
  amenities,
  kitchenType,
  laundryType,
  petFriendly,
  wheelchairFriendly,
  hasWorkspace,
  hasErgonomicChair,
  hasExternalMonitor,
  wifiHasService,
  wifiDownloadMbps,
  locale,
}: {
  amenities: string[];
  kitchenType: string;
  laundryType: string;
  petFriendly: boolean;
  wheelchairFriendly: boolean;
  hasWorkspace: boolean;
  hasErgonomicChair: boolean;
  hasExternalMonitor: boolean;
  wifiHasService: boolean | null;
  wifiDownloadMbps: number | null;
  locale: Locale;
}) {
  const isVi = locale === 'vi';
  const [modalOpen, setModalOpen] = useState(false);

  const items = useMemo<AmenityDisplayItem[]>(() => {
    const list: AmenityDisplayItem[] = [];
    const seen = new Set<string>();

    const pushItem = (item: AmenityDisplayItem) => {
      // Normalize so "Wi-Fi", "WiFi" and " wi fi " count as one amenity.
      const normalized = item.label.toLowerCase().replace(/[^a-z0-9]+/g, '');
      if (!normalized || seen.has(normalized)) return;
      seen.add(normalized);
      list.push(item);
    };

    if (kitchenType && kitchenType !== 'none') {
      pushItem({
        key: 'kitchen',
        label: formatKitchenTypeLabel(kitchenType, locale),
        group: 'living',
        iconName: 'kitchen',
      });
    }
    if (laundryType && laundryType !== 'none') {
      pushItem({
        key: 'laundry',
        label: formatLaundryTypeLabel(laundryType, locale),
        group: 'living',
        iconName: 'laundry',
      });
    }
    // Amenities section lists plain "Wi-Fi" — the speed figure lives only in
    // the Workspace & Internet section.
    const wifiKnown =
      wifiHasService === true ||
      (wifiHasService !== false && wifiDownloadMbps !== null && wifiDownloadMbps > 0);
    const hasWifiItem = wifiKnown;
    if (wifiKnown) {
      pushItem({
        key: 'wifi',
        label: 'Wi-Fi',
        group: 'connectivity',
        iconName: 'wifi',
      });
    }
    if (hasWorkspace) {
      pushItem({
        key: 'workspace',
        label: isVi ? 'Bàn làm việc riêng' : 'Dedicated workspace',
        group: 'connectivity',
        iconName: 'desk',
      });
    }
    if (hasErgonomicChair) {
      pushItem({
        key: 'chair',
        label: isVi ? 'Ghế công thái học' : 'Ergonomic chair',
        group: 'connectivity',
        iconName: 'desk',
      });
    }
    if (hasExternalMonitor) {
      pushItem({
        key: 'monitor',
        label: isVi ? 'Màn hình ngoài' : 'External monitor',
        group: 'connectivity',
        iconName: 'monitor',
      });
    }
    if (petFriendly) {
      pushItem({
        key: 'pet',
        label: isVi ? 'Cho phép mang theo thú cưng' : 'Pets allowed',
        group: 'access',
        iconName: 'pet',
      });
    }
    if (wheelchairFriendly) {
      pushItem({
        key: 'wheelchair',
        label: isVi ? 'Lối đi thuận tiện cho xe lăn' : 'Step-free / wheelchair access',
        group: 'access',
        iconName: 'wheelchair',
      });
    }

    amenities.forEach((raw, idx) => {
      const clean = raw.trim();
      if (!clean) return;
      // Avoid duplicating structured kitchen/laundry/desk/wifi entries
      const lower = clean.toLowerCase();
      if (
        (lower === 'kitchen' && kitchenType !== 'none') ||
        (lower === 'dedicated workspace' && hasWorkspace) ||
        (lower === 'external monitor' && hasExternalMonitor) ||
        (lower === 'ergonomic chair' && hasErgonomicChair) ||
        (hasWifiItem &&
          (lower === 'wi-fi' ||
            lower === 'wifi' ||
            lower === 'internet' ||
            lower === 'wi fi'))
      ) {
        return;
      }
      const { iconName, group } = inferIconAndGroup(clean);
      pushItem({
        key: `custom-${idx}`,
        label: clean,
        group,
        iconName,
      });
    });

    return list;
  }, [
    amenities,
    hasErgonomicChair,
    hasExternalMonitor,
    hasWorkspace,
    isVi,
    kitchenType,
    laundryType,
    locale,
    petFriendly,
    wheelchairFriendly,
    wifiHasService,
    wifiDownloadMbps,
  ]);

  if (items.length === 0) return null;

  const previewItems = items.slice(0, 8);
  const hasMore = items.length > 8;

  const grouped = {
    living: items.filter((i) => i.group === 'living'),
    connectivity: items.filter((i) => i.group === 'connectivity'),
    access: items.filter((i) => i.group === 'access'),
  };

  return (
    <section className="py-8">
      <h2 className="text-[22px] font-semibold tracking-tight text-[#17221E]">
        {isVi ? 'Nơi này có những gì cho bạn' : 'What this place offers'}
      </h2>

      <div className="mt-5 grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
        {previewItems.map((item) => (
          <div key={item.key} className="flex items-center gap-3.5 text-[15px] text-[#17221E]">
            <AmenityIcon name={item.iconName} />
            <span>{item.label}</span>
          </div>
        ))}
      </div>

      {hasMore && (
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="mt-6 inline-flex items-center justify-center rounded-xl border border-[#17221E] bg-white px-5 py-2.5 text-sm font-semibold text-[#17221E] transition hover:bg-[#FAF8F3]"
        >
          {isVi
            ? `Hiển thị tất cả ${items.length} tiện nghi`
            : `Show all ${items.length} amenities`}
        </button>
      )}

      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#E5DFD3] pb-4">
              <h3 className="text-lg font-semibold text-[#17221E]">
                {isVi ? 'Tất cả tiện nghi tại chỗ ở' : 'All amenities'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label={isVi ? 'Đóng' : 'Close'}
                className="rounded-full p-1.5 text-[#53635D] hover:bg-[#FAF8F3]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 space-y-6">
              {grouped.living.length > 0 && (
                <div>
                  <h4 className="mb-3 text-sm font-semibold text-[#53635D]">
                    {isVi ? 'Không gian sống & Sinh hoạt' : 'Home & Daily Living'}
                  </h4>
                  <div className="divide-y divide-[#E5DFD3]/70">
                    {grouped.living.map((item) => (
                      <div key={item.key} className="flex items-center gap-3.5 py-3 text-[15px] text-[#17221E]">
                        <AmenityIcon name={item.iconName} />
                        <span>{item.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {grouped.connectivity.length > 0 && (
                <div>
                  <h4 className="mb-3 text-sm font-semibold text-[#53635D]">
                    {isVi ? 'Internet & Góc làm việc' : 'Internet & Workspace'}
                  </h4>
                  <div className="divide-y divide-[#E5DFD3]/70">
                    {grouped.connectivity.map((item) => (
                      <div key={item.key} className="flex items-center gap-3.5 py-3 text-[15px] text-[#17221E]">
                        <AmenityIcon name={item.iconName} />
                        <span>{item.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {grouped.access.length > 0 && (
                <div>
                  <h4 className="mb-3 text-sm font-semibold text-[#53635D]">
                    {isVi ? 'Tiện ích tiếp cận & Quy định' : 'Access & Extras'}
                  </h4>
                  <div className="divide-y divide-[#E5DFD3]/70">
                    {grouped.access.map((item) => (
                      <div key={item.key} className="flex items-center gap-3.5 py-3 text-[15px] text-[#17221E]">
                        <AmenityIcon name={item.iconName} />
                        <span>{item.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
