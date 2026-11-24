import { formatVnd } from '@/lib/format';
import type { SupportedCurrency, UserLocale } from './types';

export interface CurrencySpec {
  code: SupportedCurrency;
  symbol: string;
  nameEn: string;
  nameVi: string;
  /** Number of VND per 1 unit of this currency (reference mid-market rate) */
  vndPerUnit: number;
  decimals: number;
}

export const SUPPORTED_CURRENCIES: readonly CurrencySpec[] = [
  {
    code: 'VND',
    symbol: '₫',
    nameEn: 'Vietnamese Dong',
    nameVi: 'Đồng Việt Nam',
    vndPerUnit: 1,
    decimals: 0,
  },
  {
    code: 'USD',
    symbol: '$',
    nameEn: 'US Dollar',
    nameVi: 'Đô la Mỹ',
    vndPerUnit: 25400,
    decimals: 2,
  },
  {
    code: 'EUR',
    symbol: '€',
    nameEn: 'Euro',
    nameVi: 'Euro',
    vndPerUnit: 27500,
    decimals: 2,
  },
  {
    code: 'GBP',
    symbol: '£',
    nameEn: 'British Pound',
    nameVi: 'Bảng Anh',
    vndPerUnit: 32200,
    decimals: 2,
  },
  {
    code: 'AUD',
    symbol: 'A$',
    nameEn: 'Australian Dollar',
    nameVi: 'Đô la Úc',
    vndPerUnit: 16600,
    decimals: 2,
  },
  {
    code: 'SGD',
    symbol: 'S$',
    nameEn: 'Singapore Dollar',
    nameVi: 'Đô la Singapore',
    vndPerUnit: 18900,
    decimals: 2,
  },
  {
    code: 'CAD',
    symbol: 'CA$',
    nameEn: 'Canadian Dollar',
    nameVi: 'Đô la Canada',
    vndPerUnit: 18200,
    decimals: 2,
  },
  {
    code: 'JPY',
    symbol: '¥',
    nameEn: 'Japanese Yen',
    nameVi: 'Yên Nhật',
    vndPerUnit: 168,
    decimals: 0,
  },
  {
    code: 'KRW',
    symbol: '₩',
    nameEn: 'South Korean Won',
    nameVi: 'Won Hàn Quốc',
    vndPerUnit: 18.5,
    decimals: 0,
  },
] as const;

const CURRENCY_MAP = new Map<SupportedCurrency, CurrencySpec>(
  SUPPORTED_CURRENCIES.map((c) => [c.code, c])
);

export function isSupportedCurrency(value: string | null | undefined): value is SupportedCurrency {
  if (!value) return false;
  return CURRENCY_MAP.has(value.toUpperCase() as SupportedCurrency);
}

export function normalizeCurrency(value: string | null | undefined): SupportedCurrency | null {
  if (!value) return null;
  const upper = value.trim().toUpperCase();
  return CURRENCY_MAP.has(upper as SupportedCurrency) ? (upper as SupportedCurrency) : null;
}

export function getCurrencySpec(currency: SupportedCurrency): CurrencySpec {
  return CURRENCY_MAP.get(currency) ?? SUPPORTED_CURRENCIES[0];
}

export function convertVndToCurrency(
  amountVnd: number,
  currency: SupportedCurrency
): number {
  if (currency === 'VND') {
    return Math.round(amountVnd);
  }
  const spec = getCurrencySpec(currency);
  const raw = amountVnd / spec.vndPerUnit;
  if (spec.decimals === 0) {
    return Math.round(raw);
  }
  const factor = Math.pow(10, spec.decimals);
  return Math.round(raw * factor) / factor;
}

export function formatMoneyFromVnd(
  amountVnd: number,
  currency: SupportedCurrency,
  locale: UserLocale = 'en'
): string {
  if (currency === 'VND') {
    return formatVnd(amountVnd, locale);
  }

  const spec = getCurrencySpec(currency);
  const converted = convertVndToCurrency(amountVnd, currency);
  const formattedNum = new Intl.NumberFormat(locale === 'vi' ? 'vi-VN' : 'en-US', {
    minimumFractionDigits: spec.decimals,
    maximumFractionDigits: spec.decimals,
  }).format(converted);

  return locale === 'vi'
    ? `${formattedNum} ${spec.code}`
    : `${spec.symbol}${formattedNum} ${spec.code}`;
}

export function getExchangeRateNote(
  currency: SupportedCurrency,
  locale: UserLocale = 'en'
): string {
  if (currency === 'VND') {
    return locale === 'vi'
      ? 'Đơn vị tính trực tiếp bằng VND.'
      : 'Priced directly in integer VND.';
  }
  const spec = getCurrencySpec(currency);
  const formattedRate = new Intl.NumberFormat(locale === 'vi' ? 'vi-VN' : 'en-US', {
    maximumFractionDigits: 1,
  }).format(spec.vndPerUnit);
  return locale === 'vi'
    ? `Tỉ giá tham khảo: 1 ${spec.code} ≈ ${formattedRate} VND`
    : `Reference rate: 1 ${spec.code} ≈ ${formattedRate} VND`;
}
