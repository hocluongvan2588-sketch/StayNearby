import { AsyncLocalStorage } from 'node:async_hooks';
import { existsSync } from 'node:fs';
import path from 'node:path';

export interface AppConfig {
  brandName: string;
  databaseUrl: string;
  pgliteDataDir: string;
  authSecret: string;
  defaultLocale: 'en' | 'vi';
  demoMode: boolean;
  isVercel: boolean;
}

export function getConfig(): AppConfig {
  const isVercel = process.env.VERCEL === '1' || process.env.VERCEL === 'true';
  const databaseUrl =
    process.env.DATABASE_URL?.trim() ||
    process.env.POSTGRES_URL?.trim() ||
    process.env.POSTGRES_URL_NON_POOLING?.trim() ||
    '';

  const configuredPgliteDir =
    process.env.PGLITE_DATA_DIR?.trim() || process.env.VIETNOMAD_DATA_DIR?.trim();
  const pgliteDataDir = configuredPgliteDir
    ? configuredPgliteDir
    : isVercel
      ? '/tmp/vietnomad-pglite'
      : path.join(process.cwd(), '.data', 'vietnomad-pglite');

  return {
    brandName: 'VietNomad Stays',
    databaseUrl,
    pgliteDataDir,
    authSecret:
      process.env.AUTH_SECRET?.trim() || 'vietnomad-dev-secret-change-in-production',
    defaultLocale: process.env.NEXT_PUBLIC_DEFAULT_LOCALE === 'vi' ? 'vi' : 'en',
    demoMode: process.env.NEXT_PUBLIC_DEMO_MODE !== 'false',
    isVercel,
  };
}

export function resolveMigrationsDir(): string {
  const candidates = [
    path.join(/*turbopackIgnore: true*/ process.cwd(), 'supabase', 'migrations'),
    path.join(/*turbopackIgnore: true*/ __dirname, '..', '..', '..', 'supabase', 'migrations'),
  ];
  for (const dir of candidates) {
    if (existsSync(/*turbopackIgnore: true*/ dir)) return dir;
  }
  return candidates[0];
}

const dbBootstrapContext = new AsyncLocalStorage<boolean>();

export function runWithDbBootstrap<T>(fn: () => Promise<T>): Promise<T> {
  return dbBootstrapContext.run(true, fn);
}

export function isInDbBootstrap(): boolean {
  return dbBootstrapContext.getStore() === true;
}
