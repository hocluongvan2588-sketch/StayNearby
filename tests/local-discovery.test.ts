import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import crypto from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SessionUser } from '@/lib/auth/session';
import { closeDb, dbQuery, ensureDbReady } from '@/lib/db';
import { haversineMeters, roundDistanceMeters } from '@/lib/geo';
import { formatDistanceMeters } from '@/lib/i18n';
import { parseGoogleMapsCoords, isGoogleMapsUrl } from '@/lib/google-maps';
import { rankStayPlaces } from '@/lib/discovery-ranking';
import { PLACE_CATEGORIES, PLACE_CATEGORY_LABELS } from '@/lib/place-categories';
import { createDraftStay } from '@/modules/host';
import {
  createStayLocalSuggestion,
  listStayLocalPlaces,
  searchExistingPlaces,
  unlinkStayLocalPlace,
  updateStayLocalSuggestion,
} from '@/modules/host-local-places';
import { listPlaceSuggestions, reviewPlaceSuggestion } from '@/modules/admin-bos';
import { getAdminActorContext } from '@/modules/admin-rbac';
import { getStayDetailBySlug } from '@/modules/catalog';

let tempDir: string;

async function createUser(email: string, role: 'host' | 'admin'): Promise<SessionUser> {
  await dbQuery(
    `INSERT INTO users (id, email, password_hash, full_name, role, nationality, phone)
     VALUES ($1, $2, 'test-hash', $3, $4, 'VN', NULL)
     ON CONFLICT (email) DO NOTHING`,
    [crypto.randomUUID(), email, role === 'admin' ? 'LD Test Admin' : 'LD Test Host', role]
  );
  const res = await dbQuery<{ id: string; email: string; full_name: string; role: string }>(
    'SELECT id, email, full_name, role FROM users WHERE email = $1',
    [email]
  );
  const u = res.rows[0]!;
  return {
    id: String(u.id),
    email: String(u.email),
    fullName: String(u.full_name),
    role: u.role as SessionUser['role'],
    nationality: 'VN',
    membershipTier: 'free',
    membershipExpiresAt: null,
    rewardCreditVnd: 0,
    vatTaxId: null,
    preferredLocale: 'en',
    preferredCurrency: 'USD',
    phone: null,
  };
}

beforeAll(async () => {
  tempDir = mkdtempSync(join(tmpdir(), 'vietnomad-local-discovery-'));
  process.env.PGLITE_DATA_DIR = tempDir;
  process.env.VIETNOMAD_DATA_DIR = tempDir;
  process.env.DATABASE_URL = '';
  await closeDb();
  await ensureDbReady();
});

afterAll(async () => {
  await closeDb();
  rmSync(tempDir, { recursive: true, force: true });
});

describe('Google Maps URL parsing (no paid API)', () => {
  it('extracts coordinates from common share-link shapes', () => {
    expect(parseGoogleMapsCoords('https://www.google.com/maps/@10.7769,106.7009,15z')).toEqual({
      lat: 10.7769,
      lng: 106.7009,
    });
    expect(parseGoogleMapsCoords('https://maps.google.com/?q=10.7769,106.7009')).toEqual({
      lat: 10.7769,
      lng: 106.7009,
    });
    expect(
      parseGoogleMapsCoords('https://www.google.com/maps/place/Cafe/@10.7769,106.7009,17z')
    ).toEqual({ lat: 10.7769, lng: 106.7009 });
    expect(parseGoogleMapsCoords('https://maps.app.goo.gl/abc123')).toBeNull();
    expect(parseGoogleMapsCoords('not a url')).toBeNull();
    expect(parseGoogleMapsCoords('')).toBeNull();
    // out-of-range coordinates are rejected
    expect(parseGoogleMapsCoords('https://www.google.com/maps/@999,999,15z')).toBeNull();
  });

  it('recognizes Maps domains without requiring coordinates', () => {
    expect(isGoogleMapsUrl('https://www.google.com/maps/place/X')).toBe(true);
    expect(isGoogleMapsUrl('https://maps.app.goo.gl/xyz')).toBe(true);
    expect(isGoogleMapsUrl('https://example.com/maps')).toBe(false);
  });
});

