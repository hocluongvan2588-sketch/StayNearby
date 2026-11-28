/**
 * Convert legacy `stays.nearby_coworking` JSONB entries into first-class
 * `places` + `stay_nearby_places` rows (Local Discovery plan B9).
 *
 * DRY-RUN by default — prints the full plan (creates, links, duplicates,
 * missing data) without writing anything. Pass `--apply` to execute.
 *
 * Safety rules:
 *  - Idempotent: re-running never creates duplicate places or links
 *    (deterministic global-unique slugs + PRIMARY KEY(stay_id, place_id)).
 *  - Never auto-verifies: new places get verification_status='unverified'.
 *  - Preserves provenance: data_source='host_coworking_legacy', link
 *    source='host_suggested', suggested_by = stay host.
 *  - No invented data: no address/lat/lng/hours/price written. `dayPassVnd`
 *    and `hasCallBooth` stay in the JSONB (column is NOT dropped).
 *  - Dedupe: within legacy + against existing places by normalized name in
 *    the SAME destination (brand branches stay separate rows).
 *
 * Usage:
 *   npx tsx scripts/convert-nearby-coworking.ts            # dry-run
 *   npx tsx scripts/convert-nearby-coworking.ts --apply    # execute
 */
import { closeDb, dbQuery, dbTransaction } from '../src/lib/db';

interface CoworkingEntry {
  name: string;
  noteEn?: string;
  noteVi?: string;
  dayPassVnd?: number;
  distanceKm?: number;
  hasCallBooth?: boolean;
}

interface StayRow {
  [key: string]: unknown;
  id: string;
  slug: string;
  host_id: string | null;
  destination_id: string;
  entries: CoworkingEntry[];
}

interface PlaceRow {
  [key: string]: unknown;
  id: string;
  destination_id: string;
  name: string;
  slug: string;
  data_source: string;
}

type CreatePlan = {
  kind: 'create';
  stay: StayRow;
  entry: CoworkingEntry;
  slug: string;
  onsite: boolean;
};
type LinkPlan = {
  kind: 'link';
  stay: StayRow;
  entry: CoworkingEntry;
  placeId: string; // resolved place id, or `(new:<slug>)` placeholder
  placeName: string;
  via: 'existing-curated' | 'legacy-existing' | 'legacy-new';
  onsite: boolean;
};
type Plan = CreatePlan | LinkPlan;

const APPLY = process.argv.includes('--apply');

/** Lowercase, strip diacritics/punctuation → comparable key. */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'place'
  );
}

/** Deterministic per-destination suffix so global-unique slugs are stable. */
function placeSlug(name: string, destinationId: string): string {
  // Use the TAIL of the uuid — demo dest ids share the same prefix.
  const destKey = destinationId.replace(/-/g, '').slice(-6);
  return `${slugify(name)}-${destKey}`;
}

/** "1.2" → "1,2 km"; 0/undefined → "" (distance unknown / onsite). */
function distanceLabel(km: unknown): string {
  const n = Number(km);
  if (!km || !Number.isFinite(n) || n <= 0) return '';
  return `${String(n).replace('.', ',')} km`;
}

