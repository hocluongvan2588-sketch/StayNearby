import fs from 'fs';
import path from 'path';
import { dbExec, dbQuery, runWithDbBootstrap, withTransaction } from './index';

export interface MigrationResult {
  applied: string[];
  skipped: string[];
}

export async function runMigrations(
  migrationsDir = path.resolve(
    /*turbopackIgnore: true*/ process.cwd(),
    'supabase/migrations'
  )
): Promise<MigrationResult> {
  return runWithDbBootstrap(async () => {
    await dbExec(`
      CREATE TABLE IF NOT EXISTS public.schema_migrations (
        version TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    const appliedRes = await dbQuery<{ version: string }>(
      'SELECT version FROM public.schema_migrations ORDER BY version ASC'
    );
    const alreadyApplied = new Set(appliedRes.rows.map((r) => r.version));

    const files = fs
      .readdirSync(/*turbopackIgnore: true*/ migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    const applied: string[] = [];
    const skipped: string[] = [];

    for (const file of files) {
      if (alreadyApplied.has(file)) {
        skipped.push(file);
        continue;
      }

      const fullPath = path.join(/*turbopackIgnore: true*/ migrationsDir, file);
      const sql = fs.readFileSync(/*turbopackIgnore: true*/ fullPath, 'utf8');
      await withTransaction(async (tx) => {
        await tx.exec(sql);
        await tx.query(
          'INSERT INTO public.schema_migrations (version) VALUES ($1) ON CONFLICT (version) DO NOTHING',
          [file]
        );
      });
      applied.push(file);
    }

    return { applied, skipped };
  });
}
