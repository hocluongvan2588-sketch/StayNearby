import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  ArrowLeft,
  Calendar,
  Compass,
  Info,
  Lock,
  MapPin,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { getCurrentUser } from '@/lib/auth/session';
import { isAppError, type ErrorCode } from '@/lib/errors';
import { formatVnd, getTodayIsoInTimezone } from '@/lib/format';
import { formatMoneyFromVnd, getExchangeRateNote } from '@/lib/i18n/currency';
import { getUserMessages, localizePaymentTerms } from '@/lib/i18n/messages';
import { getServerUserPreferences } from '@/lib/i18n/preferences';
import { getBookingDetail } from '@/modules/bookings';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { FallbackImage } from '@/components/ui/FallbackImage';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { TripActions } from '@/components/booking/TripActions';

export const dynamic = 'force-dynamic';

export default async function TripDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [{ id }, user, prefs] = await Promise.all([
    params,
    getCurrentUser(),
    getServerUserPreferences(),
  ]);
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/trips/${id}`)}`);
  }

  const locale = prefs.locale;
  const currency = prefs.currency;
  const t = getUserMessages(locale);

  let booking = null;
  let loadError: { code: ErrorCode; message: string } | null = null;

  try {
    booking = await getBookingDetail(user, id);
  } catch (err) {
    if (isAppError(err)) {
      loadError = { code: err.code, message: err.message };
    } else {
      loadError = { code: 'INTERNAL_ERROR', message: t.tripDetail.loadError };
    }
  }

  if (loadError || !booking) {
    return (
      <div className="container-stay py-10 max-w-2xl space-y-4">
        <Link
          href="/trips"
          className="inline-flex items-center gap-2 min-h-[44px] px-3 -ml-3 rounded-[12px] text-sm font-medium text-[var(--color-text-muted)]"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>{t.tripDetail.backToTrips}</span>
        </Link>
        <ErrorAlert
          code={loadError?.code ?? 'NOT_FOUND'}
          message={loadError?.message ?? t.tripDetail.notFound}
          locale={locale}
        />
      </div>
    );
  }

  const meta =
    booking.status === 'pending' && booking.isExpired
      ? t.bookingStatuses.expired
      : t.bookingStatuses[booking.status];

  const isGuestOwner = booking.guestId === user.id;
  const todayLocal = getTodayIsoInTimezone(booking.timezone);
  const canWithdraw = isGuestOwner && booking.status === 'pending';
  const canCancel =
    isGuestOwner &&
    booking.status === 'confirmed' &&
    todayLocal < booking.checkOut;

  const listingTitle =
    locale === 'vi' ? booking.listingTitleVi : booking.listingTitle;
  const areaName = locale === 'vi' ? booking.areaNameVi : booking.areaNameEn;
  const cityName = locale === 'vi' ? booking.cityVi : booking.cityEn;
  const checkinInstructions =
    locale === 'vi'
      ? booking.checkinInstructionsVi
      : booking.checkinInstructionsEn;

  return (
    <div className="container-stay py-10 md:py-12 max-w-4xl space-y-6">
      <div>
        <Link
          href="/trips"
          className="inline-flex items-center gap-2 min-h-[44px] px-3 -ml-3 rounded-[12px] text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>{t.tripDetail.backToTrips}</span>
        </Link>
      </div>

      {/* Top header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
            {t.tripDetail.bookingPrefix} {booking.bookingCode}
          </p>
          <h1 className="page-title">{listingTitle}</h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            {t.tripDetail.hostedBy}{' '}
            <strong className="text-[var(--color-text)]">{booking.hostName}</strong>
          </p>
        </div>
        <StatusBadge label={meta.label} tone={meta.tone} withIcon />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        <div className="md:col-span-5 space-y-4">
          <FallbackImage
            src={booking.coverPhotoUrl}
            alt={listingTitle}
            fallbackLabel={t.trips.noPhoto}
          />

          <div className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-3 text-sm">
            <div className="flex items-center gap-2.5">
              <MapPin className="w-4 h-4 text-[var(--color-primary)] shrink-0" aria-hidden="true" />
              <span>
                {areaName}, {cityName}
              </span>
            </div>
            <div className="flex items-center gap-2.5 tabular-nums">
              <Calendar className="w-4 h-4 text-[var(--color-primary)] shrink-0" aria-hidden="true" />
              <span>
                {booking.checkIn} – {booking.checkOut} ({booking.nightsCount}{' '}
                {t.trips.nightsUnit}, {booking.timezone})
              </span>
            </div>
            <div className="flex items-center gap-2.5">
              <Users className="w-4 h-4 text-[var(--color-primary)] shrink-0" aria-hidden="true" />
              <span>
                {booking.guestsCount}{' '}
                {booking.guestsCount === 1
                  ? t.search.guestSingular
                  : t.search.guestPlural}
              </span>
            </div>
            <div className="pt-2 border-t border-[var(--color-hairline)]">
              <Link
                href={`/stays/${booking.listingSlug}`}
                className="text-sm font-medium text-[var(--color-primary)] hover:underline underline-offset-4"
              >
                {t.tripDetail.viewListing}
              </Link>
            </div>
          </div>
        </div>

        <div className="md:col-span-7 space-y-5">
          {/* Check-in privacy block */}
          {booking.exactAddress ? (
            <section className="rounded-[12px] border border-[#C4DCD2] bg-[var(--color-primary-soft)] p-5 text-sm space-y-2">
              <h2 className="font-semibold text-[var(--color-primary)]">
                {t.tripDetail.unlockedTitle}
              </h2>
              <p className="text-[var(--color-text)]">
                <strong>{t.trips.addressLabel}</strong> {booking.exactAddress}
              </p>
              <p className="text-[var(--color-text-muted)]">
                <strong>{t.trips.instructionsLabel}</strong>{' '}
                {checkinInstructions || t.tripDetail.defaultCheckinMsg}
              </p>
            </section>
          ) : (
            <section className="rounded-[12px] border border-[var(--color-hairline)] bg-[var(--color-surface-ivory)] p-5 text-sm flex items-start gap-2.5 text-[var(--color-text-muted)]">
              <Lock className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="font-semibold text-[var(--color-text)]">
                  {t.tripDetail.privateProtectedTitle}
                </p>
                <p className="mt-0.5">{t.tripDetail.privateProtectedBody}</p>
              </div>
            </section>
          )}

          {/* Moment 2: Post-confirmation Explore nearby link */}
          {(booking.status === 'confirmed' || booking.status === 'completed') && (
            <section className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1 max-w-md">
                <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--color-primary)]">
                  <Compass className="w-4 h-4" aria-hidden="true" />
                  <span>{areaName}</span>
                </div>
                <h2 className="text-base font-semibold text-[var(--color-text)]">
                  {t.localGuides.exploreNearbyTitle}
                </h2>
                <p className="text-xs text-[var(--color-text-muted)]">
                  {t.localGuides.exploreNearbyBody(areaName)}
                </p>
              </div>

              <Link
                href={`/explore/${booking.areaSlug}`}
                className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-[12px] bg-[var(--color-primary)] text-white text-sm font-medium hover:bg-[var(--color-primary-hover)] transition-colors shrink-0"
              >
                <Compass className="w-4 h-4" aria-hidden="true" />
                <span>{t.localGuides.exploreNearbyCta}</span>
              </Link>
            </section>
          )}

          {/* Price Snapshot (immutable from request creation) */}
          <section className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-[var(--color-text)]">
                {t.tripDetail.snapshotTitle} ({currency})
              </h2>
              <span className="text-xs text-[var(--color-text-muted)]">
                {t.tripDetail.lockedAtRequest}
              </span>
            </div>

            {currency !== 'VND' && (
              <p className="text-xs text-[var(--color-text-muted)]">
                {getExchangeRateNote(currency, locale)}
              </p>
            )}

            <div className="space-y-1.5">
              {booking.nightlyBreakdown.map((night) => (
                <div
                  key={night.date}
                  className="flex items-center justify-between text-[var(--color-text-muted)]"
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
              {booking.cleaningFeeVnd > 0 && (
                <div className="flex items-center justify-between text-[var(--color-text-muted)]">
                  <span>{t.bookingReview.cleaningFee}</span>
                  <span className="tabular-nums text-[var(--color-text)]">
                    {formatMoneyFromVnd(booking.cleaningFeeVnd, currency, locale)}
                  </span>
                </div>
              )}
              <div className="pt-2.5 border-t border-[var(--color-hairline)] flex items-center justify-between text-base font-semibold text-[var(--color-text)]">
                <span>{t.bookingReview.totalLabel}</span>
                <span className="tabular-nums">
                  {formatMoneyFromVnd(booking.totalVnd, currency, locale)}
                </span>
              </div>
              {currency !== 'VND' && (
                <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)]">
                  <span>{t.tripDetail.exactLockedVnd}</span>
                  <span className="tabular-nums font-medium text-[var(--color-text)]">
                    {formatVnd(booking.totalVnd, locale)}
                  </span>
                </div>
              )}
            </div>
          </section>

          {/* Payment & Policy Snapshot */}
          <section className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-3 text-sm">
            <div className="flex items-start gap-2.5">
              <Info className="w-5 h-5 text-[var(--color-primary)] shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="font-semibold text-[var(--color-text)]">
                  {localizePaymentTerms(booking.paymentTerms, locale)}
                </p>
                <p className="text-[var(--color-text-muted)] mt-0.5">
                  {locale === 'vi'
                    ? booking.paymentTermsDetailsVi
                    : booking.paymentTermsDetailsEn}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2.5 pt-3 border-t border-[var(--color-hairline)]">
              <ShieldCheck className="w-5 h-5 text-[var(--color-primary)] shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="font-semibold text-[var(--color-text)]">
                  {t.bookingReview.cancellationPolicyPrefix}{' '}
                  {locale === 'vi'
                    ? booking.cancellationPolicy.titleVi
                    : booking.cancellationPolicy.titleEn}
                </p>
                <p className="text-[var(--color-text-muted)] mt-0.5">
                  {locale === 'vi'
                    ? booking.cancellationPolicy.summaryVi
                    : booking.cancellationPolicy.summaryEn}
                </p>
              </div>
            </div>
          </section>

          {/* Guest Withdraw / Cancel Actions */}
          <TripActions
            bookingId={booking.id}
            status={booking.status}
            canWithdraw={canWithdraw}
            canCancel={canCancel}
          />

          {/* Notes & Audit Timeline */}
          {(booking.guestNote ||
            booking.hostResponseNote ||
            booking.cancellationReason ||
            booking.events.length > 0) && (
            <section className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-3 text-sm">
              <h2 className="text-base font-semibold text-[var(--color-text)]">
                {t.tripDetail.timelineTitle}
              </h2>
              {booking.guestNote && (
                <p className="text-[var(--color-text-muted)]">
                  <strong className="text-[var(--color-text)]">
                    {t.tripDetail.yourNote}
                  </strong>{' '}
                  {booking.guestNote}
                </p>
              )}
              {booking.hostResponseNote && (
                <p className="text-[var(--color-text-muted)]">
                  <strong className="text-[var(--color-text)]">
                    {t.tripDetail.hostResponse}
                  </strong>{' '}
                  {booking.hostResponseNote}
                </p>
              )}
              {booking.cancellationReason && (
                <p className="text-[var(--color-text-muted)]">
                  <strong className="text-[var(--color-text)]">
                    {t.tripDetail.reasonLabel}
                  </strong>{' '}
                  {booking.cancellationReason}
                </p>
              )}
              <ul className="pt-2 border-t border-[var(--color-hairline)] space-y-1.5 text-xs text-[var(--color-text-muted)]">
                {booking.events.map((ev) => (
                  <li key={ev.id} className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      {ev.fromStatus
                        ? `${ev.fromStatus} -> ${ev.toStatus}`
                        : `${t.tripDetail.createdPrefix} (${ev.toStatus})`}{' '}
                      {t.tripDetail.byLabel} {ev.actorRole}
                      {ev.reason ? ` (${ev.reason})` : ''}
                    </span>
                    <span className="tabular-nums">
                      {new Date(ev.createdAt).toISOString().slice(0, 16).replace('T', ' ')} UTC
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
