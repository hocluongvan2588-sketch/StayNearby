import { closeDb, getDbMode } from '../src/lib/db';
import { runMigrations } from '../src/lib/db/migrate';

async function main() {
  console.log(`[db:migrate] Running migrations (mode=${getDbMode()})...`);
  const result = await runMigrations();
  console.log(
    `[db:migrate] Applied: ${result.applied.length ? result.applied.join(', ') : 'none'}`
  );
  console.log(
    `[db:migrate] Already up-to-date: ${result.skipped.length ? result.skipped.join(', ') : 'none'}`
  );
  await closeDb();
}

main().catch(async (err) => {
  console.error('[db:migrate] Failed:', err);
  await closeDb();
  process.exit(1);
});
