/**
 * Shared listing form options — single source for Wizard and Editor selects.
 * `en` strings match the historical editor/wizard copy exactly; `vi` strings
 * reuse existing bilingual copy (i18n map / wizard VI labels).
 */

export interface ListingOption<T extends string = string> {
  value: T;
  en: string;
  vi: string;
}

export const PROPERTY_TYPE_VALUES = [
  'apartment',
  'coliving',
  'boutique_hotel',
  'villa',
  'eco_lodge',
] as const;
export type PropertyTypeValue = (typeof PROPERTY_TYPE_VALUES)[number];

export const PROPERTY_TYPE_OPTIONS: readonly ListingOption<PropertyTypeValue>[] = [
  { value: 'apartment', en: 'Serviced Apartment', vi: 'Căn hộ dịch vụ' },
  { value: 'coliving', en: 'Coliving House', vi: 'Nhà ở chung (Coliving)' },
  { value: 'boutique_hotel', en: 'Boutique Hotel', vi: 'Khách sạn nhỏ' },
  { value: 'villa', en: 'Villa', vi: 'Biệt thự riêng' },
  { value: 'eco_lodge', en: 'Eco Lodge', vi: 'Nhà gỗ nghỉ dưỡng' },
];

export const KITCHEN_TYPE_VALUES = ['full', 'kitchenette', 'shared', 'none'] as const;
export type KitchenTypeValue = (typeof KITCHEN_TYPE_VALUES)[number];

export const KITCHEN_OPTIONS: readonly ListingOption<KitchenTypeValue>[] = [
  { value: 'full', en: 'Full kitchen', vi: 'Bếp nấu riêng đầy đủ' },
  { value: 'kitchenette', en: 'Kitchenette', vi: 'Bếp nhỏ (Kitchenette)' },
  { value: 'shared', en: 'Shared kitchen', vi: 'Bếp dùng chung' },
  { value: 'none', en: 'No kitchen', vi: 'Không có bếp' },
];

export const LAUNDRY_TYPE_VALUES = ['in_unit', 'building', 'service', 'none'] as const;
export type LaundryTypeValue = (typeof LAUNDRY_TYPE_VALUES)[number];

export const LAUNDRY_OPTIONS: readonly ListingOption<LaundryTypeValue>[] = [
  { value: 'in_unit', en: 'In-unit', vi: 'Máy giặt trong phòng' },
  { value: 'building', en: 'Building laundry', vi: 'Giặt chung trong tòa nhà' },
  { value: 'service', en: 'Laundry service', vi: 'Dịch vụ giặt ủi' },
  { value: 'none', en: 'None', vi: 'Không có' },
];

export const CANCELLATION_POLICY_VALUES = ['flexible', 'moderate', 'strict'] as const;
export type CancellationPolicyValue = (typeof CANCELLATION_POLICY_VALUES)[number];

/** Localized label for one option (falls back to `en`). */
export function listingOptionLabel(
  options: readonly ListingOption[],
  value: string,
  locale: 'en' | 'vi'
): string {
  const opt = options.find((o) => o.value === value);
  if (!opt) return value;
  return locale === 'vi' ? opt.vi : opt.en;
}
