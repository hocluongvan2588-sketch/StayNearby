import { closeDb } from '../src/lib/db';
import { runMigrations } from '../src/lib/db/migrate';
import { runSeed } from '../src/lib/db/seed-data';

async function main() {
  await runMigrations();
  await runSeed();
  console.log('[db:seed] Vietnam NomadStays demo database seeded successfully.');
  await closeDb();
}

main().catch((err) => {
  console.error('[db:seed] Failed:', err);
  process.exit(1);
});
