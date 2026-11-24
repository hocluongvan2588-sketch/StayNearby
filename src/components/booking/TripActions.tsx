'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { XCircle } from 'lucide-react';
import type { ErrorCode } from '@/lib/errors';
import { getUserMessages } from '@/lib/i18n/messages';
import { useUserPreferences } from '@/components/i18n/UserPreferencesProvider';
import type { BookingStatus } from '@/modules/bookings';
import { ErrorAlert } from '@/components/ui/ErrorAlert';

interface TripActionsProps {
  bookingId: string;
  status: BookingStatus;
  canWithdraw: boolean;
  canCancel: boolean;
}

export function TripActions({
  bookingId,
  status,
  canWithdraw,
  canCancel,
}: TripActionsProps) {
  const router = useRouter();
  const { preferences } = useUserPreferences();
  const locale = preferences.locale;
  const t = getUserMessages(locale);

  const [confirmMode, setConfirmMode] = useState<'withdraw' | 'cancel' | null>(
    null
  );
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<{ code?: ErrorCode; message: string } | null>(
    null
  );

  if (!canWithdraw && !canCancel) {
    return null;
  }

  async function executeAction(action: 'withdraw' | 'cancel') {
    setSubmitting(true);
    setError(null);
    try {
      const endpoint =
        action === 'withdraw'
          ? `/api/bookings/${bookingId}/withdraw`
          : `/api/bookings/${bookingId}/cancel`;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: reason.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError({
          code: json?.error?.code ?? 'INTERNAL_ERROR',
          message: json?.error?.message ?? t.tripActions.actionFailed,
        });
        return;
      }

      setConfirmMode(null);
      setReason('');
      router.refresh();
    } catch {
      setError({
        code: 'INTERNAL_ERROR',
        message: t.tripActions.networkError,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[var(--color-text)]">
            {status === 'pending'
              ? t.tripActions.manageRequest
              : t.tripActions.manageConfirmed}
          </h2>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
            {status === 'pending'
              ? t.tripActions.withdrawHint
              : t.tripActions.cancelHint}
          </p>
        </div>

        {!confirmMode && canWithdraw && (
          <button
            type="button"
            onClick={() => setConfirmMode('withdraw')}
            className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] text-sm font-medium text-[var(--color-text)] hover:border-[var(--color-danger-text)] hover:text-[var(--color-danger-text)]"
          >
            <XCircle className="w-4 h-4" aria-hidden="true" />
            <span>{t.tripActions.withdrawBtn}</span>
          </button>
        )}

        {!confirmMode && canCancel && (
          <button
            type="button"
            onClick={() => setConfirmMode('cancel')}
            className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-[12px] border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] text-sm font-medium text-[var(--color-danger-text)]"
          >
            <XCircle className="w-4 h-4" aria-hidden="true" />
            <span>{t.tripActions.cancelBtn}</span>
          </button>
        )}
      </div>

      {confirmMode && (
        <div className="pt-3 border-t border-[var(--color-hairline)] space-y-3">
          <label
            htmlFor="trip-action-reason"
            className="block text-sm font-medium text-[var(--color-text)]"
          >
            {t.tripActions.reasonOptional}
          </label>
          <input
            id="trip-action-reason"
            type="text"
            maxLength={400}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={
              confirmMode === 'withdraw'
                ? t.tripActions.withdrawPlaceholder
                : t.tripActions.cancelPlaceholder
            }
            className="w-full min-h-[44px] px-3.5 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] text-sm"
          />

          {error && <ErrorAlert code={error.code} message={error.message} locale={locale} />}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={submitting}
              onClick={() => executeAction(confirmMode)}
              className="min-h-[44px] px-5 rounded-[12px] bg-[var(--color-danger-text)] text-white text-sm font-semibold disabled:opacity-60"
            >
              {submitting
                ? t.tripActions.processing
                : confirmMode === 'withdraw'
                  ? t.tripActions.confirmWithdraw
                  : t.tripActions.confirmCancel}
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => {
                setConfirmMode(null);
                setError(null);
              }}
              className="min-h-[44px] px-4 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] text-sm font-medium text-[var(--color-text)]"
            >
              {t.tripActions.keepBooking}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
