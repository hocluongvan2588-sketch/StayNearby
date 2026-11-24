import Link from 'next/link';
import { Search } from 'lucide-react';
import { getUserMessages } from '@/lib/i18n/messages';
import { getServerUserPreferences } from '@/lib/i18n/preferences';

export default async function NotFoundPage() {
  const prefs = await getServerUserPreferences();
  const t = getUserMessages(prefs.locale);

  return (
    <div className="container-stay py-16 max-w-xl text-center space-y-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-primary)]">
        {t.notFound.eyebrow}
      </p>
      <h1 className="page-title">{t.notFound.title}</h1>
      <p className="text-sm text-[var(--color-text-muted)]">{t.notFound.body}</p>
      <div className="pt-2 flex flex-wrap justify-center gap-3">
        <Link
          href="/stays"
          className="inline-flex items-center gap-2 min-h-[44px] px-5 rounded-[12px] bg-[var(--color-primary)] text-white text-sm font-medium hover:bg-[var(--color-primary-hover)]"
        >
          <Search className="w-4 h-4" aria-hidden="true" />
          <span>{t.notFound.explore}</span>
        </Link>
        <Link
          href="/"
          className="inline-flex items-center min-h-[44px] px-5 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] text-sm font-medium text-[var(--color-text)]"
        >
          {t.notFound.backHome}
        </Link>
      </div>
    </div>
  );
}
