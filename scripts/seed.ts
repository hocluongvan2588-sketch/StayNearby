import { closeDb, getDbMode } from '../src/lib/db';
import { runMigrations } from '../src/lib/db/migrate';
import { runSeed } from '../src/lib/db/seed-data';

async function main() {
  console.log(`[db:seed] Ensuring migrations & seeding demo data (mode=${getDbMode()})...`);
  await runMigrations();
  await runSeed();
  console.log('[db:seed] Seed completed successfully.');
  await closeDb();
}

main().catch(async (err) => {
  console.error('[db:seed] Failed:', err);
  await closeDb();
  process.exit(1);
});
