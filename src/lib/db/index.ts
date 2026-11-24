import fs from 'fs';
import path from 'path';
import { Pool, types as pgTypes, type QueryResultRow } from 'pg';
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
  pglite?: PGlite;
  pglitePath?: string;
}

const globalForDb = globalThis as typeof globalThis & {
  __staynearbyDb?: GlobalDbState;
};

function getGlobalDbState(): GlobalDbState {
  if (!globalForDb.__staynearbyDb) {
    globalForDb.__staynearbyDb = {};
  }
  return globalForDb.__staynearbyDb;
}

export function getDbMode(): 'postgres' | 'pglite' {
  const { databaseUrl } = getAppConfig();
  return databaseUrl ? 'postgres' : 'pglite';
}

function getPgPool(): Pool {
  const state = getGlobalDbState();
  if (!state.pgPool) {
    const { databaseUrl } = getAppConfig();
    state.pgPool = new Pool({
      connectionString: databaseUrl,
      max: 10,
    });
  }
  return state.pgPool;
}

async function getPglite(): Promise<PGlite> {
  const state = getGlobalDbState();
  const { pgliteDataDir } = getAppConfig();

  if (state.pglite && state.pglitePath === pgliteDataDir) {
    return state.pglite;
  }

  if (state.pglite) {
    await state.pglite.close();
    state.pglite = undefined;
  }

  if (pgliteDataDir !== 'memory://' && !pgliteDataDir.startsWith('idb://')) {
    const resolved = path.resolve(
      /*turbopackIgnore: true*/ process.cwd(),
      pgliteDataDir
    );
    fs.mkdirSync(resolved, { recursive: true });
    state.pglite = await PGlite.create({
      dataDir: resolved,
      parsers: {
        1082: (value: string) => value,
      },
    });
  } else {
    state.pglite = await PGlite.create({
      dataDir: pgliteDataDir,
      parsers: {
        1082: (value: string) => value,
      },
    });
  }

  state.pglitePath = pgliteDataDir;
  return state.pglite;
}

export async function dbQuery<T extends QueryResultRow = Record<string, unknown>>(
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

export async function dbExec(sql: string): Promise<void> {
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
  if (state.pgPool) {
    await state.pgPool.end();
    state.pgPool = undefined;
  }
  if (state.pglite) {
    await state.pglite.close();
    state.pglite = undefined;
    state.pglitePath = undefined;
  }
}
