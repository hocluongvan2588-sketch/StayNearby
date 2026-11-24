'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { KeyRound, UserCheck } from 'lucide-react';
import { getUserMessages } from '@/lib/i18n/messages';
import { useUserPreferences } from '@/components/i18n/UserPreferencesProvider';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import type { ErrorCode } from '@/lib/errors';

interface DemoAccountOption {
  key: string;
  email: string;
  password: string;
  displayName: string;
  roleSummaryEn: string;
  roleSummaryVi: string;
}

interface LoginFormProps {
  nextUrl: string;
  demoMode: boolean;
  demoAccounts: DemoAccountOption[];
}

export function LoginForm({
  nextUrl,
  demoMode,
  demoAccounts,
}: LoginFormProps) {
  const router = useRouter();
  const { preferences } = useUserPreferences();
  const locale = preferences.locale;
  const t = getUserMessages(locale);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<{ code?: ErrorCode; message: string } | null>(
    null
  );

  async function submitCredentials(targetEmail: string, targetPassword: string) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: targetEmail, password: targetPassword }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError({
          code: json?.error?.code ?? 'UNAUTHORIZED',
          message: json?.error?.message ?? t.login.invalidCreds,
        });
        return;
      }

      router.push(nextUrl);
      router.refresh();
    } catch {
      setError({
        code: 'INTERNAL_ERROR',
        message: t.login.networkError,
      });
    } finally {
      setSubmitting(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    submitCredentials(email, password);
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleSubmit}
        className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 space-y-4"
      >
        <div className="space-y-1">
          <label
            htmlFor="login-email"
            className="block text-sm font-medium text-[var(--color-text)]"
          >
            {t.login.emailLabel}
          </label>
          <input
            id="login-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="guest@workinghome.demo"
            className="w-full min-h-[44px] px-3.5 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] text-[15px]"
          />
        </div>

        <div className="space-y-1">
          <label
            htmlFor="login-password"
            className="block text-sm font-medium text-[var(--color-text)]"
          >
            {t.login.passwordLabel}
          </label>
          <input
            id="login-password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full min-h-[44px] px-3.5 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] text-[15px]"
          />
        </div>

        {error && (
          <ErrorAlert code={error.code} message={error.message} locale={locale} />
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full min-h-[48px] px-5 rounded-[12px] bg-[var(--color-primary)] text-white text-[15px] font-semibold inline-flex items-center justify-center gap-2 hover:bg-[var(--color-primary-hover)] disabled:opacity-60"
        >
          <KeyRound className="w-5 h-5" aria-hidden="true" />
          <span>{submitting ? t.login.signingIn : t.login.signInButton}</span>
        </button>
      </form>

      {demoMode && demoAccounts.length > 0 && (
        <section
          aria-label="Demo accounts"
          className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-3"
        >
          <div>
            <h2 className="text-sm font-semibold text-[var(--color-text)]">
              {t.login.demoHeading}
            </h2>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              {t.login.demoSubheading}
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {demoAccounts.map((acc) => (
              <button
                key={acc.key}
                type="button"
                disabled={submitting}
                onClick={() => {
                  setEmail(acc.email);
                  setPassword(acc.password);
                  submitCredentials(acc.email, acc.password);
                }}
                className="min-h-[48px] p-3.5 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-primary)] shadow-apple-subtle text-left flex items-start gap-2.5 transition-colors disabled:opacity-60"
              >
                <UserCheck
                  className="w-5 h-5 text-[var(--color-primary)] shrink-0 mt-0.5"
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[var(--color-text)] truncate">
                    {acc.displayName}
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)] truncate">
                    {locale === 'vi' ? acc.roleSummaryVi : acc.roleSummaryEn}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
