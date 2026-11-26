'use client';

export interface ClientAttributionContext {
  visitorId: string;
  sessionKey: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent: string;
  utmTerm: string;
  referrer: string;
  landingPath: string;
}

const VISITOR_STORAGE_KEY = 'vn_visitor_id';
const SESSION_STORAGE_KEY = 'vn_attr_session';
const UTM_STORAGE_KEY = 'vn_attr_utm';

function randomId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  }
  return `${prefix}_${Math.random().toString(36).slice(2, 12)}${Date.now().toString(36)}`;
}

function setCookie(name: string, value: string, maxAgeSeconds: number) {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSeconds}; SameSite=Lax`;
}

export function captureClientAttribution(): ClientAttributionContext {
  if (typeof window === 'undefined') {
    return {
      visitorId: 'ssr',
      sessionKey: 'ssr',
      utmSource: '',
      utmMedium: '',
      utmCampaign: '',
      utmContent: '',
      utmTerm: '',
      referrer: '',
      landingPath: '/',
    };
  }

  let visitorId = '';
  try {
    visitorId = window.localStorage.getItem(VISITOR_STORAGE_KEY) || '';
    if (!visitorId) {
      visitorId = randomId('vis');
      window.localStorage.setItem(VISITOR_STORAGE_KEY, visitorId);
    }
    setCookie(VISITOR_STORAGE_KEY, visitorId, 60 * 60 * 24 * 180);
  } catch {
    visitorId = randomId('vis');
  }

  let sessionKey = '';
  try {
    sessionKey = window.sessionStorage.getItem(SESSION_STORAGE_KEY) || '';
    if (!sessionKey) {
      sessionKey = randomId('ses');
      window.sessionStorage.setItem(SESSION_STORAGE_KEY, sessionKey);
    }
    setCookie(SESSION_STORAGE_KEY, sessionKey, 60 * 60 * 24);
  } catch {
    sessionKey = randomId('ses');
  }

  const params = new URLSearchParams(window.location.search);
  let storedUtm: Partial<ClientAttributionContext> = {};
  try {
    const raw = window.sessionStorage.getItem(UTM_STORAGE_KEY);
    if (raw) storedUtm = JSON.parse(raw) as Partial<ClientAttributionContext>;
  } catch {
    storedUtm = {};
  }

  const urlSource = params.get('utm_source')?.trim() ?? '';
  const urlMedium = params.get('utm_medium')?.trim() ?? '';
  const urlCampaign = params.get('utm_campaign')?.trim() ?? '';
  const urlContent = params.get('utm_content')?.trim() ?? '';
  const urlTerm = params.get('utm_term')?.trim() ?? '';

  const merged: ClientAttributionContext = {
    visitorId,
    sessionKey,
    utmSource: urlSource || storedUtm.utmSource || '',
    utmMedium: urlMedium || storedUtm.utmMedium || '',
    utmCampaign: urlCampaign || storedUtm.utmCampaign || '',
    utmContent: urlContent || storedUtm.utmContent || '',
    utmTerm: urlTerm || storedUtm.utmTerm || '',
    referrer: storedUtm.referrer || (document.referrer ? document.referrer.slice(0, 240) : ''),
    landingPath:
      storedUtm.landingPath ||
      `${window.location.pathname}${window.location.search ? window.location.search : ''}`.slice(
        0,
        240
      ),
  };

  try {
    window.sessionStorage.setItem(
      UTM_STORAGE_KEY,
      JSON.stringify({
        utmSource: merged.utmSource,
        utmMedium: merged.utmMedium,
        utmCampaign: merged.utmCampaign,
        utmContent: merged.utmContent,
        utmTerm: merged.utmTerm,
        referrer: merged.referrer,
        landingPath: merged.landingPath,
      })
    );
  } catch {
    // ignore storage errors
  }

  return merged;
}

export async function trackClientEvent(params: {
  eventName: 'page_view' | 'article_view' | 'destination_view' | 'search' | 'stay_view' | 'checkout_start';
  stayId?: string;
  contentId?: string;
  destinationSlug?: string;
  landingPath?: string;
  dedupeKey?: string;
  utmContent?: string;
}) {
  if (typeof window === 'undefined') return;
  const pathname = window.location.pathname || '/';
  if (pathname.startsWith('/admin') || pathname.startsWith('/host')) return;

  const ctx = captureClientAttribution();
  const payload = {
    sessionKey: ctx.sessionKey,
    visitorId: ctx.visitorId,
    eventName: params.eventName,
    stayId: params.stayId ?? null,
    contentId: params.contentId ?? null,
    destinationSlug: params.destinationSlug ?? '',
    utmSource: ctx.utmSource,
    utmMedium: ctx.utmMedium,
    utmCampaign: ctx.utmCampaign,
    utmContent: params.utmContent ?? ctx.utmContent,
    utmTerm: ctx.utmTerm,
    referrer: ctx.referrer,
    landingPath: params.landingPath ?? pathname,
    dedupeKey:
      params.dedupeKey ??
      `${params.eventName}:${ctx.sessionKey}:${params.contentId ?? params.stayId ?? params.destinationSlug ?? pathname}`,
  };

  try {
    await fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch {
    // non-blocking telemetry
  }
}
