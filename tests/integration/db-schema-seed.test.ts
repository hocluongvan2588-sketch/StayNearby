import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeDb, dbQuery, withTransaction } from '@/lib/db';
import { runMigrations } from '@/lib/db/migrate';
import { runSeed, SEED_IDS } from '@/lib/db/seed-data';
import { addDaysIso, getTodayIsoInTimezone } from '@/lib/format';

describe('PostgreSQL schema migrations, constraints, and idempotent seed', () => {
  beforeAll(async () => {
    process.env.DATABASE_URL = '';
    process.env.PGLITE_DATA_DIR = 'memory://';
    await runMigrations();
    await runSeed();
    // Second run must succeed idempotently
    await runSeed();
  });

  afterAll(async () => {
    await closeDb();
  });

  it('seeds areas, roles, demo users, and listings accurately', async () => {
    const areas = await dbQuery<{ count: string }>('SELECT COUNT(*)::text AS count FROM areas');
    const published = await dbQuery<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM listings WHERE status = 'published'`
    );
    const totalListings = await dbQuery<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM listings'
    );

    expect(Number(areas.rows[0].count)).toBe(4);
    expect(Number(published.rows[0].count)).toBe(6);
    expect(Number(totalListings.rows[0].count)).toBe(8);
  });

  it('enforces UNIQUE(listing_id, night_date) on occupancy_nights and rolls back overlapping lock', async () => {
    const todayVn = getTodayIsoInTimezone('Asia/Ho_Chi_Minh');
    // Seed already inserted host_block on today+20 and today+21 for tayHoLoft
    const conflictDate = addDaysIso(todayVn, 20);
    const freeAdjacentDate = addDaysIso(todayVn, 19);

    await expect(
      withTransaction(async (tx) => {
        // First insert succeeds inside tx
        await tx.query(
          `INSERT INTO occupancy_nights (listing_id, night_date, source_type, block_reason, created_by)
           VALUES ($1, $2::date, 'host_block', 'Tx test 1', $3)`,
          [SEED_IDS.listings.tayHoLoft, freeAdjacentDate, SEED_IDS.users.host1]
        );
        // Second insert conflicts with seeded host_block -> whole tx must roll back!
        await tx.query(
          `INSERT INTO occupancy_nights (listing_id, night_date, source_type, block_reason, created_by)
           VALUES ($1, $2::date, 'host_block', 'Tx test conflict', $3)`,
          [SEED_IDS.listings.tayHoLoft, conflictDate, SEED_IDS.users.host1]
        );
      })
    ).rejects.toThrow();

    // Verify freeAdjacentDate was rolled back cleanly (no partial lock!)
    const check = await dbQuery<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM occupancy_nights
       WHERE listing_id = $1 AND night_date = $2::date`,
      [SEED_IDS.listings.tayHoLoft, freeAdjacentDate]
    );
    expect(Number(check.rows[0].count)).toBe(0);
  });

  it('enforces CHECK constraint linking occupancy_nights source_type and booking_id', async () => {
    const todayVn = getTodayIsoInTimezone('Asia/Ho_Chi_Minh');
    const someDate = addDaysIso(todayVn, 45);

    await expect(
      dbQuery(
        `INSERT INTO occupancy_nights (listing_id, night_date, source_type, booking_id)
         VALUES ($1, $2::date, 'booking', NULL)`,
        [SEED_IDS.listings.tayHoStudio, someDate]
      )
    ).rejects.toThrow();
  });
});