describe('geo helpers + privacy rounding', () => {
  it('haversine computes plausible straight-line distances', () => {
    // ~1.1 km apart in Hanoi
    const d = haversineMeters(21.0285, 105.8542, 21.038, 105.855);
    expect(d).not.toBeNull();
    expect(d!).toBeGreaterThan(900);
    expect(d!).toBeLessThan(1400);
    expect(haversineMeters(null, 1, 2, 3)).toBeNull();
  });

  it('rounds distances so exact stay coordinates cannot be reconstructed', () => {
    expect(roundDistanceMeters(812)).toBe(800);
    expect(roundDistanceMeters(830)).toBe(850);
    expect(roundDistanceMeters(1234)).toBe(1200);
    expect(roundDistanceMeters(47)).toBe(50);
  });

  it('formats distances bilingually without inventing walk times', () => {
    expect(formatDistanceMeters(800, 'vi')).toBe('≈800 m');
    expect(formatDistanceMeters(1200, 'vi')).toBe('≈1,2 km');
    expect(formatDistanceMeters(1200, 'en')).toBe('≈1.2 km');
    expect(formatDistanceMeters(2000, 'en')).toBe('≈2 km');
    expect(formatDistanceMeters(null, 'vi')).toBe('');
  });
});

describe('stay place ranking (spec §7 tiers)', () => {
  const radii = { cafe: 1000, restaurant: 2000, attraction: 30000 };
  const base = {
    isFeatured: false,
    isOnsite: false,
    linkSource: null as 'curated' | 'host_suggested' | null,
  };

  it('orders onsite → host-approved → curated → radius → featured/fill', () => {
    const ranked = rankStayPlaces(
      [
        { id: 'far-plain', name: 'Far plain', category: 'cafe', ...base, lat: 10.9, lng: 106.9 },
        { id: 'featured', name: 'Featured cafe', category: 'cafe', ...base, lat: 10.9, lng: 106.9, isFeatured: true },
        { id: 'in-radius', name: 'Nearby cafe', category: 'cafe', ...base, lat: 10.781, lng: 106.701 },
        { id: 'curated-link', name: 'Linked', category: 'cafe', ...base, lat: null, lng: null, linkSource: 'curated' as const },
        { id: 'host-link', name: 'Host pick', category: 'restaurant', ...base, lat: null, lng: null, linkSource: 'host_suggested' as const },
        { id: 'onsite', name: 'Lobby cafe', category: 'cafe', ...base, lat: null, lng: null, isOnsite: true },
      ],
      { stayLat: 10.78, stayLng: 106.7, radiiMeters: radii }
    );
    expect(ranked.map((r) => r.id)).toEqual([
      'onsite',
      'host-link',
      'curated-link',
      'in-radius',
      'featured',
      'far-plain',
    ]);
    expect(ranked[0].tier).toBe(1);
    expect(ranked[1].tier).toBe(2);
    expect(ranked[2].tier).toBe(3);
    expect(ranked[3].tier).toBe(4);
    expect(ranked[4].tier).toBe(5);
    // distance only when stay has coordinates
    expect(ranked[3].distanceMeters).not.toBeNull();
    expect(ranked[2].distanceMeters).toBeNull();
  });

  it('skips the radius tier when the stay has no coordinates (never fabricates)', () => {
    const ranked = rankStayPlaces(
      [{ id: 'near', name: 'Near', category: 'cafe', ...base, lat: 10.7801, lng: 106.7001 }],
      { stayLat: null, stayLng: null, radiiMeters: radii }
    );
    expect(ranked[0].tier).toBe(5);
    expect(ranked[0].distanceMeters).toBeNull();
  });

  it('respects the limit and never dedupes by name (branches stay distinct)', () => {
    const ranked = rankStayPlaces(
      [
        { id: 'a1', name: 'Chain Coffee', category: 'cafe', ...base, lat: null, lng: null },
        { id: 'a2', name: 'Chain Coffee', category: 'cafe', ...base, lat: null, lng: null },
      ],
      { stayLat: null, stayLng: null, radiiMeters: radii, limit: 1 }
    );
    expect(ranked).toHaveLength(1);
    const both = rankStayPlaces(
      [
        { id: 'a1', name: 'Chain Coffee', category: 'cafe', ...base, lat: null, lng: null },
        { id: 'a2', name: 'Chain Coffee', category: 'cafe', ...base, lat: null, lng: null },
      ],
      { stayLat: null, stayLng: null, radiiMeters: radii }
    );
    expect(both).toHaveLength(2);
  });
});

