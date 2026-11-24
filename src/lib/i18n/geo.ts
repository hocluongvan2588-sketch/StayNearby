import { createRequire } from 'module';
import net from 'net';
import {
  getCountryDisplayName,
  mapCountryToCurrency,
  mapCountryToLocale,
} from './country';
import { normalizeCurrency } from './currency';
import type {
  PreferenceDetectionSource,
  UserLocale,
  UserPreferences,
} from './types';

export { getCountryDisplayName, mapCountryToCurrency, mapCountryToLocale };

interface GeoIpRecord {
  country?: string;
}

interface GeoIpModule {
  lookup(ip: string): GeoIpRecord | null;
}

declare global {
  var __workinghomeGeoIp: GeoIpModule | null | undefined;
}

function getGeoIpLookup(): GeoIpModule | null {
  if (globalThis.__workinghomeGeoIp !== undefined) {
    return globalThis.__workinghomeGeoIp;
  }
  try {
    const req = createRequire(import.meta.url);
    const mod = req(/*turbopackIgnore: true*/ 'geoip-country') as GeoIpModule;
    globalThis.__workinghomeGeoIp = mod;
    return mod;
  } catch {
    globalThis.__workinghomeGeoIp = null;
    return null;
  }
}

export function normalizeIpCandidate(raw: string): string | null {
  let candidate = raw.trim();
  if (!candidate) return null;

  // Strip surrounding brackets in IPv6 like "[2001:db8::1]:443"
  if (candidate.startsWith('[')) {
    const closing = candidate.indexOf(']');
    if (closing > 1) {
      candidate = candidate.slice(1, closing);
    }
  }

  // Strip IPv4-mapped IPv6 prefix before port check (e.g. "::ffff:8.8.8.8" or "::ffff:8.8.8.8:443")
  if (candidate.toLowerCase().startsWith('::ffff:')) {
    const mapped = candidate.slice(7);
    if (mapped.includes('.')) {
      candidate = mapped;
    }
  }

  if (candidate.includes('.') && candidate.includes(':')) {
    // IPv4 with port like "113.161.65.1:54321"
    const colon = candidate.lastIndexOf(':');
    const hostPart = candidate.slice(0, colon);
    if (net.isIPv4(hostPart)) {
      candidate = hostPart;
    }
  }

  return net.isIP(candidate) ? candidate : null;
}

export function isPrivateOrLocalIp(ip: string): boolean {
  const normalized = normalizeIpCandidate(ip);
  if (!normalized) return true;

  if (net.isIPv4(normalized)) {
    const [a, b] = normalized.split('.').map(Number);
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    return false;
  }

  const lower = normalized.toLowerCase();
  if (lower === '::1' || lower === '::') return true;
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // ULA
  if (lower.startsWith('fe80')) return true; // link-local
  return false;
}

export interface HeaderReader {
  get(name: string): string | null | undefined;
}

export function extractPublicClientIp(headers: HeaderReader): {
  publicIp: string | null;
  rawIp: string;
} {
  const candidates: string[] = [];

  const cfConnecting = headers.get('cf-connecting-ip');
  if (cfConnecting) candidates.push(cfConnecting);

  const xClientIp = headers.get('x-client-ip');
  if (xClientIp) candidates.push(xClientIp);

  const xForwardedFor = headers.get('x-forwarded-for');
  if (xForwardedFor) {
    for (const part of xForwardedFor.split(',')) {
      if (part.trim()) candidates.push(part.trim());
    }
  }

  const xRealIp = headers.get('x-real-ip');
  if (xRealIp) candidates.push(xRealIp);

  let fallbackRaw = 'local';
  for (const raw of candidates) {
    const normalized = normalizeIpCandidate(raw);
    if (!normalized) continue;
    if (fallbackRaw === 'local') fallbackRaw = normalized;
    if (!isPrivateOrLocalIp(normalized)) {
      return { publicIp: normalized, rawIp: normalized };
    }
  }

  return { publicIp: null, rawIp: fallbackRaw };
}

