export type Locale = 'en' | 'vi';

export type CurrencyCode =
  | 'USD'
  | 'EUR'
  | 'VND'
  | 'GBP'
  | 'AUD'
  | 'JPY'
  | 'KRW'
  | 'SGD'
  | 'THB';

export interface CurrencyMeta {
  code: CurrencyCode;
  symbol: string;
  vndPerUnit: number;
  decimals: number;
}

export const SUPPORTED_CURRENCIES: CurrencyMeta[] = [
  { code: 'USD', symbol: '$', vndPerUnit: 25400, decimals: 0 },
  { code: 'EUR', symbol: '€', vndPerUnit: 27400, decimals: 0 },
  { code: 'VND', symbol: '₫', vndPerUnit: 1, decimals: 0 },
  { code: 'GBP', symbol: '£', vndPerUnit: 32200, decimals: 0 },
  { code: 'AUD', symbol: 'A$', vndPerUnit: 16600, decimals: 0 },
  { code: 'SGD', symbol: 'S$', vndPerUnit: 19000, decimals: 0 },
  { code: 'JPY', symbol: '¥', vndPerUnit: 168, decimals: 0 },
  { code: 'KRW', symbol: '₩', vndPerUnit: 18.5, decimals: 0 },
  { code: 'THB', symbol: '฿', vndPerUnit: 740, decimals: 0 },
];

export const CURRENCY_MAP: Record<CurrencyCode, CurrencyMeta> = Object.fromEntries(
  SUPPORTED_CURRENCIES.map((c) => [c.code, c])
) as Record<CurrencyCode, CurrencyMeta>;

export function parseCurrency(raw?: string | null): CurrencyCode {
  if (!raw) return 'USD';
  const upper = raw.toUpperCase() as CurrencyCode;
  return upper in CURRENCY_MAP ? upper : 'USD';
}

export function parseLocale(raw?: string | null): Locale {
  return raw === 'vi' ? 'vi' : 'en';
}

export function formatMoneyFromVnd(
  amountVnd: number,
  currency: CurrencyCode,
  options?: { showVndHint?: boolean; fxRates?: Record<string, number> }
): string {
  const meta = CURRENCY_MAP[currency] ?? CURRENCY_MAP.USD;
  if (meta.code === 'VND') {
    return `${Math.round(amountVnd).toLocaleString('vi-VN')} ₫`;
  }
  const dynamicRate = options?.fxRates?.[meta.code];
  const vndPerUnit =
    typeof dynamicRate === 'number' && Number.isFinite(dynamicRate) && dynamicRate > 0
      ? dynamicRate
      : meta.vndPerUnit;
  const converted = Math.round(amountVnd / vndPerUnit);
  const formatted = `${meta.symbol}${converted.toLocaleString('en-US')}`;
  if (options?.showVndHint) {
    return `${formatted} (${Math.round(amountVnd).toLocaleString('vi-VN')} ₫)`;
  }
  return formatted;
}

export function formatVndExact(amountVnd: number): string {
  return `${Math.round(amountVnd).toLocaleString('vi-VN')} ₫`;
}

export function usdToVnd(usd: number, fxRates?: Record<string, number>): number {
  const rate =
    typeof fxRates?.USD === 'number' && fxRates.USD > 0
      ? fxRates.USD
      : CURRENCY_MAP.USD.vndPerUnit;
  return Math.round(usd * rate);
}

export function pickText(locale: Locale, enText: string | null | undefined, viText: string | null | undefined): string {
  if (locale === 'vi') {
    return viText?.trim() || enText?.trim() || '';
  }
  return enText?.trim() || viText?.trim() || '';
}

export function formatPropertyTypeLabel(type: string, locale: Locale): string {
  const map: Record<string, { en: string; vi: string }> = {
    apartment: { en: 'Serviced Apartment', vi: 'Căn hộ dịch vụ' },
    coliving: { en: 'Coliving House', vi: 'Nhà ở chung (Coliving)' },
    boutique_hotel: { en: 'Boutique Hotel', vi: 'Khách sạn nhỏ' },
    villa: { en: 'Private Villa', vi: 'Biệt thự riêng' },
    eco_lodge: { en: 'Nature Lodge', vi: 'Nhà gỗ nghỉ dưỡng' },
  };
  return map[type]?.[locale] ?? type;
}