describe('place taxonomy stays a single shared system', () => {
  it('has labels for every category and no extras', () => {
    expect(PLACE_CATEGORIES).toHaveLength(11);
    for (const c of PLACE_CATEGORIES) {
      expect(PLACE_CATEGORY_LABELS[c]).toBeTruthy();
    }
    expect(Object.keys(PLACE_CATEGORY_LABELS).sort()).toEqual([...PLACE_CATEGORIES].sort());
  });
});

describe('host suggestion → moderation → guest display (RBAC + no auto-publish)', () => {
  it('runs the full lifecycle on a real database', async () => {
    const host = await createUser('ld-host-1@test.local', 'host');
    const otherHost = await createUser('ld-host-2@test.local', 'host');
    const admin = await createUser('ld-admin-1@test.local', 'admin');
    const stay = await createDraftStay(host, { titleEn: 'Local Discovery Test Loft' });

    // --- ownership enforced at the backend ---
    await expect(
      createStayLocalSuggestion(otherHost, stay.id, {
        name: 'Intruder Cafe',
        category: 'cafe',
        address: '1 Other Street',
      })
    ).rejects.toThrow(/own this property/i);

    // --- new-place suggestion lands as pending, nothing public yet ---
    const sug = await createStayLocalSuggestion(host, stay.id, {
      name: 'Banh Mi Corner LD',
      category: 'restaurant',
      address: '5 Test Lane, Da Nang',
      googleMapsUrl: 'https://www.google.com/maps/@16.0544,108.2022,17z',
      reason: 'Best breakfast within a short walk',
      distanceLabel: '5 min walk',
    });
    expect(sug.deduplicated).toBe(false);

    const beforeApprove = await listStayLocalPlaces(host, stay.id);
    expect(beforeApprove.links).toHaveLength(0);
    expect(beforeApprove.suggestions[0]?.status).toBe('pending');

    // guest query must not see anything before moderation
    const detailBefore = await getStayDetailBySlug(stay.slug);
    expect(detailBefore?.localPlaces.some((p) => p.name === 'Banh Mi Corner LD')).toBe(false);

    // --- non-owner cannot edit someone else's suggestion ---
    await expect(
      updateStayLocalSuggestion(otherHost, stay.id, sug.id, { name: 'Hijacked' })
    ).rejects.toThrow(/own this property/i);

    // --- admin approves → place created + linked in one step ---
    const actor = await getAdminActorContext(admin);
    const review = await reviewPlaceSuggestion(actor, sug.id, { action: 'approve', note: 'Looks good' });
    expect(review.status).toBe('approved');
    expect(review.placeId).toBeTruthy();

    const afterApprove = await listStayLocalPlaces(host, stay.id);
    expect(afterApprove.links).toHaveLength(1);
    expect(afterApprove.links[0].source).toBe('host_suggested');
    expect(afterApprove.links[0].hostNote).toBe('Best breakfast within a short walk');
    expect(afterApprove.suggestions[0].status).toBe('approved');
    expect(afterApprove.suggestions[0].linked).toBe(true);

    // duplicate moderation is blocked
    await expect(
      reviewPlaceSuggestion(actor, sug.id, { action: 'approve' })
    ).rejects.toThrow(/already approved/i);

    // --- guest detail now shows the place with provenance ---
    const detail = await getStayDetailBySlug(stay.slug);
    const shown = detail?.localPlaces.find((p) => p.name === 'Banh Mi Corner LD');
    expect(shown).toBeTruthy();
    expect(shown?.linkSource).toBe('host_suggested');
    expect(shown?.hostNote).toBe('Best breakfast within a short walk');
    // stay has no pinned coordinates → no fabricated distance
    expect(shown?.distanceMeters ?? null).toBeNull();

    // --- search finds the verified place for linking elsewhere ---
    const hits = await searchExistingPlaces(host, stay.id, 'Banh Mi Corner');
    expect(hits.some((h) => h.name === 'Banh Mi Corner LD')).toBe(true);

    // --- rejection path: never public, resubmittable ---
    const sug2 = await createStayLocalSuggestion(host, stay.id, {
      name: 'Mystery Spot LD',
      category: 'attraction',
      address: 'Nowhere',
    });
    await reviewPlaceSuggestion(actor, sug2.id, { action: 'reject', note: 'Cannot verify' });
    const afterReject = await listStayLocalPlaces(host, stay.id);
    const rejected = afterReject.suggestions.find((s) => s.id === sug2.id);
    expect(rejected?.status).toBe('rejected');
    expect(rejected?.linked).toBe(false);
    const detailAfterReject = await getStayDetailBySlug(stay.slug);
    expect(detailAfterReject?.localPlaces.some((p) => p.name === 'Mystery Spot LD')).toBe(false);

    const resubmit = await updateStayLocalSuggestion(host, stay.id, sug2.id, {
      reason: 'Added opening details from the owner',
    });
    expect(resubmit.status).toBe('pending');

    // --- unlink removes ONLY the listing relationship ---
    const placeId = review.placeId!;
    const unlinked = await unlinkStayLocalPlace(host, stay.id, placeId);
    expect(unlinked.ok).toBe(true);
    const afterUnlink = await listStayLocalPlaces(host, stay.id);
    expect(afterUnlink.links).toHaveLength(0);
    const placeRow = await dbQuery<{ id: string }>('SELECT id FROM places WHERE id = $1', [placeId]);
    expect(placeRow.rows).toHaveLength(1); // shared place survives

    // hosts cannot delete curated links (none here → forbidden anyway for missing source)
    await expect(unlinkStayLocalPlace(otherHost, stay.id, placeId)).rejects.toThrow(
      /own this property/i
    );

    // --- moderation queue view ---
    const queue = await listPlaceSuggestions({ status: 'pending' });
    expect(queue.suggestions.some((s) => s.id === sug2.id)).toBe(true);
    expect(queue.suggestions.every((s) => 'hostName' in s && 'stayTitle' in s)).toBe(true);
  });

  it('place interaction events pass the database constraint (tracking schema)', async () => {
    const dest = await dbQuery<{ id: string }>('SELECT id FROM destinations LIMIT 1');
    expect(dest.rows.length).toBe(1);
    const placeId = crypto.randomUUID();
    await dbQuery(
      `INSERT INTO places (id, destination_id, category, slug, name, address)
       VALUES ($1, $2, 'cafe', $3, 'Tracking Test Cafe', '1 Track St')`,
      [placeId, dest.rows[0].id, `track-${placeId.slice(0, 8)}`]
    );
    const sessionKey = `ld-test-${crypto.randomUUID().slice(0, 8)}`;
    for (const ev of ['place_detail_view', 'place_map_click', 'place_website_click']) {
      await dbQuery(
        `INSERT INTO attribution_events (id, session_key, event_name, place_id, dedupe_key, landing_path)
         VALUES ($1, $2, $3, $4, $5, '/stays/test')`,
        [crypto.randomUUID(), sessionKey, ev, placeId, `${sessionKey}:${ev}`]
      );
    }
    const res = await dbQuery<{ event_name: string }>(
      'SELECT event_name FROM attribution_events WHERE session_key = $1 ORDER BY event_name',
      [sessionKey]
    );
    expect(res.rows.map((r) => r.event_name)).toEqual([
      'place_detail_view',
      'place_map_click',
      'place_website_click',
    ]);
  });
});
