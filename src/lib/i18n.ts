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
    attraction: { en: 'Attraction', vi: 'Điểm tham quan' },
    restaurant: { en: 'Dining', vi: 'Ẩm thực' },
    dining: { en: 'Dining', vi: 'Ẩm thực' },
    cafe: { en: 'Cafe', vi: 'Cà phê' },
    cafe_roastery: { en: 'Cafe & Roastery', vi: 'Quán cà phê' },
    coworking: { en: 'Workspace', vi: 'Không gian làm việc' },
    workspace: { en: 'Workspace', vi: 'Không gian làm việc' },
    fitness: { en: 'Fitness', vi: 'Thể thao & Gym' },
    wellness: { en: 'Wellness', vi: 'Thư giãn & Spa' },
    grocery: { en: 'Groceries', vi: 'Siêu thị & Tạp hóa' },
    daily_essential: { en: 'Daily essentials', vi: 'Tiện ích thiết yếu' },
    essentials: { en: 'Daily essentials', vi: 'Tiện ích thiết yếu' },
    clinic: { en: 'Healthcare', vi: 'Y tế' },
    transit: { en: 'Transit', vi: 'Di chuyển' },
    transport: { en: 'Transport', vi: 'Di chuyển' },
  };
  return map[category]?.[locale] ?? category.replace(/_/g, ' ');
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
