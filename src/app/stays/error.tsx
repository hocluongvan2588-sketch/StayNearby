'use client';

import Link from 'next/link';
import { getUserMessages } from '@/lib/i18n/messages';
import { useUserPreferences } from '@/components/i18n/UserPreferencesProvider';
import { ErrorAlert } from '@/components/ui/ErrorAlert';

export default function StaysError({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  const { preferences } = useUserPreferences();
  const locale = preferences.locale;
  const t = getUserMessages(locale);

  return (
    <div className="container-stay py-12 space-y-4 max-w-xl">
      <ErrorAlert
        code="INTERNAL_ERROR"
        message={t.staysPage.loadError}
        locale={locale}
      />
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="min-h-[44px] px-5 rounded-[12px] bg-[var(--color-primary)] text-white text-sm font-medium"
        >
          {t.staysPage.tryAgain}
        </button>
        <Link
          href="/"
          className="inline-flex items-center min-h-[44px] px-5 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] text-sm font-medium"
        >
          {t.staysPage.backToHome}
        </Link>
      </div>
    </div>
  );
}
