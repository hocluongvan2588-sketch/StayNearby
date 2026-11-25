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
    coliving: { en: 'Coliving House', vi: 'Nhà ở Coliving' },
    boutique_hotel: { en: 'Boutique Hotel', vi: 'Khách sạn Boutique' },
    villa: { en: 'Garden / Sea Villa', vi: 'Biệt thự riêng' },
    eco_lodge: { en: 'Eco Sanctuary', vi: 'Eco Lodge Yên Tĩnh' },
  };
  return map[type]?.[locale] ?? type;
}
