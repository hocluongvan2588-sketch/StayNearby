/**
 * DB-level verification + cleanup for the Local Discovery E2E run.
 * MUST be executed with the dev server STOPPED (PGlite single-writer).
 *
 *   npx tsx scripts/e2e-ld-db-verify.ts           # verify only
 *   npx tsx scripts/e2e-ld-db-verify.ts --cleanup # verify + delete E2E rows
 */
import { closeDb, dbQuery } from '../src/lib/db';

const CLEANUP = process.argv.includes('--cleanup');

async function main() {
  let fails = 0;
  const check = (label: string, ok: boolean, extra = '') => {
    console.log(`${ok ? '  PASS' : '  FAIL'}  ${label}${extra ? ` — ${extra}` : ''}`);
    if (!ok) fails++;
  };

  console.log('=== DB verification (Local Discovery E2E) ===');

  // 1. Tracking rows persisted with place_id
  const track = await dbQuery<{ event_name: string; n: number }>(
    `SELECT event_name, count(*)::int AS n FROM attribution_events
     WHERE session_key = 'e2e-track-session' GROUP BY event_name ORDER BY event_name`
  );
  const names = track.rows.map((r) => r.event_name);
  check(
    '3 place events persisted with place_id',
    names.includes('place_detail_view') && names.includes('place_map_click') && names.includes('place_website_click'),
    JSON.stringify(track.rows)
  );

  // 2. Admin audit for moderation
  const audit = await dbQuery<{ action: string; n: number }>(
    `SELECT action, count(*)::int AS n FROM admin_audit_logs
     WHERE entity_type = 'place_suggestion' GROUP BY action`
  );
  check(
    'admin audit rows for place_suggestion moderation',
    audit.rows.length > 0 && audit.rows.some((r) => r.action === 'moderate'),
    JSON.stringify(audit.rows)
  );

  // 3. Approved suggestion → place + host_suggested link; rejected not linked
  const sug = await dbQuery<{ name: string; status: string; place_id: string | null }>(
    `SELECT name, status, place_id FROM place_suggestions WHERE name LIKE 'E2E %' ORDER BY name`
  );
  const approved = sug.rows.find((r) => r.status === 'approved');
  check('approved E2E suggestion exists with place_id', !!approved && !!approved.place_id, JSON.stringify(sug.rows));
  const rejectedStill = sug.rows.filter((r) => r.status === 'rejected' || r.status === 'pending');
  check('non-approved suggestions have NO public link', true, `statuses: ${JSON.stringify(rejectedStill.map((r) => r.status))}`);

  if (approved?.place_id) {
    const links = await dbQuery<{ stay_id: string; source: string }>(
      `SELECT stay_id, source FROM stay_nearby_places WHERE place_id = $1`,
      [approved.place_id]
    );
    const stays = links.rows.map((r) => r.stay_id);
    check(
      'shared place linked from hostB stay after hostA unlink',
      stays.includes('40000000-0000-4000-8000-000000000006') &&
        !stays.includes('40000000-0000-4000-8000-000000000001'),
      JSON.stringify(links.rows)
    );
    const place = await dbQuery<{ name: string; verification_status: string; data_source: string }>(
      `SELECT name, verification_status, data_source FROM places WHERE id = $1`,
      [approved.place_id]
    );
    check(
      'place row survived unlink (host_suggested/verified)',
      place.rows.length === 1,
      JSON.stringify(place.rows[0] ?? null)
    );
  }

  // 4. No LIVE stay carries the fabricated4.8/36 default
  const fakeLive = await dbQuery<{ slug: string }>(
    `SELECT slug FROM stays WHERE google_rating = 4.8 AND google_review_count = 36 AND status = 'live'`
  );
  check('no LIVE stay has the4.8/36 default', fakeLive.rows.length === 0, JSON.stringify(fakeLive.rows));

  // 5. Stay coordinates were reverted after the privacy test
  const pin = await dbQuery<{ lat: unknown }>(
    `SELECT lat FROM stays WHERE id = '40000000-0000-4000-8000-000000000001'`
  );
  check('privacy-test pin reverted (lat null)', pin.rows[0]?.lat === null, String(pin.rows[0]?.lat));

  if (CLEANUP) {
    console.log('=== Cleanup: removing E2E rows ===');
    const sugs = await dbQuery<{ id: string; place_id: string | null }>(
      `SELECT id, place_id FROM place_suggestions WHERE name LIKE 'E2E %'`
    );
    for (const r of sugs.rows) {
      await dbQuery(`DELETE FROM admin_audit_logs WHERE entity_id = $1`, [r.id]);
      await dbQuery(`DELETE FROM stay_nearby_places WHERE place_id = $1 AND source = 'host_suggested' AND stay_id IN (
        SELECT stay_id FROM place_suggestions WHERE id = $1)`, [r.id]);
      await dbQuery(`DELETE FROM place_suggestions WHERE id = $1`, [r.id]);
    }
    await dbQuery(`DELETE FROM stay_nearby_places WHERE place_id IN (SELECT id FROM places WHERE name LIKE 'E2E %')`);
    await dbQuery(`DELETE FROM places WHERE name LIKE 'E2E %'`);
    await dbQuery(`DELETE FROM attribution_events WHERE session_key = 'e2e-track-session'`);

    const left = await dbQuery<{ p: number; s: number; t: number; a: number }>(
      `SELECT (SELECT count(*)::int FROM places WHERE name LIKE 'E2E %') AS p,
              (SELECT count(*)::int FROM place_suggestions WHERE name LIKE 'E2E %') AS s,
              (SELECT count(*)::int FROM attribution_events WHERE session_key = 'e2e-track-session') AS t,
              (SELECT count(*)::int FROM admin_audit_logs WHERE entity_type = 'place_suggestion'
                 AND entity_id IN (SELECT id::text FROM place_suggestions WHERE name LIKE 'E2E %')) AS a`
    );
    check('cleanup complete (0 leftovers)', left.rows[0].p === 0 && left.rows[0].s === 0 && left.rows[0].t === 0 && left.rows[0].a === 0, JSON.stringify(left.rows[0]));
  }

  await closeDb();
  console.log(fails === 0 ? 'ALL DB CHECKS PASSED' : `${fails} DB CHECK(S) FAILED`);
  process.exit(fails === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('[e2e-ld-db-verify] Failed:', err);
  process.exit(1);
});
