/**
 * Google Maps URL helpers — no paid API, no network calls.
 *
 * Hosts paste a Google Maps share link; we extract coordinates so ranking and
 * "distance from stay" can work. Anything we cannot parse stays null — never
 * guessed.
 */

export type MapsCoords = { lat: number; lng: number };

function valid(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

/**
 * Parse coordinates out of common Google Maps URL shapes:
 *   https://www.google.com/maps/@10.7769,106.7009,15z
 *   https://maps.google.com/?q=10.7769,106.7009
 *   https://www.google.com/maps/place/.../@10.7769,106.7009,17z
 *   https://maps.app.goo.gl/…            (short links — no coords, returns null)
 *   https://maps.google.com/?ll=10.7769,106.7009
 * Returns null when no coordinates are present (short/link-only URLs).
 */
export function parseGoogleMapsCoords(url: string): MapsCoords | null {
  const raw = (url ?? '').trim();
  if (!raw) return null;
  if (!/^https?:\/\//i.test(raw)) return null;

  // @lat,lng (place/zoom links)
  const atMatch = raw.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (atMatch) {
    const lat = Number(atMatch[1]);
    const lng = Number(atMatch[2]);
    if (valid(lat, lng)) return { lat, lng };
  }

  // ?q=lat,lng or ?query=lat,lng or ?ll=lat,lng
  const paramMatch = raw.match(/[?&](?:q|query|ll)=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (paramMatch) {
    const lat = Number(paramMatch[1]);
    const lng = Number(paramMatch[2]);
    if (valid(lat, lng)) return { lat, lng };
  }

  // /maps/dir/.../origin coords are rare — skip deliberately.
  return null;
}

/** True when the string looks like a Google Maps share link (even if coords are opaque). */
export function isGoogleMapsUrl(url: string): boolean {
  const raw = (url ?? '').trim().toLowerCase();
  return /^https?:\/\/(www\.|maps\.)?google\.[a-z.]+\/maps/.test(raw) ||
    /^https?:\/\/maps\.app\.goo\.gl\//.test(raw) ||
    /^https?:\/\/goo\.gl\/maps/.test(raw);
}
