/**
 * Shared place taxonomy — single source for host suggestions, admin forms and
 * guest labels. Maps onto `places.category` CHECK values (migration 0009) and
 * the guest explore groups in `normalizePlaceExploreGroup` (i18n.ts).
 * Do NOT invent parallel category systems.
 */

export const PLACE_CATEGORIES = [
  'restaurant',
  'cafe',
  'coworking',
  'gym_yoga',
  'entertainment',
  'attraction',
  'transport',
  'essential',
  'event_venue',
  'shopping',
  'experience',
] as const;

export type PlaceCategory = (typeof PLACE_CATEGORIES)[number];

export const PLACE_CATEGORY_LABELS: Record<PlaceCategory, { en: string; vi: string }> = {
  restaurant: { en: 'Restaurant & Dining', vi: 'Nhà hàng & Ăn uống' },
  cafe: { en: 'Coffee & Cafés', vi: 'Quán cà phê' },
  coworking: { en: 'Coworking & Workspace', vi: 'Coworking & Không gian làm việc' },
  gym_yoga: { en: 'Gym, Yoga & Sports', vi: 'Gym, Yoga & Thể thao' },
  entertainment: { en: 'Entertainment', vi: 'Vui chơi & Giải trí' },
  attraction: { en: 'Sightseeing & Experiences', vi: 'Tham quan & Trải nghiệm' },
  transport: { en: 'Vehicle & Transport Rental', vi: 'Thuê xe & Di chuyển' },
  essential: { en: 'Daily Essentials & Services', vi: 'Tiện ích & Dịch vụ sinh hoạt' },
  event_venue: { en: 'Event Venue', vi: 'Địa điểm Sự kiện' },
  shopping: { en: 'Shopping', vi: 'Mua sắm' },
  experience: { en: 'Local Experiences', vi: 'Trải nghiệm bản địa' },
};
