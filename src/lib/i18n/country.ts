import type { SupportedCurrency, UserLocale } from './types';

const EUROZONE_COUNTRIES = new Set([
  'AT',
  'BE',
  'CY',
  'EE',
  'FI',
  'FR',
  'DE',
  'GR',
  'HR',
  'IE',
  'IT',
  'LV',
  'LT',
  'LU',
  'MT',
  'NL',
  'PT',
  'SK',
  'SI',
  'ES',
]);

const GBP_COUNTRIES = new Set(['GB', 'IM', 'JE', 'GG']);

const USD_COUNTRIES = new Set(['US', 'PR', 'GU', 'VI', 'AS', 'EC', 'SV', 'PA']);

export function mapCountryToLocale(countryCode: string): UserLocale {
  return countryCode.trim().toUpperCase() === 'VN' ? 'vi' : 'en';
}

export function mapCountryToCurrency(countryCode: string): SupportedCurrency {
  const code = countryCode.trim().toUpperCase();
  if (code === 'VN') return 'VND';
  if (USD_COUNTRIES.has(code)) return 'USD';
  if (GBP_COUNTRIES.has(code)) return 'GBP';
  if (EUROZONE_COUNTRIES.has(code)) return 'EUR';
  if (code === 'AU') return 'AUD';
  if (code === 'SG') return 'SGD';
  if (code === 'CA') return 'CAD';
  if (code === 'JP') return 'JPY';
  if (code === 'KR') return 'KRW';
  return 'USD';
}

export function getCountryDisplayName(
  countryCode: string,
  locale: UserLocale = 'en'
): string {
  try {
    const dn = new Intl.DisplayNames([locale === 'vi' ? 'vi-VN' : 'en-US'], {
      type: 'region',
    });
    return dn.of(countryCode.toUpperCase()) || countryCode.toUpperCase();
  } catch {
    return countryCode.toUpperCase();
  }
}
