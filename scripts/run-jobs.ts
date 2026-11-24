import { runMigrations } from '@/lib/db/migrate';
import { closeDb } from '@/lib/db';
import { runOperationalMaintenance } from '@/modules/ops';

async function main() {
  await runMigrations();
  const result = await runOperationalMaintenance({ triggeredBy: 'cli' });
  console.log('[ops:run] Maintenance completed:', JSON.stringify(result, null, 2));
}

main()
  .catch((err) => {
    console.error('[ops:run] Failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
  });
