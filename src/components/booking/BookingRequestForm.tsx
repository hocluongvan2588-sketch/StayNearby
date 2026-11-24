'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import { formatVnd } from '@/lib/format';
import { formatMoneyFromVnd } from '@/lib/i18n/currency';
import { getUserMessages } from '@/lib/i18n/messages';
import { useUserPreferences } from '@/components/i18n/UserPreferencesProvider';
import type { ErrorCode } from '@/lib/errors';
import type { StayQuote } from '@/modules/pricing';
import { ErrorAlert } from '@/components/ui/ErrorAlert';

interface BookingRequestFormProps {
  initialQuote: StayQuote;
  userDisplayName: string;
}

function generateIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `wh-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function BookingRequestForm({
  initialQuote,
  userDisplayName,
}: BookingRequestFormProps) {
  const router = useRouter();
  const { preferences } = useUserPreferences();
  const locale = preferences.locale;
  const currency = preferences.currency;
  const t = getUserMessages(locale);

  const [activeQuote, setActiveQuote] = useState<StayQuote>(initialQuote);
  const [guestNote, setGuestNote] = useState('');
  const [idempotencyKey] = useState<string>(() => generateIdempotencyKey());
  const [priceChangedAlert, setPriceChangedAlert] = useState<{
    previousTotalVnd: number;
    newTotalVnd: number;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<{ code?: ErrorCode; message: string } | null>(
    null
  );

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listingId: activeQuote.listingId,
          checkIn: activeQuote.checkIn,
          checkOut: activeQuote.checkOut,
          guestsCount: activeQuote.guestsCount,
          idempotencyKey,
          expectedQuoteHash: activeQuote.quoteHash,
          guestNote: guestNote.trim() || undefined,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.ok) {
        const code: ErrorCode = json?.error?.code ?? 'INTERNAL_ERROR';
        if (code === 'PRICE_CHANGED' && json?.error?.details?.updatedQuote) {
          const updated = json.error.details.updatedQuote as StayQuote;
          setPriceChangedAlert({
            previousTotalVnd: activeQuote.totalVnd,
            newTotalVnd: updated.totalVnd,
          });
          setActiveQuote(updated);
          return;
        }
        setError({
          code,
          message: json?.error?.message ?? t.bookingForm.fallbackSubmitError,
        });
        return;
      }

      router.push(`/trips/${json.booking.id}`);
      router.refresh();
    } catch {
      setError({
        code: 'INTERNAL_ERROR',
        message: t.bookingForm.networkError,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-apple-card p-6 space-y-5"
    >
      <div className="flex items-start gap-2.5">
        <CheckCircle2
          className="w-5 h-5 text-[var(--color-primary)] shrink-0 mt-0.5"
          aria-hidden="true"
        />
        <div className="text-sm space-y-1">
          <p className="font-semibold text-[var(--color-text)]">
            {t.bookingForm.requestingAs(userDisplayName)}
          </p>
          <p className="text-[var(--color-text-muted)]">
            {t.bookingForm.requestingExplanation}
          </p>
        </div>
      </div>

      {priceChangedAlert && (
        <div
          role="alert"
          className="rounded-[12px] border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] p-4 text-sm text-[var(--color-warning-text)] space-y-2"
        >
          <div className="flex items-center gap-2 font-semibold">
            <AlertCircle className="w-5 h-5 shrink-0" aria-hidden="true" />
            <span>{t.bookingForm.priceChangedTitle}</span>
          </div>
          <p>
            {t.bookingForm.priceChangedBody(
              formatMoneyFromVnd(priceChangedAlert.previousTotalVnd, currency, locale),
              formatMoneyFromVnd(priceChangedAlert.newTotalVnd, currency, locale),
              formatVnd(priceChangedAlert.newTotalVnd, locale)
            )}
          </p>
        </div>
      )}

      <div className="rounded-[12px] bg-[var(--color-surface-ivory)] border border-[var(--color-hairline)] p-4 space-y-2 text-sm">
        <div className="flex items-center justify-between text-[var(--color-text-muted)]">
          <span>{t.bookingForm.nightsAccommodation(activeQuote.nightsCount)}</span>
          <span className="tabular-nums font-medium text-[var(--color-text)]">
            {formatMoneyFromVnd(activeQuote.accommodationSubtotalVnd, currency, locale)}
          </span>
        </div>
        {activeQuote.cleaningFeeVnd > 0 && (
          <div className="flex items-center justify-between text-[var(--color-text-muted)]">
            <span>{t.bookingForm.cleaningFee}</span>
            <span className="tabular-nums font-medium text-[var(--color-text)]">
              {formatMoneyFromVnd(activeQuote.cleaningFeeVnd, currency, locale)}
            </span>
          </div>
        )}
        <div className="pt-2 border-t border-[var(--color-border)] flex items-center justify-between text-base font-semibold text-[var(--color-text)]">
          <span>{t.bookingForm.confirmedSnapshotTotal}</span>
          <span className="tabular-nums text-[var(--color-primary)]">
            {formatMoneyFromVnd(activeQuote.totalVnd, currency, locale)}
          </span>
        </div>
        {currency !== 'VND' && (
          <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)]">
            <span>{t.bookingForm.lockedVndNote}</span>
            <span className="tabular-nums font-medium text-[var(--color-text)]">
              {formatVnd(activeQuote.totalVnd, locale)}
            </span>
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="guest-note"
          className="block text-sm font-medium text-[var(--color-text)]"
        >
          {t.bookingForm.noteLabel}
        </label>
        <textarea
          id="guest-note"
          rows={3}
          maxLength={1000}
          value={guestNote}
          onChange={(e) => setGuestNote(e.target.value)}
          placeholder={t.bookingForm.notePlaceholder}
          className="w-full px-3.5 py-2.5 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] text-[15px]"
        />
      </div>

      {error && (
        <ErrorAlert code={error.code} message={error.message} locale={locale} />
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full min-h-[48px] px-5 rounded-[12px] bg-[var(--color-primary)] text-white text-[15px] font-semibold inline-flex items-center justify-center gap-2 hover:bg-[var(--color-primary-hover)] transition-colors disabled:opacity-60"
      >
        {priceChangedAlert && (
          <RefreshCw className="w-4 h-4 shrink-0" aria-hidden="true" />
        )}
        <span>
          {submitting
            ? t.bookingForm.submitting
            : priceChangedAlert
              ? t.bookingForm.confirmUpdated(
                  formatMoneyFromVnd(activeQuote.totalVnd, currency, locale)
                )
              : t.bookingForm.sendRequest}
        </span>
      </button>
    </form>
  );
}
