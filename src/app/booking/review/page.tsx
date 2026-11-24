import Link from 'next/link';
import { ArrowLeft, Calendar, Info, ShieldCheck, Users } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth/session';
import { formatVnd } from '@/lib/format';
import { isAppError, type ErrorCode } from '@/lib/errors';
import { formatMoneyFromVnd, getExchangeRateNote } from '@/lib/i18n/currency';
import { getUserMessages, localizePaymentTerms } from '@/lib/i18n/messages';
import { getServerUserPreferences } from '@/lib/i18n/preferences';
import { calculateStayQuote } from '@/modules/pricing';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { BookingRequestForm } from '@/components/booking/BookingRequestForm';

export const dynamic = 'force-dynamic';

interface BookingReviewPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default async function BookingReviewPage({
  searchParams,
}: BookingReviewPageProps) {
  const [sp, user, prefs] = await Promise.all([
    searchParams,
    getCurrentUser(),
    getServerUserPreferences(),
  ]);
  const locale = prefs.locale;
  const currency = prefs.currency;
  const t = getUserMessages(locale);

  const listingSlug = firstParam(sp.listing) || '';
  const checkIn = firstParam(sp.checkIn) || '';
  const checkOut = firstParam(sp.checkOut) || '';
  const guestsCount = Math.max(1, Number.parseInt(firstParam(sp.guests) || '1', 10) || 1);

  let quote = null;
  let quoteError: { code: ErrorCode; message: string } | null = null;

  if (!listingSlug || !checkIn || !checkOut) {
    quoteError = {
      code: 'VALIDATION_ERROR',
      message: t.bookingReview.missingSelection,
    };
  } else {
    try {
      quote = await calculateStayQuote({
        listingSlug,
        checkIn,
        checkOut,
        guestsCount,
      });
    } catch (err) {
      if (isAppError(err)) {
        quoteError = { code: err.code, message: err.message };
      } else {
        quoteError = {
          code: 'INTERNAL_ERROR',
          message: t.bookingReview.verifyError,
        };
      }
    }
  }

  const currentReviewUrl = `/booking/review?${new URLSearchParams({
    listing: listingSlug,
    checkIn,
    checkOut,
    guests: String(guestsCount),
  }).toString()}`;

  const backToStayHref = listingSlug
    ? `/stays/${encodeURIComponent(listingSlug)}?${new URLSearchParams({
        ...(checkIn ? { checkIn } : {}),
        ...(checkOut ? { checkOut } : {}),
        guests: String(guestsCount),
      }).toString()}`
    : '/stays';

  return (
    <div className="container-stay py-10 md:py-12 max-w-3xl space-y-6">
      <div>
        <Link
          href={backToStayHref}
          className="inline-flex items-center gap-2 min-h-[44px] px-3 -ml-3 rounded-[12px] text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>{t.bookingReview.backToStay}</span>
        </Link>
      </div>

      <div className="space-y-2">
        <h1 className="page-title">{t.bookingReview.title}</h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          {t.bookingReview.subtitle}
        </p>
      </div>

      {quoteError && (
        <div className="space-y-4">
          <ErrorAlert code={quoteError.code} message={quoteError.message} locale={locale} />
          <Link
            href={backToStayHref}
            className="inline-flex items-center min-h-[44px] px-5 rounded-[12px] bg-[var(--color-primary)] text-white text-sm font-medium"
          >
            {t.bookingReview.chooseValidDates}
          </Link>
        </div>
      )}

      {quote && !quote.available && (
        <div className="space-y-4">
          <ErrorAlert
            code="DATES_UNAVAILABLE"
            message={`${t.bookingReview.unavailableNightPrefix} ${quote.blockedDates.join(', ')}`}
            locale={locale}
          />
          <Link
            href={backToStayHref}
            className="inline-flex items-center min-h-[44px] px-5 rounded-[12px] bg-[var(--color-primary)] text-white text-sm font-medium"
          >
            {t.bookingReview.pickDifferentDates}
          </Link>
        </div>
      )}

      {quote && quote.available && (
        <div className="space-y-6">
          {/* Selected Stay & Dates */}
          <section className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-primary)]">
                {locale === 'vi'
                  ? `${quote.areaNameVi}, ${quote.cityVi}`
                  : `${quote.areaNameEn}, ${quote.cityEn}`}
              </p>
              <h2 className="text-xl font-semibold text-[var(--color-text)] mt-1">
                {locale === 'vi' ? quote.listingTitleVi : quote.listingTitle}
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm pt-3 border-t border-[var(--color-hairline)]">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[var(--color-primary)] shrink-0" aria-hidden="true" />
                <div>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {t.bookingReview.datesWithTz(quote.timezone)}
                  </p>
                  <p className="font-medium text-[var(--color-text)] tabular-nums">
                    {quote.checkIn} – {quote.checkOut} ({quote.nightsCount}{' '}
                    {t.bookingReview.nightsUnit})
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-[var(--color-primary)] shrink-0" aria-hidden="true" />
                <div>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {t.bookingReview.guestsLabel}
                  </p>
                  <p className="font-medium text-[var(--color-text)]">
                    {quote.guestsCount}{' '}
                    {quote.guestsCount === 1
                      ? t.search.guestSingular
                      : t.search.guestPlural}
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Price Breakdown */}
          <section className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-semibold text-[var(--color-text)]">
                {t.bookingReview.priceDetailsTitle} ({currency})
              </h2>
              {currency !== 'VND' && (
                <span className="text-xs text-[var(--color-text-muted)]">
                  {getExchangeRateNote(currency, locale)}
                </span>
              )}
            </div>
            <div className="space-y-2 text-sm">
              {quote.nightlyBreakdown.map((night) => (
                <div
                  key={night.date}
                  className="flex items-center justify-between gap-2 text-[var(--color-text-muted)]"
                >
                  <span>
                    {night.date}
                    {night.isOverride ? t.bookingReview.seasonalRate : ''}
                  </span>
                  <span className="tabular-nums text-[var(--color-text)]">
                    {formatMoneyFromVnd(night.rateVnd, currency, locale)}
                  </span>
                </div>
              ))}
              {quote.cleaningFeeVnd > 0 && (
                <div className="flex items-center justify-between gap-2 text-[var(--color-text-muted)]">
                  <span>{t.bookingReview.cleaningFee}</span>
                  <span className="tabular-nums text-[var(--color-text)]">
                    {formatMoneyFromVnd(quote.cleaningFeeVnd, currency, locale)}
                  </span>
                </div>
              )}
              <div className="pt-3 border-t border-[var(--color-hairline)] flex items-center justify-between text-base font-semibold text-[var(--color-text)]">
                <span>{t.bookingReview.totalLabel}</span>
                <span className="tabular-nums">
                  {formatMoneyFromVnd(quote.totalVnd, currency, locale)}
                </span>
              </div>
              {currency !== 'VND' && (
                <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)]">
                  <span>{t.bookingReview.exactVndPayableNote}</span>
                  <span className="tabular-nums font-medium text-[var(--color-text)]">
                    {formatVnd(quote.totalVnd, locale)}
                  </span>
                </div>
              )}
            </div>
          </section>

          {/* Policy & Direct Pay */}
          <section className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-3 text-sm">
            <div className="flex items-start gap-2.5">
              <Info className="w-5 h-5 text-[var(--color-primary)] shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="font-semibold text-[var(--color-text)]">
                  {localizePaymentTerms(quote.paymentTerms, locale)}
                </p>
                <p className="text-[var(--color-text-muted)] mt-0.5">
                  {locale === 'vi'
                    ? quote.paymentTermsDetailsVi
                    : quote.paymentTermsDetailsEn}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5 pt-3 border-t border-[var(--color-hairline)]">
              <ShieldCheck className="w-5 h-5 text-[var(--color-primary)] shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="font-semibold text-[var(--color-text)]">
                  {t.bookingReview.cancellationPolicyPrefix}{' '}
                  {locale === 'vi'
                    ? quote.cancellationPolicy.titleVi
                    : quote.cancellationPolicy.titleEn}
                </p>
                <p className="text-[var(--color-text-muted)] mt-0.5">
                  {locale === 'vi'
                    ? quote.cancellationPolicy.summaryVi
                    : quote.cancellationPolicy.summaryEn}
                </p>
              </div>
            </div>
          </section>

          {/* Auth preservation OR Live Booking Submission */}
          {!user ? (
            <div className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-3">
              <p className="text-sm font-semibold text-[var(--color-text)]">
                {t.bookingReview.signInRequiredTitle}
              </p>
              <p className="text-sm text-[var(--color-text-muted)]">
                {t.bookingReview.signInRequiredBody}
              </p>
              <Link
                href={`/login?next=${encodeURIComponent(currentReviewUrl)}`}
                className="inline-flex items-center justify-center min-h-[44px] px-5 rounded-[12px] bg-[var(--color-primary)] text-white text-sm font-semibold hover:bg-[var(--color-primary-hover)]"
              >
                {t.bookingReview.signInKeepSelection}
              </Link>
            </div>
          ) : (
            <BookingRequestForm
              initialQuote={quote}
              userDisplayName={user.displayName}
            />
          )}
        </div>
      )}
    </div>
  );
}
