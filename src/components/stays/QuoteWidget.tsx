'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Calendar, Info, ShieldCheck, Users } from 'lucide-react';
import { addDaysIso, formatVnd, getTodayIsoInTimezone } from '@/lib/format';
import { formatMoneyFromVnd, getExchangeRateNote } from '@/lib/i18n/currency';
import { getUserMessages, localizePaymentTerms } from '@/lib/i18n/messages';
import { useUserPreferences } from '@/components/i18n/UserPreferencesProvider';
import type { StayQuote } from '@/modules/pricing';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { StatusBadge } from '@/components/ui/StatusBadge';
import type { ErrorCode } from '@/lib/errors';

interface QuoteWidgetProps {
  listingId: string;
  listingSlug: string;
  timezone: string;
  maxGuests: number;
  minNights: number;
  maxNights: number;
  baseNightlyRateVnd: number;
  cleaningFeeVnd: number;
  paymentTerms: string;
  cancellationTitleEn: string;
  cancellationTitleVi: string;
  initialCheckIn?: string;
  initialCheckOut?: string;
  initialGuests?: number;
}

export function QuoteWidget({
  listingId,
  listingSlug,
  timezone,
  maxGuests,
  minNights,
  maxNights,
  baseNightlyRateVnd,
  cleaningFeeVnd,
  paymentTerms,
  cancellationTitleEn,
  cancellationTitleVi,
  initialCheckIn,
  initialCheckOut,
  initialGuests,
}: QuoteWidgetProps) {
  const router = useRouter();
  const { preferences } = useUserPreferences();
  const locale = preferences.locale;
  const currency = preferences.currency;
  const t = getUserMessages(locale);

  const checkInRef = useRef<HTMLInputElement>(null);
  const minDate = getTodayIsoInTimezone(timezone);

  const [checkIn, setCheckIn] = useState(initialCheckIn ?? '');
  const [checkOut, setCheckOut] = useState(initialCheckOut ?? '');
  const [guests, setGuests] = useState(
    Math.min(maxGuests, Math.max(1, initialGuests ?? 1))
  );

  const [loading, setLoading] = useState(false);
  const [quote, setQuote] = useState<StayQuote | null>(null);
  const [errorState, setErrorState] = useState<{
    code?: ErrorCode;
    message?: string;
  } | null>(null);
  const [clientNotice, setClientNotice] = useState<{
    code?: ErrorCode;
    message?: string;
  } | null>(null);

  const hasBothDates = Boolean(checkIn && checkOut);
  const isDateOrderValid = Boolean(hasBothDates && checkOut > checkIn);

  useEffect(() => {
    if (!isDateOrderValid) {
      return;
    }

    let cancelled = false;
    async function loadQuote() {
      setLoading(true);
      setErrorState(null);
      setClientNotice(null);
      try {
        const qs = new URLSearchParams({
          listingId,
          checkIn,
          checkOut,
          guests: String(guests),
        });
        const res = await fetch(`/api/pricing/quote?${qs.toString()}`);
        const json = await res.json();
        if (cancelled) return;

        if (!res.ok || !json.ok) {
          setQuote(null);
          setErrorState({
            code: json?.error?.code ?? 'VALIDATION_ERROR',
            message: json?.error?.message ?? t.quoteWidget.fetchError,
          });
          return;
        }
        setQuote(json.quote as StayQuote);
      } catch {
        if (!cancelled) {
          setQuote(null);
          setErrorState({
            code: 'INTERNAL_ERROR',
            message: t.quoteWidget.fetchError,
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadQuote();
    return () => {
      cancelled = true;
    };
  }, [listingId, checkIn, checkOut, guests, isDateOrderValid, t.quoteWidget.fetchError]);

  const activeQuote = isDateOrderValid ? quote : null;
  const activeError =
    hasBothDates && !isDateOrderValid
      ? {
          code: 'VALIDATION_ERROR' as ErrorCode,
          message: t.quoteWidget.checkOutAfterCheckIn,
        }
      : (clientNotice ?? (isDateOrderValid ? errorState : null));

  function handleRequestClick() {
    if (!checkIn || !checkOut) {
      setClientNotice({
        code: 'VALIDATION_ERROR',
        message: t.quoteWidget.selectDatesError,
      });
      checkInRef.current?.focus();
      checkInRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (!activeQuote || !activeQuote.available) {
      return;
    }

    const params = new URLSearchParams({
      listing: listingSlug,
      checkIn,
      checkOut,
      guests: String(guests),
    });
    router.push(`/booking/review?${params.toString()}`);
  }

  const cancellationTitle =
    locale === 'vi' ? cancellationTitleVi : cancellationTitleEn;
  const localizedPaymentTerms = localizePaymentTerms(paymentTerms, locale);

  return (
    <>
      <aside
        aria-label="Booking quote and request"
        className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-apple-card p-6 space-y-4"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2 pb-3 border-b border-[var(--color-border)]">
          <div>
            <p className="text-xl font-semibold text-[var(--color-text)] tabular-nums">
              {formatMoneyFromVnd(baseNightlyRateVnd, currency, locale)}{' '}
              <span className="text-sm font-normal text-[var(--color-text-muted)]">
                {t.quoteWidget.perNight}
              </span>
            </p>
            {currency !== 'VND' && (
              <p className="text-xs text-[var(--color-text-muted)] tabular-nums mt-0.5">
                {formatVnd(baseNightlyRateVnd, locale)} {t.quoteWidget.perNight} ·{' '}
                {getExchangeRateNote(currency, locale)}
              </p>
            )}
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              {t.quoteWidget.minMaxNights(minNights, maxNights)}
            </p>
          </div>
          {activeQuote && !activeQuote.available && (
            <StatusBadge
              label={t.quoteWidget.datesUnavailableBadge}
              tone="danger"
              withIcon
            />
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="quote-checkin"
              className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)] mb-1.5"
            >
              <Calendar className="w-4 h-4" aria-hidden="true" />
              <span>{t.quoteWidget.checkIn}</span>
            </label>
            <input
              ref={checkInRef}
              id="quote-checkin"
              type="date"
              min={minDate}
              value={checkIn}
              onChange={(e) => {
                const val = e.target.value;
                setCheckIn(val);
                if (val && (!checkOut || checkOut <= val)) {
                  setCheckOut(addDaysIso(val, minNights));
                }
              }}
              className="w-full min-h-[44px] px-3 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-bg)] text-sm"
            />
          </div>

          <div>
            <label
              htmlFor="quote-checkout"
              className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)] mb-1.5"
            >
              <Calendar className="w-4 h-4" aria-hidden="true" />
              <span>{t.quoteWidget.checkOut}</span>
            </label>
            <input
              id="quote-checkout"
              type="date"
              min={checkIn ? addDaysIso(checkIn, minNights) : addDaysIso(minDate, 1)}
              value={checkOut}
              onChange={(e) => setCheckOut(e.target.value)}
              className="w-full min-h-[44px] px-3 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-bg)] text-sm"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="quote-guests"
            className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)] mb-1.5"
          >
            <Users className="w-4 h-4" aria-hidden="true" />
            <span>{t.quoteWidget.guests}</span>
          </label>
          <select
            id="quote-guests"
            value={guests}
            onChange={(e) => setGuests(Number(e.target.value))}
            className="w-full min-h-[44px] px-3 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-bg)] text-sm"
          >
            {Array.from({ length: maxGuests }, (_, idx) => idx + 1).map((n) => (
              <option key={n} value={n}>
                {n} {n === 1 ? t.search.guestSingular : t.search.guestPlural}
              </option>
            ))}
          </select>
        </div>

        {activeError && (
          <ErrorAlert code={activeError.code} message={activeError.message} locale={locale} />
        )}

        {loading && (
          <div className="p-3 rounded-[12px] bg-[var(--color-surface-muted)] text-sm text-[var(--color-text-muted)]">
            {t.quoteWidget.calculating}
          </div>
        )}

        {activeQuote && !activeQuote.available && (
          <div className="p-3 rounded-[12px] border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] text-sm text-[var(--color-danger-text)] space-y-1">
            <p className="font-semibold">{t.quoteWidget.datesUnavailableTitle}</p>
            <p className="text-xs">
              {t.quoteWidget.datesUnavailableHint(activeQuote.blockedDates.join(', '))}
            </p>
          </div>
        )}

        {activeQuote && activeQuote.available && (
          <div className="space-y-2.5 pt-2 border-t border-[var(--color-border)] text-sm">
            <div className="space-y-1.5">
              {activeQuote.nightlyBreakdown.map((night) => (
                <div
                  key={night.date}
                  className="flex items-center justify-between gap-2 text-[var(--color-text-muted)]"
                >
                  <span>
                    {night.date}
                    {night.isOverride ? t.quoteWidget.seasonalRateTag : ''}
                  </span>
                  <span className="tabular-nums text-[var(--color-text)]">
                    {formatMoneyFromVnd(night.rateVnd, currency, locale)}
                  </span>
                </div>
              ))}
              {cleaningFeeVnd > 0 && (
                <div className="flex items-center justify-between gap-2 text-[var(--color-text-muted)]">
                  <span>{t.quoteWidget.cleaningFee}</span>
                  <span className="tabular-nums text-[var(--color-text)]">
                    {formatMoneyFromVnd(activeQuote.cleaningFeeVnd, currency, locale)}
                  </span>
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-[var(--color-border)] flex items-center justify-between text-base font-semibold text-[var(--color-text)]">
              <span>{t.quoteWidget.totalForNights(activeQuote.nightsCount)}</span>
              <span className="tabular-nums">
                {formatMoneyFromVnd(activeQuote.totalVnd, currency, locale)}
              </span>
            </div>

            {currency !== 'VND' && (
              <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)]">
                <span>{t.quoteWidget.exactVndTotal}</span>
                <span className="tabular-nums font-medium text-[var(--color-text)]">
                  {formatVnd(activeQuote.totalVnd, locale)}
                </span>
              </div>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={handleRequestClick}
          disabled={loading || (activeQuote !== null && !activeQuote.available)}
          className="w-full min-h-[48px] px-4 rounded-[12px] bg-[var(--color-primary)] text-white text-[15px] font-semibold hover:bg-[var(--color-primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {activeQuote?.available
            ? t.quoteWidget.requestToBook
            : t.quoteWidget.checkDatesAndBook}
        </button>

        <div className="space-y-2 pt-2 text-xs text-[var(--color-text-muted)]">
          <p className="flex items-start gap-2">
            <Info className="w-4 h-4 shrink-0 mt-0.5 text-[var(--color-primary)]" aria-hidden="true" />
            <span>
              {t.quoteWidget.paymentTermLabel}:{' '}
              <strong className="text-[var(--color-text)]">{localizedPaymentTerms}</strong>.{' '}
              {t.quoteWidget.noOnlineChargeNote}
            </span>
          </p>
          <p className="flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-[var(--color-primary)]" aria-hidden="true" />
            <span>
              {t.quoteWidget.cancellationPolicyLabel}: {cancellationTitle}
            </span>
          </p>
        </div>
      </aside>

      {/* Mobile bottom sticky price + CTA bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
        <div className="max-w-[1320px] mx-auto flex items-center justify-between gap-3">
          <div className="min-w-0">
            {activeQuote && activeQuote.available ? (
              <>
                <p className="text-[15px] font-semibold text-[var(--color-text)] tabular-nums truncate">
                  {formatMoneyFromVnd(activeQuote.totalVnd, currency, locale)}
                </p>
                <p className="text-xs text-[var(--color-text-muted)] truncate">
                  {t.quoteWidget.totalMobileSubtitle(activeQuote.nightsCount)}
                  {currency !== 'VND' ? ` (${formatVnd(activeQuote.totalVnd, locale)})` : ''}
                </p>
              </>
            ) : (
              <>
                <p className="text-[15px] font-semibold text-[var(--color-text)] tabular-nums truncate">
                  {formatMoneyFromVnd(baseNightlyRateVnd, currency, locale)}
                </p>
                <p className="text-xs text-[var(--color-text-muted)] truncate">
                  {t.quoteWidget.perNightMobile}
                </p>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={handleRequestClick}
            disabled={loading || (activeQuote !== null && !activeQuote.available)}
            className="shrink-0 min-h-[44px] px-5 rounded-[12px] bg-[var(--color-primary)] text-white text-sm font-semibold hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
          >
            {t.quoteWidget.requestToBook}
          </button>
        </div>
      </div>
    </>
  );
}
