import { afterEach, describe, expect, it } from 'vitest';
import { getAppConfig } from '@/lib/config';
import {
  buildPgPoolConfig,
  closeDb,
  dbQuery,
  getDbMode,
  resolvePgliteDataDir,
} from '@/lib/db';
import { getLocalUploadsRoot } from '@/lib/storage/photos';

const ENV_KEYS = [
  'DATABASE_URL',
  'POSTGRES_URL',
  'POSTGRES_URL_NON_POOLING',
  'POSTGRES_PRISMA_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_SECRET_KEY',
  'PGLITE_DATA_DIR',
  'VERCEL',
  'NEXT_PUBLIC_DEMO_MODE',
] as const;

const originalEnv: Record<string, string | undefined> = {};
for (const k of ENV_KEYS) {
  originalEnv[k] = process.env[k];
}

afterEach(async () => {
  await closeDb();
  for (const k of ENV_KEYS) {
    if (originalEnv[k] === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = originalEnv[k];
    }
  }
});

describe('Vercel & Supabase database config, SSL pooling, and auto-bootstrap', () => {
  it('falls back to Vercel POSTGRES_URL and SUPABASE_* env vars when DATABASE_URL is absent', () => {
    delete process.env.DATABASE_URL;
    process.env.POSTGRES_URL =
      'postgres://postgres.abc:secret@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require';
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.SUPABASE_URL = 'https://abc.supabase.co';
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    process.env.SUPABASE_ANON_KEY = 'anon-key-123';
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    process.env.SUPABASE_SECRET_KEY = 'service-secret-456';
    delete process.env.PGLITE_DATA_DIR;

    const cfg = getAppConfig();
    expect(cfg.databaseUrl).toBe(process.env.POSTGRES_URL);
    expect(cfg.supabase.url).toBe('https://abc.supabase.co');
    expect(cfg.supabase.anonKey).toBe('anon-key-123');
    expect(cfg.supabase.serviceRoleKey).toBe('service-secret-456');
    expect(cfg.supabase.isConfigured).toBe(true);
    expect(getDbMode()).toBe('postgres');

    process.env.PGLITE_DATA_DIR = 'memory://';
    expect(getDbMode()).toBe('pglite');
  });

  it('uses writable /tmp paths on Vercel for both PGlite and local uploads', () => {
    process.env.VERCEL = '1';
    process.env.PGLITE_DATA_DIR = '.data/staynearby-pglite';

    const cfg = getAppConfig();
    expect(cfg.pgliteDataDir).toBe('/tmp/staynearby-pglite');
    expect(resolvePgliteDataDir('.data/staynearby-pglite')).toBe('/tmp/staynearby-pglite');
    expect(getLocalUploadsRoot()).toBe('/tmp/staynearby-uploads');
  });

  it('builds SSL pool config cleanly for remote Supabase URLs without pg sslmode override', () => {
    const remote = buildPgPoolConfig(
      'postgres://postgres.ref:pw@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require'
    );
    expect(remote.ssl).toEqual({ rejectUnauthorized: false });
    expect(remote.connectionString).not.toContain('sslmode=require');

    const local = buildPgPoolConfig('postgres://postgres:postgres@127.0.0.1:5432/postgres');
    expect(local.ssl).toBeUndefined();

    const disabled = buildPgPoolConfig(
      'postgres://u:p@db.example.com:5432/postgres?sslmode=disable'
    );
    expect(disabled.ssl).toBeUndefined();
  });

  it('automatically applies migrations and demo seed on concurrent cold-start queries', async () => {
    delete process.env.DATABASE_URL;
    delete process.env.POSTGRES_URL;
    process.env.PGLITE_DATA_DIR = 'memory://';
    process.env.NEXT_PUBLIC_DEMO_MODE = 'true';

    const [areasRes, listingsRes, guidesRes] = await Promise.all([
      dbQuery<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM areas WHERE is_published = TRUE`
      ),
      dbQuery<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM listings WHERE status = 'published'`
      ),
      dbQuery<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM local_guides WHERE is_published = TRUE`
      ),
    ]);
    expect(Number(areasRes.rows[0].count)).toBe(4);
    expect(Number(listingsRes.rows[0].count)).toBeGreaterThanOrEqual(4);
    expect(Number(guidesRes.rows[0].count)).toBeGreaterThanOrEqual(4);
  });
});
