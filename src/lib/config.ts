import { AsyncLocalStorage } from 'node:async_hooks';
import { existsSync } from 'node:fs';
import path from 'node:path';

export interface AppConfig {
  brandName: string;
  appBaseUrl: string;
  databaseUrl: string;
  pgliteDataDir: string;
  authSecret: string;
  defaultLocale: 'en' | 'vi';
  isVercel: boolean;
  conciergeWhatsapp: string;
  resendApiKey: string;
  resendFromEmail: string;
  adminAlertWebhookUrl: string;
  cronSecret: string;
  stripeSecretKey: string;
  stripeWebhookSecret: string;
  vietqrBankBin: string;
  vietqrAccountNo: string;
  vietqrAccountName: string;
  vietqrWebhookToken: string;
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  supabaseStorageBucket: string;
  localUploadsDir: string;
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

  const configuredUploadsDir = process.env.LOCAL_UPLOADS_DIR?.trim();
  const localUploadsDir = configuredUploadsDir
    ? configuredUploadsDir
    : isVercel
      ? '/tmp/vietnomad-uploads'
      : path.join(process.cwd(), '.data', 'uploads');

  return {
    brandName: 'VietNomad Stays',
    appBaseUrl:
      process.env.NEXT_PUBLIC_APP_URL?.trim() || 'http://localhost:3000',
    databaseUrl,
    pgliteDataDir,
    authSecret:
      process.env.AUTH_SECRET?.trim() || 'vietnomad-dev-secret-change-in-production',
    defaultLocale: process.env.NEXT_PUBLIC_DEFAULT_LOCALE === 'vi' ? 'vi' : 'en',
    isVercel,
    conciergeWhatsapp:
      process.env.NEXT_PUBLIC_CONCIERGE_WHATSAPP?.trim() || '84901234567',
    resendApiKey: process.env.RESEND_API_KEY?.trim() || '',
    resendFromEmail:
      process.env.RESEND_FROM_EMAIL?.trim() || 'VietNomad Stays <bookings@vietnomad.stays>',
    adminAlertWebhookUrl: process.env.ADMIN_ALERT_WEBHOOK_URL?.trim() || '',
    cronSecret: process.env.CRON_SECRET?.trim() || '',
    stripeSecretKey: process.env.STRIPE_SECRET_KEY?.trim() || '',
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET?.trim() || '',
    vietqrBankBin: process.env.VIETQR_BANK_BIN?.trim() || '',
    vietqrAccountNo: process.env.VIETQR_ACCOUNT_NO?.trim() || '',
    vietqrAccountName: process.env.VIETQR_ACCOUNT_NAME?.trim() || '',
    vietqrWebhookToken: process.env.VIETQR_WEBHOOK_TOKEN?.trim() || '',
    supabaseUrl:
      (process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || '').replace(/\/+$/, ''),
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || '',
    supabaseStorageBucket:
      process.env.SUPABASE_STORAGE_BUCKET?.trim() || 'stay-photos',
    localUploadsDir,
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
