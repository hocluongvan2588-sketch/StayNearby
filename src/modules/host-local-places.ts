import type { SessionUser } from '@/lib/auth/session';
import { isValidUuid } from '@/lib/dates';
import { dbQuery, dbTransaction } from '@/lib/db';
import { AppError } from '@/lib/errors';
import { isGoogleMapsUrl, parseGoogleMapsCoords } from '@/lib/google-maps';
import { PLACE_CATEGORIES, type PlaceCategory } from '@/lib/place-categories';

/**
 * Host contributions to Local Discovery (see docs/local-discovery-plan.md).
 *
 * Hosts may (a) link an EXISTING verified place to one of their listings and
 * (b) propose a NEW place. Proposals never go public before VietNomad
 * moderation (place_suggestions.status). Hosts can only touch their own
 * stay's links/suggestions — enforced here at the backend, not in the UI.
 *
 * Commercial data (partnerships, commissions) is intentionally absent.
 */

export { PLACE_CATEGORIES };
export type { PlaceCategory };

export type PlaceSuggestionStatus = 'pending' | 'needs_info' | 'approved' | 'rejected';

interface StayOwnershipRow {
  [key: string]: unknown;
  host_id: string;
  destination_id: string;
}

async function assertOwnStay(user: SessionUser, stayId: string): Promise<StayOwnershipRow> {
  if (!isValidUuid(stayId)) throw new AppError('VALIDATION_ERROR', 'Invalid stay identifier.');
  const res = await dbQuery<StayOwnershipRow>('SELECT host_id, destination_id FROM stays WHERE id = $1', [
    stayId,
  ]);
  const stay = res.rows[0];
  if (!stay) throw new AppError('NOT_FOUND', 'Stay not found.');
  if (String(stay.host_id) !== user.id && user.role !== 'admin') {
    throw new AppError('FORBIDDEN', 'You do not own this property.');
  }
  return stay;
}

export interface StayLocalPlaceLink {
  placeId: string;
  name: string;
  category: string;
  address: string;
  imageUrl: string;
  openingHours: string;
  website: string;
  distanceLabel: string;
  hostNote: string;
  source: 'curated' | 'host_suggested';
}

export interface StayLocalPlaceSuggestion {
  id: string;
  placeId: string | null;
  name: string;
  category: string;
  address: string;
  reason: string;
  distanceLabel: string;
  imageUrl: string;
  googleMapsUrl: string;
  status: PlaceSuggestionStatus;
  reviewNote: string;
  linked: boolean;
  createdAt: string;
}

export async function listStayLocalPlaces(user: SessionUser, stayId: string) {
  await assertOwnStay(user, stayId);

  const [linksRes, sugRes] = await Promise.all([
    dbQuery<{
      id: string;
      name: string;
      category: string;
      address: string;
      image_url: string;
      opening_hours: string;
      website: string;
      distance_label: string;
      host_note: string;
      source: string;
    }>(
      `SELECT p.id, p.name, p.category, p.address, p.image_url, p.opening_hours, p.website,
              snp.distance_label, snp.host_note, snp.source
       FROM stay_nearby_places snp
       JOIN places p ON p.id = snp.place_id
       WHERE snp.stay_id = $1
       ORDER BY snp.source ASC, p.name ASC`,
      [stayId]
    ),
    dbQuery<{
      id: string;
      place_id: string | null;
      name: string;
      category: string;
      address: string;
      reason: string;
      distance_label: string;
      image_url: string;
      google_maps_url: string;
      status: string;
      review_note: string;
      created_at: string;
      linked_place_id: string | null;
    }>(
      `SELECT ps.id, ps.place_id, ps.name, ps.category, ps.address, ps.reason,
              ps.distance_label, ps.image_url, ps.google_maps_url, ps.status,
              ps.review_note, ps.created_at,
              snp.place_id AS linked_place_id
       FROM place_suggestions ps
       LEFT JOIN stay_nearby_places snp
         ON snp.stay_id = ps.stay_id AND snp.place_id = ps.place_id
       WHERE ps.stay_id = $1
       ORDER BY ps.created_at DESC`,
      [stayId]
    ),
  ]);

  return {
    links: linksRes.rows.map((r) => ({
      placeId: String(r.id),
      name: String(r.name),
      category: String(r.category),
      address: String(r.address),
      imageUrl: String(r.image_url ?? ''),
      openingHours: String(r.opening_hours ?? ''),
      website: String(r.website ?? ''),
      distanceLabel: String(r.distance_label ?? ''),
      hostNote: String(r.host_note ?? ''),
      source: r.source === 'host_suggested' ? ('host_suggested' as const) : ('curated' as const),
    })),
    suggestions: sugRes.rows.map((r) => ({
      id: String(r.id),
      placeId: r.place_id ? String(r.place_id) : null,
      name: String(r.name),
      category: String(r.category),
      address: String(r.address),
      reason: String(r.reason ?? ''),
      distanceLabel: String(r.distance_label ?? ''),
      imageUrl: String(r.image_url ?? ''),
      googleMapsUrl: String(r.google_maps_url ?? ''),
      status: String(r.status) as PlaceSuggestionStatus,
      reviewNote: String(r.review_note ?? ''),
      linked: r.linked_place_id != null,
      createdAt: new Date(r.created_at).toISOString(),
    })),
  };
}

