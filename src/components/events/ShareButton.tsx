'use client';

import { useState } from 'react';
import type { Locale } from '@/lib/i18n';

/** Share the current event page: Web Share API with clipboard fallback. */
export function ShareButton({ title, locale }: { title: string; locale: Locale }) {
  const isVi = locale === 'vi';
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = window.location.href;
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // user dismissed — fall through to copy
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable — nothing else to do without a prompt
    }
  }

  return (
    <button
      type="button"
      onClick={share}
      className="text-sm font-semibold text-[#164E3F] hover:underline"
    >
      {copied
        ? isVi
          ? 'Đã sao chép liên kết'
          : 'Link copied'
        : isVi
          ? 'Chia sẻ sự kiện'
          : 'Share event'}
    </button>
  );
}
