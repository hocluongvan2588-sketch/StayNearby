import fs from 'fs';
import { AsyncLocalStorage } from 'node:async_hooks';
import path from 'path';
import { Pool, type PoolConfig, types as pgTypes, type QueryResultRow } from 'pg';
import { PGlite } from '@electric-sql/pglite';
import { getAppConfig } from '../config';

// Return PostgreSQL DATE (OID 1082) as raw 'YYYY-MM-DD' string without JS Date timezone drift.
pgTypes.setTypeParser(1082, (value: string) => value);

export interface DbQueryResult<T> {
  rows: T[];
  rowCount: number;
}

export interface DbExecutor {
  query<T extends QueryResultRow = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ): Promise<DbQueryResult<T>>;
}

export interface DbTransaction extends DbExecutor {
  exec(sql: string): Promise<void>;
}

export interface TransactionOptions {
  actorId?: string | null;
}

interface GlobalDbState {
  pgPool?: Pool;
  pgPoolUrl?: string;
  pglite?: PGlite;
  pglitePath?: string;
  bootstrappingStorage: AsyncLocalStorage<boolean>;
  initDone?: boolean;
  initPromise?: Promise<void>;
}

const globalForDb = globalThis as typeof globalThis & {
  __staynearbyDb?: GlobalDbState;
};

function getGlobalDbState(): GlobalDbState {
  if (!globalForDb.__staynearbyDb) {
    globalForDb.__staynearbyDb = {
      bootstrappingStorage: new AsyncLocalStorage<boolean>(),
    };
  }
  return globalForDb.__staynearbyDb;
}

export function runWithDbBootstrap<T>(fn: () => Promise<T>): Promise<T> {
  return getGlobalDbState().bootstrappingStorage.run(true, fn);
}

export function markDbInitialized(): void {
  getGlobalDbState().initDone = true;
}

export function getDbMode(): 'postgres' | 'pglite' {
  const { databaseUrl, pgliteDataDir } = getAppConfig();
  if (pgliteDataDir === 'memory://') {
    return 'pglite';
  }
  return databaseUrl ? 'postgres' : 'pglite';
}

export function resolvePgliteDataDir(rawDir: string): string {
  if (rawDir === 'memory://' || rawDir.startsWith('idb://')) {
    return rawDir;
  }
  const resolved = path.resolve(/*turbopackIgnore: true*/ process.cwd(), rawDir);
  if (process.env.VERCEL === '1' || resolved.startsWith('/var/task')) {
    return '/tmp/staynearby-pglite';
  }
  return resolved;
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

export function buildPgPoolConfig(databaseUrl: string): PoolConfig {
  const max = process.env.VERCEL === '1' ? 3 : 10;
  let parsed: URL | null = null;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    return {
      connectionString: databaseUrl,
      max,
      idleTimeoutMillis: 15_000,
      connectionTimeoutMillis: 10_000,
    };
  }

  const sslMode = parsed.searchParams.get('sslmode')?.toLowerCase();
  const isLocalHost = LOCAL_HOSTS.has(parsed.hostname.toLowerCase());

  if (sslMode === 'disable' || (isLocalHost && !sslMode)) {
    return {
      connectionString: databaseUrl,
      max,
      idleTimeoutMillis: 15_000,
      connectionTimeoutMillis: 10_000,
    };
  }

  // pg-connection-string v2+/pg v8 treats sslmode=require as verify-full and overrides Pool.ssl
  // unless stripped from the query string. Cloud poolers (e.g. Supabase) require rejectUnauthorized: false.
  if (sslMode !== 'verify-full') {
    parsed.searchParams.delete('sslmode');
    parsed.searchParams.delete('uselibpqcompat');
  }

  return {
    connectionString: parsed.toString(),
    max,
    idleTimeoutMillis: 15_000,
    connectionTimeoutMillis: 10_000,
    ssl: {
      rejectUnauthorized: false,
    },
  };
}

function getPgPool(): Pool {
  const state = getGlobalDbState();
  const { databaseUrl } = getAppConfig();
  if (!state.pgPool || state.pgPoolUrl !== databaseUrl) {
    if (state.pgPool) {
      void state.pgPool.end().catch(() => {});
    }
    state.pgPool = new Pool(buildPgPoolConfig(databaseUrl));
    state.pgPoolUrl = databaseUrl;
  }
  return state.pgPool;
}

async function getPglite(): Promise<PGlite> {
  const state = getGlobalDbState();
  const { pgliteDataDir } = getAppConfig();
  const resolved = resolvePgliteDataDir(pgliteDataDir);

  if (state.pglite && state.pglitePath === resolved) {
    return state.pglite;
  }

  if (state.pglite) {
    await state.pglite.close();
    state.pglite = undefined;
  }

  if (resolved !== 'memory://' && !resolved.startsWith('idb://')) {
    fs.mkdirSync(resolved, { recursive: true });
    state.pglite = await PGlite.create({
      dataDir: resolved,
      parsers: {
        1082: (value: string) => value,
      },
    });
  } else {
    state.pglite = await PGlite.create({
      dataDir: resolved,
      parsers: {
        1082: (value: string) => value,
      },
    });
  }

  state.pglitePath = resolved;
  return state.pglite;
}