export interface ExistingPlaceHit {
  placeId: string;
  name: string;
  category: string;
  address: string;
  imageUrl: string;
  openingHours: string;
  website: string;
}

/** Search verified places to link (same destination first). */
export async function searchExistingPlaces(
  user: SessionUser,
  stayId: string,
  q: string
): Promise<ExistingPlaceHit[]> {
  const stay = await assertOwnStay(user, stayId);
  const term = q.trim();
  const params: unknown[] = [stay.destination_id];
  let where = `p.destination_id = $1 AND p.verification_status = 'verified'`;
  if (term) {
    params.push(`%${term}%`);
    where += ` AND (p.name ILIKE $2 OR p.address ILIKE $2)`;
  }
  const res = await dbQuery<{
    id: string;
    name: string;
    category: string;
    address: string;
    image_url: string;
    opening_hours: string;
    website: string;
  }>(
    `SELECT p.id, p.name, p.category, p.address, p.image_url, p.opening_hours, p.website
     FROM places p
     WHERE ${where}
     ORDER BY p.is_featured DESC, p.name ASC
     LIMIT 8`,
    params
  );
  return res.rows.map((r) => ({
    placeId: String(r.id),
    name: String(r.name),
    category: String(r.category),
    address: String(r.address),
    imageUrl: String(r.image_url ?? ''),
    openingHours: String(r.opening_hours ?? ''),
    website: String(r.website ?? ''),
  }));
}

export interface CreateSuggestionInput {
  placeId?: string;
  name?: string;
  category?: string;
  address?: string;
  googleMapsUrl?: string;
  reason?: string;
  distanceLabel?: string;
  imageUrl?: string;
}

function assertCategory(category: string): PlaceCategory {
  if (!(PLACE_CATEGORIES as readonly string[]).includes(category)) {
    throw new AppError('VALIDATION_ERROR', 'Unknown place category.');
  }
  return category as PlaceCategory;
}

/**
 * Create a pending suggestion (never auto-published). Linking an existing
 * verified place still goes through moderation so the host's reason/distance
 * are reviewed with it.
 */
