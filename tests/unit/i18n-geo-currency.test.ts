import { describe, expect, it } from 'vitest';
import {
  convertVndToCurrency,
  formatMoneyFromVnd,
  getExchangeRateNote,
  normalizeCurrency,
} from '@/lib/i18n/currency';
import {
  detectGeoFromHeaders,
  extractPublicClientIp,
  resolveUserPreferencesFromInput,
} from '@/lib/i18n/geo';

function makeHeaders(map: Record<string, string>) {
  const lower = new Map<string, string>(
    Object.entries(map).map(([k, v]) => [k.toLowerCase(), v])
  );
  return {
    get(name: string) {
      return lower.get(name.toLowerCase()) ?? null;
    },
  };
}

describe('IP geolocation, locale detection, and currency conversion', () => {
  it('detects Vietnamese IP as vi + VND and foreign IPs as en + local currency', () => {
    const vnPrefs = resolveUserPreferencesFromInput({
      headers: makeHeaders({ 'x-forwarded-for': '113.161.65.1' }),
    });
    expect(vnPrefs.detectedCountry).toBe('VN');
    expect(vnPrefs.locale).toBe('vi');
    expect(vnPrefs.currency).toBe('VND');
    expect(vnPrefs.detectionSource).toBe('geoip');
    expect(vnPrefs.isAutoLocale).toBe(true);
    expect(vnPrefs.isAutoCurrency).toBe(true);

    const usPrefs = resolveUserPreferencesFromInput({
      headers: makeHeaders({ 'x-forwarded-for': '8.8.8.8' }),
    });
    expect(usPrefs.detectedCountry).toBe('US');
    expect(usPrefs.locale).toBe('en');
    expect(usPrefs.currency).toBe('USD');
    expect(usPrefs.detectionSource).toBe('geoip');

    const gbPrefs = resolveUserPreferencesFromInput({
      headers: makeHeaders({ 'x-forwarded-for': '81.2.69.142' }),
    });
    expect(gbPrefs.detectedCountry).toBe('GB');
    expect(gbPrefs.locale).toBe('en');
    expect(gbPrefs.currency).toBe('GBP');

    const dePrefs = resolveUserPreferencesFromInput({
      headers: makeHeaders({ 'x-forwarded-for': '46.114.0.1' }),
    });
    expect(dePrefs.detectedCountry).toBe('DE');
    expect(dePrefs.locale).toBe('en');
    expect(dePrefs.currency).toBe('EUR');

    const jpPrefs = resolveUserPreferencesFromInput({
      headers: makeHeaders({ 'x-forwarded-for': '133.11.0.1' }),
    });
    expect(jpPrefs.detectedCountry).toBe('JP');
    expect(jpPrefs.locale).toBe('en');
    expect(jpPrefs.currency).toBe('JPY');

    const krPrefs = resolveUserPreferencesFromInput({
      headers: makeHeaders({ 'x-forwarded-for': '211.115.0.1' }),
    });
    expect(krPrefs.detectedCountry).toBe('KR');
    expect(krPrefs.locale).toBe('en');
    expect(krPrefs.currency).toBe('KRW');

    const auPrefs = resolveUserPreferencesFromInput({
      headers: makeHeaders({ 'x-forwarded-for': '203.2.193.124' }),
    });
    expect(auPrefs.detectedCountry).toBe('AU');
    expect(auPrefs.locale).toBe('en');
    expect(auPrefs.currency).toBe('AUD');
  });

  it('skips private/loopback proxy hops and supports IPv6-mapped IPv4', () => {
    const extracted = extractPublicClientIp(
      makeHeaders({ 'x-forwarded-for': '127.0.0.1, 10.0.0.8, ::ffff:8.8.8.8:443' })
    );
    expect(extracted.publicIp).toBe('8.8.8.8');

    const mapped = extractPublicClientIp(
      makeHeaders({ 'x-real-ip': '::ffff:14.161.0.1' })
    );
    expect(mapped.publicIp).toBe('14.161.0.1');
  });

  it('prefers trusted CDN Geo country headers and falls back to Accept-Language on local IP', () => {
    const cfGeo = detectGeoFromHeaders(
      makeHeaders({ 'cf-ipcountry': 'SG', 'x-forwarded-for': '127.0.0.1' })
    );
    expect(cfGeo.country).toBe('SG');
    expect(cfGeo.source).toBe('geo_header');

    const sgPrefs = resolveUserPreferencesFromInput({
      headers: makeHeaders({ 'cf-ipcountry': 'SG' }),
    });
    expect(sgPrefs.locale).toBe('en');
    expect(sgPrefs.currency).toBe('SGD');

    const localVi = resolveUserPreferencesFromInput({
      headers: makeHeaders({
        'x-forwarded-for': '127.0.0.1',
        'accept-language': 'vi-VN,vi;q=0.9,en;q=0.8',
      }),
    });
    expect(localVi.detectedCountry).toBe('VN');
    expect(localVi.locale).toBe('vi');
    expect(localVi.currency).toBe('VND');
    expect(localVi.detectionSource).toBe('accept_language');

    const localGb = resolveUserPreferencesFromInput({
      headers: makeHeaders({
        'x-forwarded-for': '127.0.0.1',
        'accept-language': 'en-GB,en;q=0.9',
      }),
    });
    expect(localGb.detectedCountry).toBe('GB');
    expect(localGb.locale).toBe('en');
    expect(localGb.currency).toBe('GBP');
  });

  it('applies manual cookie overrides on top of IP detection', () => {
    const overridden = resolveUserPreferencesFromInput({
      headers: makeHeaders({ 'x-forwarded-for': '113.161.65.1' }),
      cookieLocale: 'en',
      cookieCurrency: 'USD',
    });
    expect(overridden.detectedCountry).toBe('VN');
    expect(overridden.locale).toBe('en');
    expect(overridden.currency).toBe('USD');
    expect(overridden.detectionSource).toBe('cookie');
    expect(overridden.isAutoLocale).toBe(false);
    expect(overridden.isAutoCurrency).toBe(false);
  });

  it('converts and formats integer VND into supported display currencies', () => {
    expect(normalizeCurrency('usd')).toBe('USD');
    expect(normalizeCurrency('XYZ')).toBeNull();

    expect(convertVndToCurrency(1450000, 'VND')).toBe(1450000);
    expect(convertVndToCurrency(2540000, 'USD')).toBe(100);
    expect(convertVndToCurrency(1450000, 'USD')).toBe(57.09);

    expect(formatMoneyFromVnd(1450000, 'VND', 'en')).toBe('1,450,000 VND');
    expect(formatMoneyFromVnd(1450000, 'VND', 'vi')).toBe('1.450.000 VND');
    expect(formatMoneyFromVnd(1450000, 'USD', 'en')).toBe('$57.09 USD');
    expect(formatMoneyFromVnd(1450000, 'USD', 'vi')).toBe('57,09 USD');
    expect(formatMoneyFromVnd(1680000, 'JPY', 'en')).toBe('¥10,000 JPY');
    expect(getExchangeRateNote('USD', 'vi')).toContain('25.400 VND');
  });
});
