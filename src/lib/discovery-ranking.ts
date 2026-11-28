import { haversineMeters, roundDistanceMeters } from '@/lib/geo';

/**
 * Stay-detail Local Discovery ranking (docs/local-discovery-plan.md §B4).
 *
 * Tier order (spec §7):
 *   1. on-site / in-building places          (places.is_onsite)
 *   2. host-introduced, VietNomad-approved   (link source = host_suggested)
 *   3. VietNomad direct listing links        (link source = curated)
 *   4. within a category radius of the stay  (needs coords on BOTH ends)
 *   5. featured destination places (then remaining as fill)
 *
 * Distances are straight-line (haversine) and only computed when both the
 * stay and the place have coordinates — never fabricated. Display rounding
 * (privacy) happens here too, so raw stay coordinates never leave the server.
 */

export interface RankablePlace {
  id: string;
  name: string;
  category: string;
  lat: number | null;
  lng: number | null;
  isFeatured: boolean;
  isOnsite: boolean;
  linkSource: 'curated' | 'host_suggested' | null;
}

export interface RankedPlace extends RankablePlace {
  /** Privacy-rounded straight-line meters from the stay; null when unknown. */
  distanceMeters: number | null;
  tier: 1 | 2 | 3 | 4 | 5;
}

export function rankStayPlaces(
  places: RankablePlace[],
  opts: { stayLat: number | null; stayLng: number | null; radiiMeters: Record<string, number>; limit?: number }
): RankedPlace[] {
  const limit = opts.limit ?? 12;
  const hasStayCoords = opts.stayLat != null && opts.stayLng != null;

  const ranked: RankedPlace[] = places.map((p) => {
    const rawDist = hasStayCoords ? haversineMeters(opts.stayLat, opts.stayLng, p.lat, p.lng) : null;
    const distanceMeters = rawDist != null ? roundDistanceMeters(rawDist) : null;
    const radius = opts.radiiMeters[p.category] ?? opts.radiiMeters['default'] ?? null;

    let tier: RankedPlace['tier'];
    if (p.isOnsite) tier = 1;
    else if (p.linkSource === 'host_suggested') tier = 2;
    else if (p.linkSource === 'curated') tier = 3;
    else if (hasStayCoords && distanceMeters != null && radius != null && rawDist != null && rawDist <= radius)
      tier = 4;
    else tier = 5;

    return { ...p, distanceMeters, tier };
  });

  ranked.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    // Within a tier: closer first (when known), then featured, then name.
    if (a.distanceMeters != null && b.distanceMeters != null && a.distanceMeters !== b.distanceMeters) {
      return a.distanceMeters - b.distanceMeters;
    }
    if (a.distanceMeters == null && b.distanceMeters != null) return 1;
    if (a.distanceMeters != null && b.distanceMeters == null) return -1;
    if (a.isFeatured !== b.isFeatured) return a.isFeatured ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return ranked.slice(0, limit);
}