export async function createStayLocalSuggestion(
  user: SessionUser,
  stayId: string,
  input: CreateSuggestionInput
) {
  await assertOwnStay(user, stayId);
  const id = crypto.randomUUID();

  let placeId: string | null = null;
  let name = (input.name ?? '').trim();
  let category = (input.category ?? '').trim();
  let address = (input.address ?? '').trim();
  const googleMapsUrl = (input.googleMapsUrl ?? '').trim();
  let lat: number | null = null;
  let lng: number | null = null;

  if (input.placeId) {
    if (!isValidUuid(input.placeId)) throw new AppError('VALIDATION_ERROR', 'Invalid place ID.');
    const placeRes = await dbQuery<{
      id: string;
      name: string;
      category: string;
      address: string;
    }>(
      `SELECT id, name, category, address FROM places
       WHERE id = $1 AND verification_status = 'verified'`,
      [input.placeId]
    );
    const place = placeRes.rows[0];
    if (!place) throw new AppError('NOT_FOUND', 'Place not found or not verified.');
    placeId = String(place.id);
    name = String(place.name);
    category = String(place.category);
    address = String(place.address ?? '');
  } else {
    if (name.length < 2 || name.length > 160) {
      throw new AppError('VALIDATION_ERROR', 'Place name is required (2-160 characters).');
    }
    if (!category) throw new AppError('VALIDATION_ERROR', 'Place category is required.');
    assertCategory(category);
    if (googleMapsUrl && !isGoogleMapsUrl(googleMapsUrl)) {
      throw new AppError('VALIDATION_ERROR', 'Paste a Google Maps share link.');
    }
    const coords = googleMapsUrl ? parseGoogleMapsCoords(googleMapsUrl) : null;
    if (coords) {
      lat = coords.lat;
      lng = coords.lng;
    }
  }
  if (category) assertCategory(category);

  const reason = (input.reason ?? '').trim().slice(0, 500);
  const distanceLabel = (input.distanceLabel ?? '').trim().slice(0, 80);
  const imageUrl = (input.imageUrl ?? '').trim().slice(0, 600);

  const existing = placeId
    ? await dbQuery<{ id: string }>(
        `SELECT id FROM place_suggestions
         WHERE stay_id = $1 AND place_id = $2 AND suggested_by = $3 AND status IN ('pending','needs_info')
         LIMIT 1`,
        [stayId, placeId, user.id]
      )
    : { rows: [] as { id: string }[] };
  if (existing.rows[0]) return { id: String(existing.rows[0].id), deduplicated: true };

  await dbQuery(
    `INSERT INTO place_suggestions (
       id, stay_id, suggested_by, place_id, category, name, address,
       google_maps_url, lat, lng, reason, distance_label, image_url, status
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'pending')`,
    [
      id,
      stayId,
      user.id,
      placeId,
      category,
      name,
      address,
      googleMapsUrl,
      lat,
      lng,
      reason,
      distanceLabel,
      imageUrl,
    ]
  );
  return { id, deduplicated: false };
}

export interface UpdateSuggestionInput {
  name?: string;
  category?: string;
  address?: string;
  googleMapsUrl?: string;
  reason?: string;
  distanceLabel?: string;
  imageUrl?: string;
}

