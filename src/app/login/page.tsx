import { redirect } from 'next/navigation';
import { getAppConfig } from '@/lib/config';
import { getCurrentUser } from '@/lib/auth/session';
import { DEMO_ACCOUNTS } from '@/lib/db/seed-data';
import { getUserMessages } from '@/lib/i18n/messages';
import { getServerUserPreferences } from '@/lib/i18n/preferences';
import { LoginForm } from '@/components/auth/LoginForm';

export const dynamic = 'force-dynamic';

interface LoginPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function sanitizeNextUrl(raw: string | string[] | undefined): string {
  const val = Array.isArray(raw) ? raw[0] : raw;
  if (!val) return '/';
  if (val.startsWith('/') && !val.startsWith('//')) {
    return val;
  }
  return '/';
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const [sp, user, prefs] = await Promise.all([
    searchParams,
    getCurrentUser(),
    getServerUserPreferences(),
  ]);
  const nextUrl = sanitizeNextUrl(sp.next);
  if (user) {
    redirect(nextUrl);
  }

  const config = getAppConfig();
  const t = getUserMessages(prefs.locale);
  const demoAccounts = config.demoMode
    ? Object.entries(DEMO_ACCOUNTS).map(([key, acc]) => ({
        key,
        email: acc.email,
        password: acc.password,
        displayName: acc.displayName,
        roleSummaryEn: acc.roleSummaryEn,
        roleSummaryVi: acc.roleSummaryVi,
      }))
    : [];

  return (
    <div className="container-stay py-10 md:py-14 max-w-xl space-y-6">
      <div className="space-y-2">
        <h1 className="page-title">{t.login.title(config.brandName)}</h1>
        <p className="text-sm text-[var(--color-text-muted)]">{t.login.subtitle}</p>
      </div>

      <LoginForm
        nextUrl={nextUrl}
        demoMode={config.demoMode}
        demoAccounts={demoAccounts}
      />
    </div>
  );
}