export function formatBookingStatusLabel(
  status: string,
  locale: Locale,
  feeRatePct?: number
): string {
  const pct = typeof feeRatePct === 'number' ? Math.round(feeRatePct) : null;
  const map: Record<string, { en: string; vi: string }> = {
    PENDING_PAYMENT: {
      en: pct !== null ? `Awaiting ${pct}% fee` : 'Awaiting online fee',
      vi: pct !== null ? `Chờ thanh toán ${pct}%` : 'Chờ thanh toán phí',
    },
    PENDING_HOST_APPROVAL: { en: 'Pending host approval', vi: 'Chờ chủ nhà duyệt' },
    RESERVED_LOCKED: { en: 'Confirmed', vi: 'Đã xác nhận' },
    confirmed: { en: 'Confirmed', vi: 'Đã xác nhận' },
    CHECKED_IN_COMPLETED: { en: 'Checked in', vi: 'Đã nhận phòng' },
    completed: { en: 'Checked in', vi: 'Đã nhận phòng' },
    REFUNDED_WIFI_MISMATCH: { en: 'Service fee refunded', vi: 'Đã hoàn phí dịch vụ' },
    cancelled: { en: 'Cancelled', vi: 'Đã hủy' },
  };
  return map[status]?.[locale] ?? status;
}

export function formatNightsLabel(count: number, locale: Locale): string {
  if (locale === 'vi') return `${count} đêm`;
  return `${count} ${count === 1 ? 'night' : 'nights'}`;
}

export function formatCountNoun(
  count: number,
  singularEn: string,
  pluralEn: string,
  viNoun: string,
  locale: Locale
): string {
  if (locale === 'vi') return `${count} ${viNoun}`;
  return `${count} ${count === 1 ? singularEn : pluralEn}`;
}

export function formatCmsTypeLabel(contentType: string, locale: Locale): string {
  const map: Record<string, { en: string; vi: string }> = {
    article: { en: 'Article', vi: 'Bài viết' },
    destination_guide: { en: 'City guide', vi: 'Cẩm nang thành phố' },
    community_story: { en: 'Local story', vi: 'Câu chuyện địa phương' },
    landing_page: { en: 'Feature guide', vi: 'Hướng dẫn chuyên đề' },
    faq: { en: 'FAQ', vi: 'Hỏi đáp' },
    hero_banner: { en: 'Banner', vi: 'Tiêu điểm' },
    announcement: { en: 'Announcement', vi: 'Thông báo' },
  };
  return map[contentType]?.[locale] ?? contentType.replace(/_/g, ' ');
}

