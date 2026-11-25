import { cookies, headers } from 'next/headers';
import { getConfig } from './config';
import {
  type CurrencyCode,
  type Locale,
  parseCurrency,
  parseLocale,
} from './i18n';

export const LOCALE_COOKIE = 'vn_locale';
export const CURRENCY_COOKIE = 'vn_currency';

export async function getServerPreferences(): Promise<{
  locale: Locale;
  currency: CurrencyCode;
}> {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const { defaultLocale } = getConfig();

  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value;
  const cookieCurrency = cookieStore.get(CURRENCY_COOKIE)?.value;

  let locale: Locale = defaultLocale;
  if (cookieLocale) {
    locale = parseLocale(cookieLocale);
  } else {
    const acceptLang = (headerStore.get('accept-language') ?? '').toLowerCase();
    // International audience defaults to EN; switch automatically only if browser explicitly prefers vi first
    if (acceptLang.startsWith('vi')) {
      locale = 'vi';
    }
  }

  let currency: CurrencyCode = locale === 'vi' ? 'VND' : 'USD';
  if (cookieCurrency) {
    currency = parseCurrency(cookieCurrency);
  } else {
    const country = (headerStore.get('x-vercel-ip-country') ?? '').toUpperCase();
    if (country === 'VN') currency = locale === 'vi' ? 'VND' : 'USD';
    else if (country === 'GB') currency = 'GBP';
    else if (country === 'DE' || country === 'FR' || country === 'ES' || country === 'NL' || country === 'PT')
      currency = 'EUR';
    else if (country === 'AU') currency = 'AUD';
    else if (country === 'SG') currency = 'SGD';
    else if (country === 'JP') currency = 'JPY';
    else if (country === 'KR') currency = 'KRW';
    else if (country === 'TH') currency = 'THB';
  }

  return { locale, currency };
}