export function lookupCountryByIp(ip: string): string | null {
  const normalized = normalizeIpCandidate(ip);
  if (!normalized || isPrivateOrLocalIp(normalized)) {
    return null;
  }
  const geo = getGeoIpLookup();
  if (!geo) return null;
  const hit = geo.lookup(normalized);
  if (hit?.country && /^[A-Z]{2}$/.test(hit.country)) {
    return hit.country;
  }
  return null;
}

function inferCountryFromAcceptLanguage(header: string | null | undefined): string | null {
  if (!header) return null;
  const primary = header.split(',')[0]?.split(';')[0]?.trim().toLowerCase();
  if (!primary) return null;

  if (primary === 'vi' || primary.startsWith('vi-')) return 'VN';
  if (primary === 'en-gb') return 'GB';
  if (primary === 'en-au') return 'AU';
  if (primary === 'en-ca') return 'CA';
  if (primary === 'en-sg') return 'SG';
  if (primary === 'en-us' || primary === 'en') return 'US';
  if (primary === 'ja' || primary.startsWith('ja-')) return 'JP';
  if (primary === 'ko' || primary.startsWith('ko-')) return 'KR';
  if (
    primary.startsWith('fr') ||
    primary.startsWith('de') ||
    primary.startsWith('es') ||
    primary.startsWith('it') ||
    primary.startsWith('nl') ||
    primary.startsWith('pt')
  ) {
    return 'DE';
  }
  return null;
}

const COUNTRY_HEADERS = [
  'cf-ipcountry',
  'x-vercel-ip-country',
  'cloudfront-viewer-country',
  'x-country-code',
  'x-geo-country',
] as const;

export function detectGeoFromHeaders(headers: HeaderReader): {
  country: string;
  ip: string;
  source: Exclude<PreferenceDetectionSource, 'cookie'>;
} {
  const { publicIp, rawIp } = extractPublicClientIp(headers);

  // 1. Trusted CDN / Proxy Geo country header
  for (const h of COUNTRY_HEADERS) {
    const val = headers.get(h)?.trim().toUpperCase();
    if (val && /^[A-Z]{2}$/.test(val) && val !== 'XX' && val !== 'T1') {
      return { country: val, ip: publicIp ?? rawIp, source: 'geo_header' };
    }
  }

  // 2. Offline GeoIP lookup on public IP
  if (publicIp) {
    const country = lookupCountryByIp(publicIp);
    if (country) {
      return { country, ip: publicIp, source: 'geoip' };
    }
  }

  // 3. Accept-Language fallback when IP is private/local or unmapped
  const langCountry = inferCountryFromAcceptLanguage(headers.get('accept-language'));
  if (langCountry) {
    return { country: langCountry, ip: rawIp, source: 'accept_language' };
  }

  // 4. Configured default or VN
  const defaultCountry =
    process.env.DEFAULT_USER_COUNTRY?.trim().toUpperCase() || 'VN';
  return {
    country: /^[A-Z]{2}$/.test(defaultCountry) ? defaultCountry : 'VN',
    ip: rawIp,
    source: 'default',
  };
}

export function resolveUserPreferencesFromInput(input: {
  headers: HeaderReader;
  cookieLocale?: string | null;
  cookieCurrency?: string | null;
}): UserPreferences {
  const geo = detectGeoFromHeaders(input.headers);

  const validCookieLocale: UserLocale | null =
    input.cookieLocale === 'en' || input.cookieLocale === 'vi'
      ? input.cookieLocale
      : null;
  const validCookieCurrency = normalizeCurrency(input.cookieCurrency);

  const autoLocale = mapCountryToLocale(geo.country);
  const autoCurrency = mapCountryToCurrency(geo.country);

  const locale = validCookieLocale ?? autoLocale;
  const currency = validCookieCurrency ?? autoCurrency;

  return {
    locale,
    currency,
    detectedCountry: geo.country,
    detectedIp: geo.ip,
    detectionSource: validCookieLocale || validCookieCurrency ? 'cookie' : geo.source,
    isAutoLocale: validCookieLocale === null,
    isAutoCurrency: validCookieCurrency === null,
  };
}