export function formatPlaceCategoryLabel(category: string, locale: Locale): string {
  const map: Record<string, { en: string; vi: string }> = {
    beach: { en: 'Beach', vi: 'Bãi biển' },
    landmark: { en: 'Landmark', vi: 'Địa danh' },
    attraction: { en: 'Attractions', vi: 'Điểm tham quan' },
    restaurant: { en: 'Food & Restaurants', vi: 'Ẩm thực & Nhà hàng' },
    dining: { en: 'Food & Restaurants', vi: 'Ẩm thực & Nhà hàng' },
    cafe: { en: 'Coffee & Cafés', vi: 'Quán cà phê' },
    cafe_roastery: { en: 'Coffee & Cafés', vi: 'Quán cà phê' },
    coworking: { en: 'Coworking', vi: 'Coworking' },
    workspace: { en: 'Coworking', vi: 'Coworking' },
    gym_yoga: { en: 'Wellness & Fitness', vi: 'Sức khỏe & Thể thao' },
    fitness: { en: 'Wellness & Fitness', vi: 'Sức khỏe & Thể thao' },
    wellness: { en: 'Wellness & Fitness', vi: 'Sức khỏe & Thể thao' },
    entertainment: { en: 'Entertainment', vi: 'Giải trí & Buổi tối' },
    shopping: { en: 'Shopping', vi: 'Mua sắm & Thủ công' },
    experience: { en: 'Local Experiences', vi: 'Trải nghiệm bản địa' },
    event_venue: { en: 'Things to Do', vi: 'Hoạt động & Sự kiện' },
    grocery: { en: 'Daily Essentials', vi: 'Tiện ích thiết yếu' },
    essential: { en: 'Daily Essentials', vi: 'Tiện ích thiết yếu' },
    daily_essential: { en: 'Daily Essentials', vi: 'Tiện ích thiết yếu' },
    essentials: { en: 'Daily Essentials', vi: 'Tiện ích thiết yếu' },
    clinic: { en: 'Daily Essentials', vi: 'Y tế & Thiết yếu' },
    transit: { en: 'Transit', vi: 'Di chuyển' },
    transport: { en: 'Transit', vi: 'Di chuyển' },
  };
  return map[category]?.[locale] ?? category.replace(/_/g, ' ');
}

export function normalizePlaceExploreGroup(category: string): string {
  switch (category) {
    case 'restaurant':
    case 'dining':
      return 'food';
    case 'cafe':
    case 'cafe_roastery':
      return 'coffee';
    case 'attraction':
    case 'beach':
    case 'landmark':
      return 'attractions';
    case 'entertainment':
      return 'entertainment';
    case 'shopping':
      return 'shopping';
    case 'gym_yoga':
    case 'fitness':
    case 'wellness':
      return 'wellness';
    case 'coworking':
    case 'workspace':
      return 'coworking';
    case 'essential':
    case 'daily_essential':
    case 'essentials':
    case 'grocery':
    case 'clinic':
    case 'transport':
    case 'transit':
      return 'essentials';
    case 'experience':
    case 'event_venue':
      return 'experiences';
    default:
      return 'things_to_do';
  }
}

export function formatStayAxisStatusLabel(status: string, locale: Locale): string {
  const map: Record<string, { en: string; vi: string }> = {
    upcoming: { en: 'Upcoming', vi: 'Sắp nhận phòng' },
    checked_in: { en: 'Checked in', vi: 'Đang lưu trú' },
    checked_out: { en: 'Checked out', vi: 'Đã trả phòng' },
    no_show: { en: 'No show', vi: 'Vắng mặt' },
    cancelled: { en: 'Cancelled', vi: 'Đã hủy' },
  };
  return map[status]?.[locale] ?? status;
}

export function formatPaymentAxisStatusLabel(status: string, locale: Locale): string {
  const map: Record<string, { en: string; vi: string }> = {
    unpaid: { en: 'Unpaid', vi: 'Chưa thanh toán' },
    pending: { en: 'Pending payment', vi: 'Đang chờ thanh toán' },
    paid: { en: 'Fee paid', vi: 'Đã thanh toán phí' },
    failed: { en: 'Payment failed', vi: 'Thanh toán lỗi' },
    refunded: { en: 'Refunded', vi: 'Đã hoàn tiền' },
    partially_refunded: { en: 'Partially refunded', vi: 'Hoàn tiền một phần' },
  };
  return map[status]?.[locale] ?? status;
}

export function formatRefundAxisStatusLabel(status: string, locale: Locale): string {
  const map: Record<string, { en: string; vi: string }> = {
    none: { en: 'No refund', vi: 'Không có hoàn tiền' },
    requested: { en: 'Refund requested', vi: 'Đã gửi yêu cầu hoàn' },
    approved: { en: 'Refund approved', vi: 'Đã duyệt hoàn tiền' },
    processing: { en: 'Refund processing', vi: 'Đang xử lý hoàn tiền' },
    completed: { en: 'Refund completed', vi: 'Đã hoàn tiền' },
    rejected: { en: 'Refund declined', vi: 'Từ chối hoàn tiền' },
  };
  return map[status]?.[locale] ?? status;
}

