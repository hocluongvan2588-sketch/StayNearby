'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowRight, LogIn, RefreshCw } from 'lucide-react';
import { ErrorAlert } from '@/components/ui/ErrorAlert';

interface QuickDemoAccount {
  email: string;
  password: string;
  displayName: string;
  roleLabel: string;
}

interface PortalSwitchPromptProps {
  title: string;
  message: string;
  currentEmail?: string | null;
  currentRoles?: string[];
  targetPath: string;
  targetRoleLabel: string;
  quickDemoAccount?: QuickDemoAccount | null;
  fallbackHref?: string;
  fallbackLabel?: string;
  locale?: 'en' | 'vi';
}

export function PortalSwitchPrompt({
  title,
  message,
  currentEmail,
  currentRoles = [],
  targetPath,
  targetRoleLabel,
  quickDemoAccount,
  fallbackHref = '/',
  fallbackLabel = 'Về trang chủ',
  locale = 'vi',
}: PortalSwitchPromptProps) {
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const switchUrl = `/login?next=${encodeURIComponent(targetPath)}&switch=1`;

  async function handleQuickSwitch() {
    if (!quickDemoAccount) return;
    setSwitching(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: quickDemoAccount.email,
          password: quickDemoAccount.password,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setError(
          json?.error?.message ||
            (locale === 'vi'
              ? 'Không thể chuyển tài khoản.'
              : 'Unable to switch account.')
        );
        return;
      }
      window.location.assign(targetPath);
    } catch {
      setError(
        locale === 'vi'
          ? 'Lỗi kết nối máy chủ khi chuyển tài khoản.'
          : 'Network error while switching account.'
      );
    } finally {
      setSwitching(false);
    }
  }

  return (
    <div className="container-stay py-10 max-w-2xl space-y-5">
      <div className="space-y-2">
        <h1 className="page-title">{title}</h1>
        {currentEmail && (
          <p className="text-sm text-[var(--color-text-muted)]">
            {locale === 'vi' ? 'Đang đăng nhập với: ' : 'Signed in as: '}
            <strong className="text-[var(--color-text)]">{currentEmail}</strong>
            {currentRoles.length > 0 && ` (${currentRoles.join(', ')})`}
          </p>
        )}
      </div>

      <ErrorAlert code="FORBIDDEN" message={message} locale={locale} />

      {error && <ErrorAlert code="INTERNAL_ERROR" message={error} locale={locale} />}

      <div className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-4">
        <p className="text-sm text-[var(--color-text)]">
          {locale === 'vi'
            ? `Để truy cập khu vực ${targetRoleLabel}, bạn cần đăng nhập bằng tài khoản có quyền ${targetRoleLabel}.`
            : `To access ${targetRoleLabel}, please sign in with an account holding ${targetRoleLabel} permissions.`}
        </p>

        <div className="flex flex-wrap items-center gap-3">
          {quickDemoAccount && (
            <button
              type="button"
              disabled={switching}
              onClick={handleQuickSwitch}
              className="inline-flex items-center gap-2 min-h-[44px] px-5 rounded-[12px] bg-[var(--color-primary)] text-white text-sm font-semibold hover:bg-[var(--color-primary-hover)] disabled:opacity-60"
            >
              <RefreshCw className="w-4 h-4" aria-hidden="true" />
              <span>
                {switching
                  ? locale === 'vi'
                    ? 'Đang chuyển tài khoản...'
                    : 'Switching...'
                  : locale === 'vi'
                    ? `Vào ngay với ${quickDemoAccount.displayName} (${quickDemoAccount.roleLabel})`
                    : `Continue as ${quickDemoAccount.displayName} (${quickDemoAccount.roleLabel})`}
              </span>
            </button>
          )}

          <Link
            href={switchUrl}
            className="inline-flex items-center gap-2 min-h-[44px] px-5 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] text-sm font-medium text-[var(--color-text)] hover:border-[var(--color-primary)]"
          >
            <LogIn className="w-4 h-4" aria-hidden="true" />
            <span>
              {locale === 'vi'
                ? 'Đăng nhập tài khoản khác'
                : 'Sign in with another account'}
            </span>
          </Link>

          <Link
            href={fallbackHref}
            className="inline-flex items-center gap-1.5 min-h-[44px] px-4 rounded-[12px] text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
          >
            <span>{fallbackLabel}</span>
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </div>
  );
}
