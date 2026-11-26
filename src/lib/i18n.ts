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
  options?: { showVndHint?: boolean }
): string {
  const meta = CURRENCY_MAP[currency] ?? CURRENCY_MAP.USD;
  if (meta.code === 'VND') {
    return `${Math.round(amountVnd).toLocaleString('vi-VN')} ₫`;
  }
  const converted = Math.round(amountVnd / meta.vndPerUnit);
  const formatted = `${meta.symbol}${converted.toLocaleString('en-US')}`;
  if (options?.showVndHint) {
    return `${formatted} (${Math.round(amountVnd).toLocaleString('vi-VN')} ₫)`;
  }
  return formatted;
}

export function formatVndExact(amountVnd: number): string {
  return `${Math.round(amountVnd).toLocaleString('vi-VN')} ₫`;
}

export function usdToVnd(usd: number): number {
  return Math.round(usd * CURRENCY_MAP.USD.vndPerUnit);
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

export function formatBookingStatusLabel(status: string, locale: Locale): string {
  const map: Record<string, { en: string; vi: string }> = {
    PENDING_PAYMENT: { en: 'Awaiting 12% fee', vi: 'Chờ trả phí 12%' },
    PENDING_HOST_APPROVAL: { en: 'Pending host approval', vi: 'Chờ chủ nhà duyệt' },
    RESERVED_LOCKED: { en: 'Dates locked', vi: 'Đã giữ phòng' },
    confirmed: { en: 'Dates locked', vi: 'Đã giữ phòng' },
    CHECKED_IN_COMPLETED: { en: 'Checked in', vi: 'Đã nhận phòng' },
    completed: { en: 'Checked in', vi: 'Đã nhận phòng' },
    REFUNDED_WIFI_MISMATCH: { en: 'Admin fee refunded', vi: 'Đã hoàn phí giữ chỗ' },
    cancelled: { en: 'Cancelled', vi: 'Đã hủy' },
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
