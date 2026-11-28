'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Locale } from '@/lib/i18n';

/**
 * Registration block for the event detail page (spec §5).
 * - internal: reuses POST/DELETE /api/events/rsvp (login, duplicate, capacity,
 *   cancel). Never shown for external events.
 * - external: a plain link to the organizer's official registration page —
 *   no VietNomad login, no attendance counter (VietNomad does not manage it).
 */
export function EventRegistration({
  eventId,
  eventSlug,
  registrationMode,
  status,
  hasStarted,
  spotsTotal,
  rsvpCount,
  isLoggedIn,
  sourceUrl,
  locale,
}: {
  eventId: string;
  eventSlug: string;
  registrationMode: string;
  status: string;
  /** Computed on the server from start_at vs now (render stays pure). */
  hasStarted: boolean;
  spotsTotal: number | null;
  rsvpCount: number;
  isLoggedIn: boolean;
  sourceUrl: string | null;
  locale: Locale;
}) {
  const isVi = locale === 'vi';
  const router = useRouter();
  const [joined, setJoined] = useState(false);
  const [busy, setBusy] = useState(false);
  const [taken, setTaken] = useState(rsvpCount);

  const full = spotsTotal != null && taken >= spotsTotal;

  if (status === 'cancelled' || status === 'ended' || status === 'postponed' || hasStarted) {
    const label =
      status === 'cancelled'
        ? isVi
          ? 'Sự kiện đã hủy'
          : 'Event cancelled'
        : status === 'postponed'
          ? isVi
            ? 'Sự kiện đã hoãn'
            : 'Event postponed'
          : isVi
            ? 'Sự kiện đã kết thúc'
            : 'Event has ended';
    return <p className="text-sm font-semibold text-[#53635D]">{label}</p>;
  }

  if (registrationMode === 'external') {
    if (!sourceUrl) return null;
    return (
      <a
        href={sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex h-11 items-center justify-center rounded-xl bg-[#164E3F] px-6 text-sm font-semibold text-white transition hover:bg-[#0F392E] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#164E3F]"
      >
        {isVi ? 'Đăng ký' : 'Register'}
      </a>
    );
  }

  async function rsvp() {
    if (!isLoggedIn) {
      router.push(`/login?next=/community/${eventSlug}`);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/events/rsvp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId }),
      });
      const json = await res.json();
      if (json.ok) {
        setJoined(true);
        if (typeof json.spotsTaken === 'number') setTaken(json.spotsTaken);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    setBusy(true);
    try {
      const res = await fetch('/api/events/rsvp', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId }),
      });
      const json = await res.json();
      if (json.ok) {
        setJoined(false);
        if (typeof json.spotsTaken === 'number') setTaken(json.spotsTaken);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  if (joined) {
    return (
      <div className="space-y-2">
        <p className="text-sm font-semibold text-[#164E3F]">
          {isVi ? 'Bạn đã đăng ký sự kiện này' : 'You are registered for this event'}
        </p>
        <button
          type="button"
          onClick={cancel}
          disabled={busy}
          className="inline-flex h-11 items-center justify-center rounded-xl border border-[#E5DFD3] bg-white px-6 text-sm font-semibold text-[#17221E] transition hover:border-[#17221E] disabled:opacity-60"
        >
          {busy ? '…' : isVi ? 'Hủy đăng ký' : 'Cancel registration'}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={rsvp}
        disabled={busy || full}
        className="inline-flex h-11 items-center justify-center rounded-xl bg-[#164E3F] px-6 text-sm font-semibold text-white transition hover:bg-[#0F392E] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#164E3F]"
      >
        {busy
          ? '…'
          : full
            ? isVi
              ? 'Đã đủ chỗ'
              : 'Event full'
            : isVi
              ? 'Đăng ký tham gia'
              : 'Register'}
      </button>
      {!isLoggedIn ? (
        <p className="text-xs text-[#53635D]">
          {isVi ? 'Cần đăng nhập để đăng ký' : 'Sign in to register'}
        </p>
      ) : null}
    </div>
  );
}
