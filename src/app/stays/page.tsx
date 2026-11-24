import Link from 'next/link';
import { Suspense } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { listPublishedAreas, searchPublishedStays } from '@/modules/catalog';
import { isAppError } from '@/lib/errors';
import { getUserMessages } from '@/lib/i18n/messages';
import { getServerUserPreferences } from '@/lib/i18n/preferences';
import type { SupportedCurrency, UserLocale } from '@/lib/i18n/types';
import { SearchBar } from '@/components/stays/SearchBar';
import { StayCard } from '@/components/stays/StayCard';
import { ErrorAlert } from '@/components/ui/ErrorAlert';

export const dynamic = 'force-dynamic';

interface StaysPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function StaysResultsSkeleton() {
  return (
    <div className="stays-grid" aria-busy="true" aria-label="Loading stays">
      {Array.from({ length: 4 }, (_, idx) => (
        <div key={idx} className="space-y-3">
          <div className="aspect-[4/3] w-full rounded-[12px] bg-[var(--color-surface-muted)]" />
          <div className="h-4 w-32 rounded bg-[var(--color-surface-muted)]" />
          <div className="h-5 w-48 rounded bg-[var(--color-surface-muted)]" />
          <div className="h-4 w-28 rounded bg-[var(--color-surface-muted)]" />
        </div>
      ))}
    </div>
  );
}

async function StaysResultsSection({
  area,
  q,
  checkIn,
  checkOut,
  guests,
  amenity,
  propertyType,
  lateCheckin,
  page,
  locale,
  currency,
}: {
  area?: string;
  q?: string;
  checkIn?: string;
  checkOut?: string;
  guests?: number;
  amenity?: string;
  propertyType?: string;
  lateCheckin?: boolean;
  page: number;
  locale: UserLocale;
  currency: SupportedCurrency;
}) {
  const t = getUserMessages(locale);

  let searchResult = null;
  let searchError: { code?: 'VALIDATION_ERROR' | 'INTERNAL_ERROR'; message: string } | null =
    null;

  try {
    searchResult = await searchPublishedStays({
      area,
      q,
      checkIn,
      checkOut,
      guests: guests && Number.isFinite(guests) ? guests : undefined,
      amenity,
      propertyType,
      lateCheckin,
      page,
      pageSize: 8,
    });
  } catch (err) {
    if (isAppError(err)) {
      searchError = { code: 'VALIDATION_ERROR', message: err.message };
    } else {
      searchError = {
        code: 'INTERNAL_ERROR',
        message: t.staysPage.loadError,
      };
    }
  }

  function buildPageHref(targetPage: number): string {
    const params = new URLSearchParams();
    if (area) params.set('area', area);
    if (q) params.set('q', q);
    if (checkIn) params.set('checkIn', checkIn);
    if (checkOut) params.set('checkOut', checkOut);
    if (guests && guests > 1) params.set('guests', String(guests));
    if (amenity) params.set('amenity', amenity);
    if (propertyType) params.set('propertyType', propertyType);
    if (lateCheckin) params.set('lateCheckin', 'true');
    if (targetPage > 1) params.set('page', String(targetPage));
    const qs = params.toString();
    return qs ? `/stays?${qs}` : '/stays';
  }

  if (searchError) {
    return (
      <ErrorAlert
        code={searchError.code}
        message={searchError.message}
        locale={locale}
      />
    );
  }

  if (!searchResult) return null;

  const selectedDates = searchResult.appliedDates
    ? {
        checkIn: searchResult.appliedDates.checkIn,
        checkOut: searchResult.appliedDates.checkOut,
        guests,
      }
    : guests && guests > 1
      ? { checkIn: '', checkOut: '', guests }
      : null;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[var(--color-hairline)] text-sm text-[var(--color-text-muted)]">
        <p>
          <strong className="text-[var(--color-text)]">
            {t.staysPage.showingCount(searchResult.total)}
          </strong>
          {searchResult.appliedDates
            ? t.staysPage.availableDatesSuffix(
                searchResult.appliedDates.checkIn,
                searchResult.appliedDates.checkOut,
                searchResult.appliedDates.nightsCount
              )
            : ''}
        </p>
        <p className="text-xs">{t.staysPage.pricingUnitNote(currency)}</p>
      </div>

      {searchResult.items.length === 0 ? (
        <div className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface-ivory)] p-10 text-center space-y-3">
          <h2 className="text-lg font-semibold text-[var(--color-text)]">
            {t.staysPage.noMatchTitle}
          </h2>
          <p className="text-sm text-[var(--color-text-muted)] max-w-md mx-auto">
            {t.staysPage.noMatchBody}
          </p>
          <div className="pt-2">
            <Link
              href="/stays"
              className="inline-flex items-center justify-center min-h-[44px] px-5 rounded-[12px] bg-[var(--color-primary)] text-white text-sm font-medium hover:bg-[var(--color-primary-hover)]"
            >
              {t.staysPage.resetAllFilters}
            </Link>
          </div>
        </div>
      ) : (
        <div className="stays-grid">
          {searchResult.items.map((stay) => (
            <StayCard
              key={stay.id}
              stay={stay}
              selectedDates={selectedDates}
              locale={locale}
              currency={currency}
            />
          ))}
        </div>
      )}

      {searchResult.totalPages > 1 && (
        <nav
          aria-label="Search pagination"
          className="flex items-center justify-center gap-3 pt-6"
        >
          <Link
            href={buildPageHref(Math.max(1, searchResult.page - 1))}
            aria-disabled={searchResult.page <= 1}
            className={`inline-flex items-center gap-1 min-h-[44px] px-4 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] text-sm font-medium ${
              searchResult.page <= 1
                ? 'pointer-events-none opacity-45'
                : 'hover:bg-[var(--color-surface-muted)]'
            }`}
          >
            <ChevronLeft className="w-4 h-4" aria-hidden="true" />
            <span>{t.staysPage.previous}</span>
          </Link>
          <span className="text-sm text-[var(--color-text-muted)] tabular-nums">
            {t.staysPage.pageOf(searchResult.page, searchResult.totalPages)}
          </span>
          <Link
            href={buildPageHref(Math.min(searchResult.totalPages, searchResult.page + 1))}
            aria-disabled={searchResult.page >= searchResult.totalPages}
            className={`inline-flex items-center gap-1 min-h-[44px] px-4 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] text-sm font-medium ${
              searchResult.page >= searchResult.totalPages
                ? 'pointer-events-none opacity-45'
                : 'hover:bg-[var(--color-surface-muted)]'
            }`}
          >
            <span>{t.staysPage.next}</span>
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </Link>
        </nav>
      )}
    </>
  );
}