async function rawQuery<T extends QueryResultRow = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<DbQueryResult<T>> {
  if (getDbMode() === 'postgres') {
    const res = await getPgPool().query<T>(sql, params);
    return {
      rows: res.rows,
      rowCount: res.rowCount ?? res.rows.length,
    };
  }

  const pglite = await getPglite();
  const res = await pglite.query<T>(sql, params);
  return {
    rows: res.rows,
    rowCount: res.affectedRows ?? res.rows.length,
  };
}

async function isLatestMigrationApplied(): Promise<boolean> {
  try {
    const res = await rawQuery<{ applied: boolean }>(
      `SELECT EXISTS(
         SELECT 1
         FROM public.schema_migrations
         WHERE version = '0006_local_guides_bilingual.sql'
       ) AS applied`
    );
    return Boolean(res.rows[0]?.applied);
  } catch {
    return false;
  }
}

async function ensureDbReady(): Promise<void> {
  const state = getGlobalDbState();
  if (state.initDone || state.bootstrappingStorage.getStore() === true) {
    return;
  }

  if (!state.initPromise) {
    state.initPromise = state.bootstrappingStorage
      .run(true, async () => {
        const migrated = await isLatestMigrationApplied();
        if (!migrated) {
          const { runMigrations } = await import('./migrate');
          try {
            await runMigrations();
          } catch (err) {
            // Handle concurrent cold-start DDL race across serverless instances
            await new Promise((r) => setTimeout(r, 350));
            const migratedAfterWait = await isLatestMigrationApplied();
            if (!migratedAfterWait) {
              throw err;
            }
          }
        }

        const { demoMode } = getAppConfig();
        if (demoMode) {
          const areaCountRes = await rawQuery<{ count: string }>(
            `SELECT COUNT(*)::text AS count FROM public.areas`
          );
          if (Number(areaCountRes.rows[0]?.count ?? '0') === 0) {
            const { runSeed } = await import('./seed-data');
            await runSeed();
          }
        }

        state.initDone = true;
      })
      .finally(() => {
        state.initPromise = undefined;
      });
  }

  await state.initPromise;
}

export async function dbQuery<T extends QueryResultRow = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<DbQueryResult<T>> {
  await ensureDbReady();
  return rawQuery<T>(sql, params);
}

export async function dbExec(sql: string): Promise<void> {
  await ensureDbReady();
  if (getDbMode() === 'postgres') {
    await getPgPool().query(sql);
    return;
  }

  const pglite = await getPglite();
  await pglite.exec(sql);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function withTransaction<T>(
  fn: (tx: DbTransaction) => Promise<T>,
  options?: TransactionOptions
): Promise<T> {
  await ensureDbReady();
  const actorId = options?.actorId ?? null;
  if (actorId && !UUID_RE.test(actorId)) {
    throw new Error('Invalid actorId UUID for transaction context');
  }

  if (getDbMode() === 'postgres') {
    const client = await getPgPool().connect();
    try {
      await client.query('BEGIN');
      if (actorId) {
        await client.query(`SET LOCAL app.current_user_id = '${actorId}'`);
      }
      const tx: DbTransaction = {
        async query<R extends QueryResultRow = Record<string, unknown>>(
          sql: string,
          params: unknown[] = []
        ) {
          const res = await client.query<R>(sql, params);
          return { rows: res.rows, rowCount: res.rowCount ?? res.rows.length };
        },
        async exec(sql: string) {
          await client.query(sql);
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
    if (actorId) {
      await pgTx.exec(`SET LOCAL app.current_user_id = '${actorId}'`);
    }
    const tx: DbTransaction = {
      async query<R extends QueryResultRow = Record<string, unknown>>(
        sql: string,
        params: unknown[] = []
      ) {
        const res = await pgTx.query<R>(sql, params);
        return { rows: res.rows, rowCount: res.affectedRows ?? res.rows.length };
      },
      async exec(sql: string) {
        await pgTx.exec(sql);
      },
    };
    return fn(tx);
  });
}

export async function closeDb(): Promise<void> {
  const state = getGlobalDbState();
  state.initDone = false;
  state.initPromise = undefined;
  if (state.pgPool) {
    await state.pgPool.end();
    state.pgPool = undefined;
    state.pgPoolUrl = undefined;
  }
  if (state.pglite) {
    await state.pglite.close();
    state.pglite = undefined;
    state.pglitePath = undefined;
  }
}
