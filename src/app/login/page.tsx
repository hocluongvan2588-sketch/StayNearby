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

function sanitizeNextUrl(raw: string | string[] | undefined): {
  nextUrl: string;
  hasExplicitNext: boolean;
} {
  const val = Array.isArray(raw) ? raw[0] : raw;
  if (!val) return { nextUrl: '/', hasExplicitNext: false };
  if (val.startsWith('/') && !val.startsWith('//')) {
    return { nextUrl: val, hasExplicitNext: true };
  }
  return { nextUrl: '/', hasExplicitNext: false };
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const [sp, user, prefs] = await Promise.all([
    searchParams,
    getCurrentUser(),
    getServerUserPreferences(),
  ]);

  const { nextUrl, hasExplicitNext } = sanitizeNextUrl(sp.next);
  const switchVal = Array.isArray(sp.switch) ? sp.switch[0] : sp.switch;
  const switchMode = switchVal === '1';

  const canAccessTarget = user
    ? nextUrl.startsWith('/admin')
      ? user.roles.includes('admin')
      : nextUrl.startsWith('/host')
        ? user.roles.includes('host')
        : true
    : false;

  if (user && !switchMode && canAccessTarget) {
    if (hasExplicitNext) {
      redirect(nextUrl);
    }
    if (user.roles.includes('admin')) {
      redirect('/admin/crm');
    }
    if (user.roles.includes('host')) {
      redirect('/host');
    }
    redirect('/customer');
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

      {user && (
        <div className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface-ivory)] p-4 text-sm text-[var(--color-text)] space-y-1">
          <p>
            {prefs.locale === 'vi' ? 'Phiên hiện tại: ' : 'Current session: '}
            <strong>{user.displayName}</strong> ({user.email}) —{' '}
            <span className="text-[var(--color-text-muted)]">
              {user.roles.join(', ')}
            </span>
          </p>
          <p className="text-xs text-[var(--color-text-muted)]">
            {prefs.locale === 'vi'
              ? 'Chọn một tài khoản khác bên dưới hoặc nhập thông tin đăng nhập để chuyển phiên làm việc ngay.'
              : 'Select another account below or enter credentials to switch sessions immediately.'}
          </p>
        </div>
      )}

      <LoginForm
        nextUrl={nextUrl}
        hasExplicitNext={hasExplicitNext}
        demoMode={config.demoMode}
        demoAccounts={demoAccounts}
      />
    </div>
  );
}
