/**
 * Geo helpers for Local Discovery ranking (server-side only).
 * Distances are advisory: we only ever display a value when real coordinates
 * exist on BOTH ends — never fabricated walk times.
 */

const EARTH_RADIUS_M = 6371000;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Great-circle distance in meters. Returns null when any coordinate is missing. */
export function haversineMeters(
  lat1: number | null | undefined,
  lng1: number | null | undefined,
  lat2: number | null | undefined,
  lng2: number | null | undefined
): number | null {
  if (
    lat1 == null ||
    lng1 == null ||
    lat2 == null ||
    lng2 == null ||
    !Number.isFinite(lat1) ||
    !Number.isFinite(lng1) ||
    !Number.isFinite(lat2) ||
    !Number.isFinite(lng2)
  ) {
    return null;
  }
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * Privacy-preserving rounding before a distance reaches the client:
 * < 1 km → nearest 50 m; ≥ 1 km → nearest 100 m. Prevents reverse-engineering
 * the exact stay coordinates from a displayed distance.
 */
export function roundDistanceMeters(m: number): number {
  if (m < 1000) return Math.max(50, Math.round(m / 50) * 50);
  return Math.round(m / 100) * 100;
}
