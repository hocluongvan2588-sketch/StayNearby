import { PGlite } from '@electric-sql/pglite';
import { Pool, type PoolConfig } from 'pg';
import { mkdirSync } from 'node:fs';
import { getConfig, isInDbBootstrap, runWithDbBootstrap } from '@/lib/config';

export type DbRow = Record<string, unknown>;

export interface DbQueryResult<T extends DbRow = DbRow> {
  rows: T[];
  rowCount: number;
}

export interface DbClient {
  query<T extends DbRow = DbRow>(sql: string, params?: unknown[]): Promise<DbQueryResult<T>>;
}

interface GlobalDbState {
  pool?: Pool;
  pglite?: PGlite;
  readyPromise?: Promise<void>;
}

const g = globalThis as typeof globalThis & { __vietnomadDb?: GlobalDbState };
if (!g.__vietnomadDb) {
  g.__vietnomadDb = {};
}
const dbState = g.__vietnomadDb;

function buildPgPoolConfig(rawUrl: string): PoolConfig {
  const parsed = new URL(rawUrl);
  const sslMode = parsed.searchParams.get('sslmode');
  const isLocal =
    parsed.hostname === 'localhost' ||
    parsed.hostname === '127.0.0.1' ||
    parsed.hostname === '::1';

  // Strip sslmode & uselibpqcompat so pg uses explicit ssl config cleanly
  parsed.searchParams.delete('sslmode');
  parsed.searchParams.delete('uselibpqcompat');

  return {
    connectionString: parsed.toString(),
    max: 10,
    ssl: isLocal && sslMode !== 'require' ? undefined : { rejectUnauthorized: false },
  };
}

async function getPool(): Promise<Pool> {
  if (!dbState.pool) {
    const { databaseUrl } = getConfig();
    dbState.pool = new Pool(buildPgPoolConfig(databaseUrl));
  }
  return dbState.pool;
}

async function getPglite(): Promise<PGlite> {
  if (!dbState.pglite) {
    const { pgliteDataDir } = getConfig();
    if (pgliteDataDir !== 'memory://') {
      mkdirSync(pgliteDataDir, { recursive: true });
    }
    dbState.pglite = new PGlite(pgliteDataDir);
  }
  return dbState.pglite;
}

async function rawQuery<T extends DbRow = DbRow>(
  sql: string,
  params: unknown[] = []
): Promise<DbQueryResult<T>> {
  const { databaseUrl } = getConfig();
  if (databaseUrl) {
    const pool = await getPool();
    const res = await pool.query<T>(sql, params);
    return {
      rows: res.rows,
      rowCount: res.rowCount ?? res.rows.length,
    };
  }

  const pglite = await getPglite();
  const res = await pglite.query<T>(sql, params);
  return {
    rows: res.rows,
    rowCount: res.rows.length > 0 ? res.rows.length : (res.affectedRows ?? 0),
  };
}

export async function ensureDbReady(): Promise<void> {
  if (isInDbBootstrap()) return;
  if (!dbState.readyPromise) {
    dbState.readyPromise = runWithDbBootstrap(async () => {
      const { runMigrations } = await import('./migrate');
      await runMigrations();

      const destCount = await rawQuery<{ count: string | number }>(
        'SELECT COUNT(*) AS count FROM destinations'
      );
      if (Number(destCount.rows[0]?.count ?? 0) === 0) {
        const { runSeed } = await import('./seed-data');
        await runSeed();
      } else {
        const placesCount = await rawQuery<{ count: string | number }>(
          'SELECT COUNT(*) AS count FROM places'
        );
        if (Number(placesCount.rows[0]?.count ?? 0) < 25) {
          const { ensureCuratedDiscoverySeeded } = await import('./seed-bos');
          await ensureCuratedDiscoverySeeded();
        }
      }
    }).catch((err) => {
      dbState.readyPromise = undefined;
      throw err;
    });
  }
  await dbState.readyPromise;
}

export async function dbQuery<T extends DbRow = DbRow>(
  sql: string,
  params: unknown[] = []
): Promise<DbQueryResult<T>> {
  await ensureDbReady();
  return rawQuery<T>(sql, params);
}

export async function dbExec(sql: string): Promise<void> {
  const { databaseUrl } = getConfig();
  if (databaseUrl) {
    const pool = await getPool();
    await pool.query(sql);
    return;
  }
  const pglite = await getPglite();
  await pglite.exec(sql);
}

export async function dbTransaction<T>(fn: (tx: DbClient) => Promise<T>): Promise<T> {
  await ensureDbReady();
  const { databaseUrl } = getConfig();

  if (databaseUrl) {
    const pool = await getPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const tx: DbClient = {
        async query<R extends DbRow = DbRow>(sql: string, params: unknown[] = []) {
          const res = await client.query<R>(sql, params);
          return { rows: res.rows, rowCount: res.rowCount ?? res.rows.length };
        },
      };
      const out = await fn(tx);
      await client.query('COMMIT');
      return out;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  const pglite = await getPglite();
  return pglite.transaction(async (pgTx) => {
    const tx: DbClient = {
      async query<R extends DbRow = DbRow>(sql: string, params: unknown[] = []) {
        const res = await pgTx.query<R>(sql, params);
        return {
          rows: res.rows,
          rowCount: res.rows.length > 0 ? res.rows.length : (res.affectedRows ?? 0),
        };
      },
    };
    return fn(tx);
  });
}

export async function closeDb(): Promise<void> {
  if (dbState.pool) {
    await dbState.pool.end();
    dbState.pool = undefined;
  }
  if (dbState.pglite) {
    await dbState.pglite.close();
    dbState.pglite = undefined;
  }
  dbState.readyPromise = undefined;
}

export function toNum(val: unknown, fallback = 0): number {
  if (typeof val === 'number') return Number.isFinite(val) ? val : fallback;
  if (typeof val === 'string' && val.trim() !== '') {
    const n = Number(val);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}