export function formatVerificationTierLabel(tier: string, locale: Locale): string {
  if (tier === 'VIETNOMAD_CERTIFIED') {
    return locale === 'vi' ? 'Đã xác minh Wi-Fi' : 'Wi-Fi Verified';
  }
  return locale === 'vi' ? 'Chủ nhà tự khai báo' : 'Host Reported';
}

export function formatBusinessModelLabel(_model: string, locale: Locale): string {
  return locale === 'vi' ? 'Đặt qua VietNomad' : 'Book on VietNomad';
}

export function formatKitchenTypeLabel(kitchen: string, locale: Locale): string {
  const map: Record<string, { en: string; vi: string }> = {
    full: { en: 'Full kitchen', vi: 'Bếp riêng đầy đủ' },
    kitchenette: { en: 'Kitchenette', vi: 'Bếp nhỏ gọn' },
    shared: { en: 'Shared kitchen', vi: 'Bếp chung' },
    none: { en: 'No kitchen', vi: 'Không có bếp' },
  };
  return map[kitchen]?.[locale] ?? kitchen;
}

export function formatLaundryTypeLabel(laundry: string, locale: Locale): string {
  const map: Record<string, { en: string; vi: string }> = {
    in_unit: { en: 'In-unit washer', vi: 'Máy giặt riêng' },
    building: { en: 'Building laundry', vi: 'Giặt sấy chung' },
    service: { en: 'Laundry service', vi: 'Dịch vụ giặt ủi' },
    none: { en: 'No laundry', vi: 'Không có máy giặt' },
  };
  return map[laundry]?.[locale] ?? laundry;
}

export function formatCancellationPolicyLabel(policy: string, locale: Locale): string {
  const map: Record<string, { en: string; vi: string }> = {
    flexible: { en: 'Flexible', vi: 'Linh hoạt' },
    moderate: { en: 'Moderate', vi: 'Tiêu chuẩn' },
    strict: { en: 'Strict', vi: 'Chặt chẽ' },
  };
  return map[policy]?.[locale] ?? policy;
}

export function formatApplicationStatusLabel(status: string, locale: Locale): string {
  const map: Record<string, { en: string; vi: string }> = {
    submitted: { en: 'Pending review', vi: 'Chờ duyệt' },
    approved: { en: 'Approved', vi: 'Đã duyệt' },
    rejected: { en: 'Rejected', vi: 'Từ chối' },
  };
  return map[status]?.[locale] ?? status;
}

export function formatIcalSyncStatusLabel(status: string, locale: Locale): string {
  const map: Record<string, { en: string; vi: string }> = {
    ok: { en: 'Synced', vi: 'Đã đồng bộ' },
    idle: { en: 'Not connected', vi: 'Chưa kết nối' },
    error: { en: 'Sync error', vi: 'Lỗi kết nối' },
  };
  return map[status]?.[locale] ?? status;
}

// ── Shared display formatters (Guest Platform UI) ────────────────────────────

/**
 * Deduplicated location label for StayCard / Listing Detail headers.
 * Flattens comma-separated parts and drops repeated segments, e.g.
 * ["Bán đảo Sơn Trà, Đà Nẵng", "Đà Nẵng"] -> "Bán đảo Sơn Trà, Đà Nẵng".
 */
export function formatStayLocationLabel(
  parts: Array<string | null | undefined>
): string {
  const segments: string[] = [];
  const seen = new Set<string>();
  for (const part of parts) {
    if (!part) continue;
    for (const seg of part.split(',')) {
      const s = seg.trim();
      if (!s) continue;
      const key = s.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      segments.push(s);
    }
  }
  return segments.join(', ');
}