async function main() {
  const staysRes = await dbQuery<StayRow>(
    `SELECT s.id, s.slug, s.host_id, s.destination_id, s.nearby_coworking AS entries
     FROM stays s
     WHERE jsonb_array_length(coalesce(s.nearby_coworking, '[]'::jsonb)) > 0
     ORDER BY s.slug`
  );

  const placesRes = await dbQuery<PlaceRow>(
    `SELECT id, destination_id, name, slug, data_source FROM places`
  );

  const existingByKey = new Map<string, PlaceRow>();
  const legacyByKey = new Map<string, PlaceRow>();
  for (const p of placesRes.rows) {
    const key = `${p.destination_id}:${normalizeName(p.name)}`;
    if (!existingByKey.has(key)) existingByKey.set(key, p);
    if (p.data_source === 'host_coworking_legacy' && !legacyByKey.has(key)) {
      legacyByKey.set(key, p);
    }
  }

  const plans: Plan[] = [];
  const createByKey = new Map<string, CreatePlan>(); // dest+norm → create plan (this run)
  const missingData: string[] = [];
  const priceKept: string[] = [];

  for (const stay of staysRes.rows) {
    const entries = Array.isArray(stay.entries) ? stay.entries : [];
    for (const entry of entries) {
      const name = String(entry.name ?? '').trim();
      if (!name) {
        missingData.push(`${stay.slug}: entry missing name — SKIPPED`);
        continue;
      }
      if (entry.dayPassVnd !== undefined && entry.dayPassVnd !== null) {
        priceKept.push(
          `${stay.slug} · ${name}: dayPassVnd=${entry.dayPassVnd} (kept in JSONB only; NOT mapped to price_range)`
        );
      }
      if (entry.distanceKm === undefined) {
        missingData.push(`${stay.slug} · ${name}: no distanceKm → distance_label empty`);
      }

      const key = `${stay.destination_id}:${normalizeName(name)}`;
      const onsite = /in-house/i.test(name) && Number(entry.distanceKm ?? 1) === 0;

      const existing = existingByKey.get(key);
      if (existing) {
        plans.push({
          kind: 'link',
          stay,
          entry,
          placeId: existing.id,
          placeName: existing.name,
          via: existing.data_source === 'host_coworking_legacy' ? 'legacy-existing' : 'existing-curated',
          onsite: false,
        });
        continue;
      }
      const priorLegacy = legacyByKey.get(key);
      if (priorLegacy) {
        plans.push({
          kind: 'link',
          stay,
          entry,
          placeId: priorLegacy.id,
          placeName: priorLegacy.name,
          via: 'legacy-existing',
          onsite: false,
        });
        continue;
      }
      const dup = createByKey.get(key);
      if (dup) {
        plans.push({
          kind: 'link',
          stay,
          entry,
          placeId: `(new:${dup.slug})`,
          placeName: dup.entry.name,
          via: 'legacy-new',
          onsite: false,
        });
        continue;
      }
      const slug = placeSlug(name, stay.destination_id);
      const create: CreatePlan = { kind: 'create', stay, entry, slug, onsite };
      createByKey.set(key, create);
      plans.push(create);
    }
  }

  // ---------- Report ----------
  const creates = plans.filter((p): p is CreatePlan => p.kind === 'create');
  const links = plans.filter((p): p is LinkPlan => p.kind === 'link');

  console.log('==========================================================');
  console.log(`nearby_coworking conversion — ${APPLY ? 'APPLY' : 'DRY-RUN'}`);
  console.log('==========================================================');
  console.log(`Stays with legacy data : ${staysRes.rows.length}`);
  console.log(
    `Legacy entries total   : ${staysRes.rows.reduce(
      (n, s) => n + (Array.isArray(s.entries) ? s.entries.length : 0),
      0
    )}`
  );
  console.log(`Existing places loaded : ${placesRes.rows.length}`);
  console.log('');
  console.log('--- Per-entry plan ---');
  for (const p of plans) {
    if (p.kind === 'create') {
      console.log(
        `  [CREATE NEW ] ${p.stay.slug} · "${p.entry.name}" → places(slug=${p.slug}, cat=coworking, data_source=host_coworking_legacy, unverified${p.onsite ? ', IS_ONSITE' : ''}) + link(host_suggested, ${distanceLabel(p.entry.distanceKm) || 'no distance'})`
      );
    } else if (p.via === 'existing-curated') {
      console.log(
        `  [LINK CURATED] ${p.stay.slug} · "${p.entry.name}" → existing place "${p.placeName}" + link(host_suggested, ${distanceLabel(p.entry.distanceKm) || 'no distance'})`
      );
    } else if (p.via === 'legacy-existing') {
      console.log(
        `  [LINK LEGACY] ${p.stay.slug} · "${p.entry.name}" → legacy place "${p.placeName}" + link(host_suggested, ${distanceLabel(p.entry.distanceKm) || 'no distance'})`
      );
    } else {
      console.log(
        `  [DEDUPE→NEW ] ${p.stay.slug} · "${p.entry.name}" → same new place as an earlier legacy entry (${p.placeId}) + link(host_suggested, ${distanceLabel(p.entry.distanceKm) || 'no distance'})`
      );
    }
  }

  console.log('');
  console.log('--- Duplicates inside legacy (same normalized name + destination) ---');
  const byKey = new Map<string, string[]>();
  for (const stay of staysRes.rows) {
    for (const e of Array.isArray(stay.entries) ? stay.entries : []) {
      const k = `${stay.destination_id}:${normalizeName(String(e.name ?? ''))}`;
      byKey.set(k, [...(byKey.get(k) ?? []), `${stay.slug} (dist=${e.distanceKm}km, dayPass=${e.dayPassVnd})`]);
    }
  }
  let dupGroups = 0;
  for (const [k, occurrences] of byKey) {
    if (occurrences.length > 1) {
      dupGroups++;
      console.log(`  • ${k.split(':')[1]} — ${occurrences.length} entries: ${occurrences.join(' | ')}`);
    }
  }
  if (dupGroups === 0) console.log('  (none)');

  console.log('');
  console.log('--- Matches against existing places (same destination + normalized name) ---');
  let matchCount = 0;
  for (const p of links) {
    if (p.via === 'existing-curated' || p.via === 'legacy-existing') {
      matchCount++;
      console.log(`  • "${p.entry.name}" ≈ place "${p.placeName}" [${p.via}] ← ${p.stay.slug}`);
    }
  }
  if (matchCount === 0) console.log('  (none)');

  console.log('');
  console.log('--- Missing / not-invented data ---');
  if (missingData.length === 0) console.log('  All entries have name + distanceKm.');
  for (const m of missingData) console.log(`  • ${m}`);
  console.log(
    "  • No entry carries address/lat/lng/hours — new places keep address='', lat/lng NULL, opening_hours='', price_range='' (honest empties)."
  );

  console.log('');
  console.log('--- Price data (preserved in JSONB, NOT mapped) ---');
  for (const p of priceKept) console.log(`  • ${p}`);

  const linkTotal = creates.reduce((n, c) => n + 1, 0) + links.length;
  console.log('');
  console.log('--- Summary ---');
  console.log(`  Places to CREATE : ${creates.length}`);
  console.log(`  Links to ensure  : ${plans.length} (ON CONFLICT DO NOTHING — re-run safe)`);

  if (!APPLY) {
    console.log('');
    console.log('DRY-RUN only — no rows written. Re-run with --apply after approval.');
    await closeDb();
    return;
  }

  // ---------- Apply ----------
  let placesCreated = 0;
  let linksCreated = 0;
  let linksSkipped = 0;

  await dbTransaction(async (tx) => {
    // Pass 1 — create missing places (one row per dest+normalized name)
    const slugToId = new Map<string, string>();
    for (const p of creates) {
      const prior = await tx.query<{ id: string }>(
        `SELECT id FROM places WHERE slug = $1
          OR (destination_id = $2
              AND data_source = 'host_coworking_legacy'
              AND lower(regexp_replace(name, '[^a-z0-9]+', ' ', 'gi'))
                  = lower(regexp_replace($3, '[^a-z0-9]+', ' ', 'gi')))
          LIMIT 1`,
        [p.slug, p.stay.destination_id, p.entry.name]
      );
      if (prior.rows[0]) {
        slugToId.set(p.slug, prior.rows[0].id);
        continue;
      }
      const ins = await tx.query<{ id: string }>(
        `INSERT INTO places (
           id, destination_id, category, slug, name, address,
           description_en, description_vi, price_range, opening_hours,
           data_source, verification_status, last_verified_at,
           is_featured, image_url, is_onsite, created_by
         ) VALUES (
           gen_random_uuid(), $1, 'coworking', $2, $3, '',
           $4, $5, '', '',
           'host_coworking_legacy', 'unverified', NULL,
           FALSE, '', $6, 'legacy_migration'
         ) RETURNING id`,
        [
          p.stay.destination_id,
          p.slug,
          p.entry.name.trim(),
          String(p.entry.noteEn ?? '').slice(0, 1500),
          String(p.entry.noteVi ?? '').slice(0, 1500),
          p.onsite,
        ]
      );
      slugToId.set(p.slug, ins.rows[0].id);
      placesCreated++;
    }

    // Pass 2 — ensure links (PK(stay_id, place_id) makes this idempotent)
    for (const p of plans) {
      const stay = p.stay;
      const entry = p.entry;
      const onsite = p.kind === 'create' ? p.onsite : false;
      let placeId: string;
      if (p.kind === 'create') {
        placeId = slugToId.get(p.slug) ?? '';
      } else if (p.placeId.startsWith('(new:')) {
        const slug = p.placeId.slice(5, -1);
        placeId = slugToId.get(slug) ?? '';
        if (!placeId) {
          const q = await tx.query<{ id: string }>(`SELECT id FROM places WHERE slug = $1`, [slug]);
          placeId = q.rows[0] ? q.rows[0].id : '';
        }
      } else {
        placeId = p.placeId;
      }
      if (!placeId) {
        console.warn(`  !! unresolved place for "${entry.name}" (${stay.slug}) — link skipped`);
        continue;
      }
      const res = await tx.query(
        `INSERT INTO stay_nearby_places (stay_id, place_id, distance_label, source, suggested_by, host_note, created_at)
         VALUES ($1, $2, $3, 'host_suggested', $4, '', NOW())
         ON CONFLICT (stay_id, place_id) DO NOTHING`,
        [stay.id, placeId, onsite ? '' : distanceLabel(entry.distanceKm), stay.host_id]
      );
      if (res.rowCount > 0) linksCreated++;
      else linksSkipped++;
    }
  });

  console.log('');
  console.log('========== APPLY RESULT ==========');
  console.log(`  Places created : ${placesCreated}`);
  console.log(`  Links created  : ${linksCreated}`);
  console.log(`  Links already  : ${linksSkipped} (skipped — idempotent)`);
  console.log('  JSONB column stays untouched (stays.nearby_coworking preserved).');
  await closeDb();
}

main().catch((err) => {
  console.error('[convert-nearby-coworking] Failed:', err);
  process.exit(1);
});
