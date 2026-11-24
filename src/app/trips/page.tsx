import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight, Calendar, Lock, MapPin, Users } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth/session';
import { formatVnd } from '@/lib/format';
import { formatMoneyFromVnd } from '@/lib/i18n/currency';
import { getUserMessages, localizePaymentTerms } from '@/lib/i18n/messages';
import { getServerUserPreferences } from '@/lib/i18n/preferences';
import { getGuestTrips } from '@/modules/bookings';
import { FallbackImage } from '@/components/ui/FallbackImage';
import { StatusBadge } from '@/components/ui/StatusBadge';

export const dynamic = 'force-dynamic';

export default async function TripsPage() {
  const [user, prefs] = await Promise.all([
    getCurrentUser(),
    getServerUserPreferences(),
  ]);
  if (!user) {
    redirect('/login?next=/trips');
  }

  const locale = prefs.locale;
  const currency = prefs.currency;
  const t = getUserMessages(locale);

  const trips = await getGuestTrips(user);

  return (
    <div className="container-stay py-10 md:py-12 space-y-6">
      <div className="space-y-2">
        <h1 className="page-title">{t.trips.title}</h1>
        <p className="text-sm text-[var(--color-text-muted)]">{t.trips.subtitle}</p>
      </div>

      {trips.length === 0 ? (
        <div className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface-ivory)] p-10 text-center space-y-3">
          <h2 className="text-lg font-semibold text-[var(--color-text)]">
            {t.trips.emptyTitle}
          </h2>
          <p className="text-sm text-[var(--color-text-muted)]">
            {t.trips.emptyBody}
          </p>
          <div className="pt-2">
            <Link
              href="/stays"
              className="inline-flex items-center min-h-[44px] px-5 rounded-[12px] bg-[var(--color-primary)] text-white text-sm font-medium"
            >
              {t.trips.exploreStays}
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {trips.map((trip) => {
            const meta =
              trip.status === 'pending' && trip.isExpired
                ? { label: t.trips.responseWindowPassed, tone: 'neutral' as const }
                : t.bookingStatuses[trip.status];
            const listingTitle =
              locale === 'vi' ? trip.listingTitleVi : trip.listingTitle;
            const areaName =
              locale === 'vi' ? trip.areaNameVi : trip.areaNameEn;
            const cityName = locale === 'vi' ? trip.cityVi : trip.cityEn;
            const checkinInstructions =
              locale === 'vi'
                ? trip.checkinInstructionsVi
                : trip.checkinInstructionsEn;

            return (
              <article
                key={trip.id}
                className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-apple-subtle p-4 md:p-5 grid grid-cols-1 md:grid-cols-12 gap-5 items-start"
              >
                <div className="md:col-span-3">
                  <Link href={`/trips/${trip.id}`} className="block">
                    <FallbackImage
                      src={trip.coverPhotoUrl}
                      alt={listingTitle}
                      fallbackLabel={t.trips.noPhoto}
                    />
                  </Link>
                </div>

                <div className="md:col-span-9 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                      {trip.bookingCode}
                    </span>
                    <StatusBadge label={meta.label} tone={meta.tone} withIcon />
                  </div>

                  <h2 className="text-xl font-semibold text-[var(--color-text)]">
                    <Link
                      href={`/trips/${trip.id}`}
                      className="hover:text-[var(--color-primary)] transition-colors"
                    >
                      {listingTitle}
                    </Link>
                  </h2>

                  <div className="flex flex-wrap gap-4 text-sm text-[var(--color-text-muted)]">
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-[var(--color-primary)]" aria-hidden="true" />
                      <span>
                        {areaName}, {cityName}
                      </span>
                    </span>
                    <span className="inline-flex items-center gap-1.5 tabular-nums">
                      <Calendar className="w-4 h-4 text-[var(--color-primary)]" aria-hidden="true" />
                      <span>
                        {trip.checkIn} – {trip.checkOut} ({trip.nightsCount}{' '}
                        {t.trips.nightsUnit})
                      </span>
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-[var(--color-primary)]" aria-hidden="true" />
                      <span>
                        {trip.guestsCount}{' '}
                        {trip.guestsCount === 1
                          ? t.search.guestSingular
                          : t.search.guestPlural}
                      </span>
                    </span>
                  </div>

                  <div className="pt-3 border-t border-[var(--color-hairline)] flex flex-wrap items-center justify-between gap-3 text-sm">
                    <div>
                      <p className="font-semibold text-[var(--color-text)] tabular-nums">
                        {t.trips.totalLabel}{' '}
                        {formatMoneyFromVnd(trip.totalVnd, currency, locale)}{' '}
                        <span className="font-normal text-[var(--color-text-muted)]">
                          ({localizePaymentTerms(trip.paymentTerms, locale)})
                        </span>
                      </p>
                      {currency !== 'VND' && (
                        <p className="text-xs text-[var(--color-text-muted)] tabular-nums">
                          {t.tripDetail.exactLockedVnd}: {formatVnd(trip.totalVnd, locale)}
                        </p>
                      )}
                    </div>
                    <Link
                      href={`/trips/${trip.id}`}
                      className="inline-flex items-center gap-1.5 min-h-[44px] px-4 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] text-sm font-medium text-[var(--color-text)] hover:border-[var(--color-primary)]"
                    >
                      <span>{t.trips.viewDetails}</span>
                      <ArrowRight className="w-4 h-4" aria-hidden="true" />
                    </Link>
                  </div>

                  {trip.exactAddress ? (
                    <div className="rounded-[12px] border border-[#C4DCD2] bg-[var(--color-primary-soft)] p-3.5 text-sm space-y-1">
                      <p className="font-semibold text-[var(--color-primary)]">
                        {t.trips.unlockedTitle}
                      </p>
                      <p className="text-[var(--color-text)]">
                        <strong>{t.trips.addressLabel}</strong> {trip.exactAddress}
                      </p>
                      <p className="text-[var(--color-text-muted)]">
                        <strong>{t.trips.instructionsLabel}</strong> {checkinInstructions}
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-[12px] border border-[var(--color-hairline)] bg-[var(--color-surface-ivory)] p-3.5 text-xs text-[var(--color-text-muted)] flex items-center gap-2">
                      <Lock className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span>{t.trips.lockedNote}</span>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