const COUNTRY_LABELS: Record<string, { en: string; vi: string }> = {
  vietnam: { en: 'Vietnam', vi: 'Việt Nam' },
  thailand: { en: 'Thailand', vi: 'Thái Lan' },
  malaysia: { en: 'Malaysia', vi: 'Malaysia' },
  singapore: { en: 'Singapore', vi: 'Singapore' },
  indonesia: { en: 'Indonesia', vi: 'Indonesia' },
  philippines: { en: 'Philippines', vi: 'Philippines' },
  cambodia: { en: 'Cambodia', vi: 'Campuchia' },
  laos: { en: 'Laos', vi: 'Lào' },
  australia: { en: 'Australia', vi: 'Úc' },
  france: { en: 'France', vi: 'Pháp' },
  germany: { en: 'Germany', vi: 'Đức' },
  'united kingdom': { en: 'United Kingdom', vi: 'Anh' },
  'united states': { en: 'United States', vi: 'Hoa Kỳ' },
  usa: { en: 'United States', vi: 'Hoa Kỳ' },
  japan: { en: 'Japan', vi: 'Nhật Bản' },
  'south korea': { en: 'South Korea', vi: 'Hàn Quốc' },
  canada: { en: 'Canada', vi: 'Canada' },
  netherlands: { en: 'Netherlands', vi: 'Hà Lan' },
  spain: { en: 'Spain', vi: 'Tây Ban Nha' },
  italy: { en: 'Italy', vi: 'Ý' },
  india: { en: 'India', vi: 'Ấn Độ' },
  taiwan: { en: 'Taiwan', vi: 'Đài Loan' },
  'hong kong': { en: 'Hong Kong', vi: 'Hồng Kông' },
  china: { en: 'China', vi: 'Trung Quốc' },
  russia: { en: 'Russia', vi: 'Nga' },
  'new zealand': { en: 'New Zealand', vi: 'New Zealand' },
};

/** Localize a host nationality / country name to the active locale. */
export function formatCountryLabel(
  country: string | null | undefined,
  locale: Locale
): string {
  const raw = (country ?? '').trim();
  if (!raw) return '';
  const hit = COUNTRY_LABELS[raw.toLowerCase()];
  return hit ? (locale === 'vi' ? hit.vi : hit.en) : raw;
}

/**
 * Localize distance labels coming from data (e.g. "4 min walk", "1.2 km")
 * without inventing values. Unknown formats pass through unchanged.
 */
export function formatDistanceLabel(
  label: string | null | undefined,
  locale: Locale
): string {
  const raw = (label ?? '').trim();
  if (!raw) return '';
  if (/^0(?:[.,]0+)?\s*km$/i.test(raw)) {
    return locale === 'vi' ? 'Ngay tại chỗ ở' : 'On-site';
  }
  const walk = raw.match(/^(\d+(?:[.,]\d+)?)\s*min\s*walk$/i);
  if (walk) {
    const n = walk[1].replace('.', ',');
    return locale === 'vi' ? `${n} phút đi bộ` : `${n} min walk`;
  }
  const drive = raw.match(/^(\d+(?:[.,]\d+)?)\s*min\s*drive$/i);
  if (drive) {
    const n = drive[1].replace('.', ',');
    return locale === 'vi' ? `${n} phút lái xe` : `${n} min drive`;
  }
  const km = raw.match(/^(\d+(?:[.,]\d+)?)\s*km$/i);
  if (km) {
    const n = locale === 'vi' ? km[1].replace('.', ',') : km[1].replace(',', '.');
    return `${n} km`;
  }
  return raw;
}

/**
 * Public display name for a host: strips a trailing internal handle like
 * "Admin (hocluongvan2588)" while keeping intentional parentheticals.
 */
export function formatHostDisplayName(name: string | null | undefined): string {
  const trimmed = (name ?? '').trim();
  const m = trimmed.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  if (m && m[1].trim()) {
    const inner = m[2].trim();
    if (/^[a-z0-9][a-z0-9._-]*$/i.test(inner) && /\d/.test(inner)) {
      return m[1].trim();
    }
  }
  return trimmed;
}

/** Compact date for source/date lines: "25/11/2026". */
export function formatShortDateLabel(
  value: string | Date | null | undefined,
  locale: Locale
): string {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat(locale === 'vi' ? 'vi-VN' : 'en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}
