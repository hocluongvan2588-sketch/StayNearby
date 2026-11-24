import { cookies, headers } from 'next/headers';
import { resolveUserPreferencesFromInput } from './geo';
import type { UserPreferences } from './types';

export const USER_LOCALE_COOKIE = 'wh_locale';
export const USER_CURRENCY_COOKIE = 'wh_currency';
export const PREFERENCE_COOKIE_MAX_AGE = 60 * 60 * 24 * 180; // 180 days

export async function getServerUserPreferences(): Promise<UserPreferences> {
  const [reqHeaders, cookieStore] = await Promise.all([headers(), cookies()]);
  const cookieLocale = cookieStore.get(USER_LOCALE_COOKIE)?.value ?? null;
  const cookieCurrency = cookieStore.get(USER_CURRENCY_COOKIE)?.value ?? null;

  return resolveUserPreferencesFromInput({
    headers: reqHeaders,
    cookieLocale,
    cookieCurrency,
  });
}