/** Host edits their own suggestion while it is pending/rejected (resubmits). */
export async function updateStayLocalSuggestion(
  user: SessionUser,
  stayId: string,
  suggestionId: string,
  input: UpdateSuggestionInput
) {
  await assertOwnStay(user, stayId);
  if (!isValidUuid(suggestionId)) throw new AppError('VALIDATION_ERROR', 'Invalid suggestion ID.');

  return dbTransaction(async (tx) => {
    const res = await tx.query<{
      id: string;
      suggested_by: string;
      status: string;
      place_id: string | null;
      name: string;
      category: string;
      address: string;
      google_maps_url: string;
      lat: string | number | null;
      lng: string | number | null;
      reason: string;
      distance_label: string;
      image_url: string;
    }>('SELECT * FROM place_suggestions WHERE id = $1 AND stay_id = $2 FOR UPDATE', [
      suggestionId,
      stayId,
    ]);
    const row = res.rows[0];
    if (!row) throw new AppError('NOT_FOUND', 'Suggestion not found.');
    if (String(row.suggested_by) !== user.id && user.role !== 'admin') {
      throw new AppError('FORBIDDEN', 'You did not create this suggestion.');
    }
    if (row.status === 'approved') {
      throw new AppError('VALIDATION_ERROR', 'Approved suggestions cannot be edited. Unlink it instead.');
    }

    const nextName = input.name?.trim() || String(row.name);
    if (nextName.length < 2) throw new AppError('VALIDATION_ERROR', 'Place name is required.');
    const nextCategory = input.category ? assertCategory(input.category) : String(row.category);
    const nextAddress = input.address?.trim() ?? String(row.address);
    const nextReason = (input.reason ?? String(row.reason)).trim().slice(0, 500);
    const nextDistance = (input.distanceLabel ?? String(row.distance_label)).trim().slice(0, 80);
    const nextImage = (input.imageUrl ?? String(row.image_url)).trim().slice(0, 600);

    let nextMapsUrl = String(row.google_maps_url ?? '');
    let nextLat = row.lat == null ? null : Number(row.lat);
    let nextLng = row.lng == null ? null : Number(row.lng);
    if (input.googleMapsUrl !== undefined) {
      nextMapsUrl = input.googleMapsUrl.trim().slice(0, 500);
      if (nextMapsUrl && !isGoogleMapsUrl(nextMapsUrl)) {
        throw new AppError('VALIDATION_ERROR', 'Paste a Google Maps share link.');
      }
      const coords = nextMapsUrl ? parseGoogleMapsCoords(nextMapsUrl) : null;
      nextLat = coords ? coords.lat : null;
      nextLng = coords ? coords.lng : null;
    }

    // Host edit = resubmit: rejected or needs_info → back to pending so the
    // moderation queue reflects that the host has responded.
    const nextStatus =
      row.status === 'rejected' || row.status === 'needs_info' ? 'pending' : row.status;

    await tx.query(
      `UPDATE place_suggestions
       SET name = $1, category = $2, address = $3, google_maps_url = $4,
           lat = $5, lng = $6, reason = $7, distance_label = $8, image_url = $9,
           status = $10,
           review_note = CASE WHEN $10 = 'pending' THEN '' ELSE review_note END,
           updated_at = NOW()
       WHERE id = $11`,
      [
        nextName,
        nextCategory,
        nextAddress,
        nextMapsUrl,
        nextLat,
        nextLng,
        nextReason,
        nextDistance,
        nextImage,
        nextStatus,
        suggestionId,
      ]
    );
    return { ok: true, status: nextStatus };
  });
}

/** Host edits their note on a link they introduced (not place core data). */
export async function updateStayLocalLinkNote(
  user: SessionUser,
  stayId: string,
  placeId: string,
  hostNote: string
) {
  await assertOwnStay(user, stayId);
  if (!isValidUuid(placeId)) throw new AppError('VALIDATION_ERROR', 'Invalid place ID.');
  const res = await dbQuery(
    `UPDATE stay_nearby_places
     SET host_note = $1
     WHERE stay_id = $2 AND place_id = $3 AND source = 'host_suggested'
     RETURNING place_id`,
    [hostNote.trim().slice(0, 500), stayId, placeId]
  );
  if (res.rows.length === 0) {
    throw new AppError('FORBIDDEN', 'Only places you introduced can be edited.');
  }
  return { ok: true };
}

/**
 * Unlink from THIS listing only — the shared place row is never deleted.
 * Curated (VietNomad) links are removed by admin, not by hosts.
 */
export async function unlinkStayLocalPlace(user: SessionUser, stayId: string, placeId: string) {
  await assertOwnStay(user, stayId);
  if (!isValidUuid(placeId)) throw new AppError('VALIDATION_ERROR', 'Invalid place ID.');
  const res = await dbQuery(
    `DELETE FROM stay_nearby_places
     WHERE stay_id = $1 AND place_id = $2 AND source = 'host_suggested'
     RETURNING place_id`,
    [stayId, placeId]
  );
  if (res.rows.length === 0) {
    throw new AppError(
      'FORBIDDEN',
      'Only places you introduced can be removed. Contact VietNomad for curated links.'
    );
  }
  return { ok: true };
}
