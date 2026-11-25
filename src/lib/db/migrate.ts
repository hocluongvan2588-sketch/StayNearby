import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { resolveMigrationsDir, runWithDbBootstrap } from '@/lib/config';
import { dbExec, dbQuery } from './index';

export async function runMigrations(): Promise<{ applied: string[]; skipped: string[] }> {
  return runWithDbBootstrap(async () => {
    await dbExec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    const existing = await dbQuery<{ filename: string }>(
      'SELECT filename FROM schema_migrations'
    );
    const appliedSet = new Set(existing.rows.map((r) => r.filename));

    const migrationsDir = resolveMigrationsDir();
    const files = readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    const applied: string[] = [];
    const skipped: string[] = [];

    for (const file of files) {
      if (appliedSet.has(file)) {
        skipped.push(file);
        continue;
      }
      const sql = readFileSync(path.join(migrationsDir, file), 'utf-8');
      await dbExec(sql);
      await dbQuery(
        'INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING',
        [file]
      );
      applied.push(file);
    }

    return { applied, skipped };
  });
}
