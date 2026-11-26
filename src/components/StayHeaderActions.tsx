'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bookmark, Check, Share2 } from 'lucide-react';
import type { Locale } from '@/lib/i18n';

export function StayHeaderActions({
  stayId,
  staySlug,
  stayTitle,
  locale,
  initialSaved,
  isAuthenticated,
}: {
  stayId: string;
  staySlug: string;
  stayTitle: string;
  locale: Locale;
  initialSaved: boolean;
  isAuthenticated: boolean;
}) {
  const router = useRouter();
  const isVi = locale === 'vi';
  const [saved, setSaved] = useState(initialSaved);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share({ title: stayTitle, url });
        return;
      }
      if (typeof navigator !== 'undefined' && navigator.clipboard && url) {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2200);
      }
    } catch {
      // User dismissed native share dialog
    }
  }

  async function handleSaveToggle() {
    if (!isAuthenticated) {
      router.push(`/login?next=/stays/${encodeURIComponent(staySlug)}`);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/saved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stayId }),
      });
      const json = await res.json();
      if (json.ok) {
        setSaved(Boolean(json.saved));
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex shrink-0 items-center gap-2">
      <button
        type="button"
        onClick={handleShare}
        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-[#17221E] underline-offset-4 transition hover:bg-[#F2EDE3]"
      >
        {copied ? (
          <>
            <Check className="h-4 w-4 text-[#164E3F]" />
            <span className="text-[#164E3F]">{isVi ? 'Đã sao chép' : 'Link copied'}</span>
          </>
        ) : (
          <>
            <Share2 className="h-4 w-4 stroke-[1.75]" />
            <span className="underline">{isVi ? 'Chia sẻ' : 'Share'}</span>
          </>
        )}
      </button>

      <button
        type="button"
        onClick={handleSaveToggle}
        disabled={saving}
        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-[#17221E] underline-offset-4 transition hover:bg-[#F2EDE3] disabled:opacity-60"
      >
        <Bookmark
          className={`h-4 w-4 stroke-[1.75] ${saved ? 'text-[#C25E28]' : ''}`}
          fill={saved ? 'currentColor' : 'none'}
        />
        <span className="underline">
          {saved ? (isVi ? 'Đã lưu' : 'Saved') : isVi ? 'Lưu' : 'Save'}
        </span>
      </button>
    </div>
  );
}