export default async function StaysPage({ searchParams }: StaysPageProps) {
  const [sp, prefs, areas] = await Promise.all([
    searchParams,
    getServerUserPreferences(),
    listPublishedAreas(),
  ]);
  const t = getUserMessages(prefs.locale);

  const area = firstParam(sp.area);
  const q = firstParam(sp.q);
  const checkIn = firstParam(sp.checkIn);
  const checkOut = firstParam(sp.checkOut);
  const guestsRaw = firstParam(sp.guests);
  const amenity = firstParam(sp.amenity);
  const propertyType = firstParam(sp.propertyType);
  const lateCheckinRaw = firstParam(sp.lateCheckin);
  const pageRaw = firstParam(sp.page);

  const guests = guestsRaw ? Number.parseInt(guestsRaw, 10) : undefined;
  const lateCheckin = lateCheckinRaw === 'true';
  const page = pageRaw ? Math.max(1, Number.parseInt(pageRaw, 10) || 1) : 1;

  return (
    <div className="container-stay py-10 md:py-14 space-y-8">
      <div className="space-y-2 max-w-2xl">
        <h1 className="page-title">{t.staysPage.title}</h1>
        <p className="text-[15px] text-[var(--color-text-muted)]">
          {t.staysPage.subtitle}
        </p>
      </div>

      <SearchBar
        areas={areas}
        showExtendedFilters
        initialValues={{
          area,
          checkIn,
          checkOut,
          guests: guests && Number.isFinite(guests) ? guests : 1,
          amenity,
          propertyType,
          lateCheckin,
        }}
      />

      <Suspense fallback={<StaysResultsSkeleton />}>
        <StaysResultsSection
          area={area}
          q={q}
          checkIn={checkIn}
          checkOut={checkOut}
          guests={guests}
          amenity={amenity}
          propertyType={propertyType}
          lateCheckin={lateCheckin}
          page={page}
          locale={prefs.locale}
          currency={prefs.currency}
        />
      </Suspense>
    </div>
  );
}
