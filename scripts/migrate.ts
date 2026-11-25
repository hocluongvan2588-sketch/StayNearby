import { closeDb } from '../src/lib/db';
import { runMigrations } from '../src/lib/db/migrate';

async function main() {
  const res = await runMigrations();
  console.log('[db:migrate] Applied:', res.applied.join(', ') || 'none');
  if (res.skipped.length > 0) {
    console.log('[db:migrate] Already up-to-date:', res.skipped.join(', '));
  }
  await closeDb();
}

main().catch((err) => {
  console.error('[db:migrate] Failed:', err);
  process.exit(1);
});
