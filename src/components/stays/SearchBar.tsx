'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Calendar, MapPin, Search, SlidersHorizontal, Users, X } from 'lucide-react';
import type { PublicArea } from '@/modules/catalog';
import { addDaysIso, getTodayIsoInTimezone } from '@/lib/format';
import { getUserMessages } from '@/lib/i18n/messages';
import { useUserPreferences } from '@/components/i18n/UserPreferencesProvider';

interface SearchBarProps {
  areas: PublicArea[];
  initialValues?: {
    area?: string;
    checkIn?: string;
    checkOut?: string;
    guests?: number;
    amenity?: string;
    propertyType?: string;
    lateCheckin?: boolean;
  };
  showExtendedFilters?: boolean;
}

export function SearchBar({
  areas,
  initialValues,
  showExtendedFilters = false,
}: SearchBarProps) {
  const router = useRouter();
  const { preferences } = useUserPreferences();
  const locale = preferences.locale;
  const t = getUserMessages(locale);

  const minDate = getTodayIsoInTimezone('Asia/Ho_Chi_Minh');

  const [area, setArea] = useState(initialValues?.area ?? '');
  const [checkIn, setCheckIn] = useState(initialValues?.checkIn ?? '');
  const [checkOut, setCheckOut] = useState(initialValues?.checkOut ?? '');
  const [guests, setGuests] = useState(String(initialValues?.guests ?? 1));
  const [amenity, setAmenity] = useState(initialValues?.amenity ?? '');
  const [propertyType, setPropertyType] = useState(
    initialValues?.propertyType ?? ''
  );
  const [lateCheckin, setLateCheckin] = useState(
    Boolean(initialValues?.lateCheckin)
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  const [validationMsg, setValidationMsg] = useState<string | null>(null);

  function buildUrl(): string | null {
    if ((checkIn && !checkOut) || (!checkIn && checkOut)) {
      setValidationMsg(t.search.needBothDates);
      return null;
    }
    if (checkIn && checkOut && checkOut <= checkIn) {
      setValidationMsg(t.search.checkOutAfterCheckIn);
      return null;
    }
    setValidationMsg(null);

    const params = new URLSearchParams();
    if (area) params.set('area', area);
    if (checkIn) params.set('checkIn', checkIn);
    if (checkOut) params.set('checkOut', checkOut);
    if (guests && Number(guests) > 1) params.set('guests', guests);
    if (amenity) params.set('amenity', amenity);
    if (propertyType) params.set('propertyType', propertyType);
    if (lateCheckin) params.set('lateCheckin', 'true');

    const qs = params.toString();
    return qs ? `/stays?${qs}` : '/stays';
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const url = buildUrl();
    if (!url) return;
    setMobileOpen(false);
    router.push(url);
  }

  function handleReset() {
    setArea('');
    setCheckIn('');
    setCheckOut('');
    setGuests('1');
    setAmenity('');
    setPropertyType('');
    setLateCheckin(false);
    setValidationMsg(null);
    setMobileOpen(false);
    router.push('/stays');
  }

  const matchedArea = areas.find((a) => a.slug === area);
  const selectedAreaLabel = matchedArea
    ? locale === 'vi'
      ? matchedArea.nameVi
      : matchedArea.nameEn
    : t.search.allVietnamAreas;

  const guestsNum = Number(guests);
  const guestLabel =
    guestsNum === 1 ? t.search.guestSingular : t.search.guestPlural;
  const summaryText =
    checkIn && checkOut
      ? `${selectedAreaLabel}, ${checkIn} – ${checkOut}, ${guests} ${guestLabel}`
      : `${selectedAreaLabel}, ${guests} ${guestLabel}`;

  return (
    <div className="w-full">
      {/* Mobile summary button opening filter panel */}
      <div className="md:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="w-full min-h-[54px] px-4 py-3 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-apple-subtle flex items-center justify-between gap-3 text-left"
        >
          <div className="flex items-center gap-3 min-w-0">
            <Search
              className="w-5 h-5 text-[var(--color-primary)] shrink-0"
              aria-hidden="true"
            />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[var(--color-text)] truncate">
                {t.search.mobileSearchTitle}
              </p>
              <p className="text-xs text-[var(--color-text-muted)] truncate">
                {summaryText}
              </p>
            </div>
          </div>
          <SlidersHorizontal
            className="w-5 h-5 text-[var(--color-text-muted)] shrink-0"
            aria-hidden="true"
          />
        </button>
      </div>

      {/* Mobile Filter Sheet Modal */}
      {mobileOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t.search.filterModalTitle}
          className="md:hidden fixed inset-0 z-50 bg-black/35 flex items-end sm:items-center justify-center p-0 sm:p-4"
        >
          <div className="w-full max-h-[90vh] overflow-y-auto bg-[var(--color-surface)] rounded-t-[16px] sm:rounded-[12px] border border-[var(--color-border)] p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--color-hairline)]">
              <h2 className="text-lg font-semibold text-[var(--color-text)]">
                {t.search.filterModalTitle}
              </h2>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label={t.search.closeFiltersAria}
                className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-[12px] border border-[var(--color-border)] text-[var(--color-text)]"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="mobile-area"
                  className="block text-sm font-medium text-[var(--color-text)] mb-1.5"
                >
                  {t.search.areaLabel}
                </label>
                <select
                  id="mobile-area"
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  className="w-full min-h-[44px] px-3 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] text-[15px]"
                >
                  <option value="">{t.search.allVietnamAreas}</option>
                  {areas.map((a) => (
                    <option key={a.id} value={a.slug}>
                      {locale === 'vi'
                        ? `${a.nameVi}, ${a.cityVi}`
                        : `${a.nameEn}, ${a.cityEn}`}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="mobile-checkin"
                    className="block text-sm font-medium text-[var(--color-text)] mb-1.5"
                  >
                    {t.search.checkInLabel}
                  </label>
                  <input
                    id="mobile-checkin"
                    type="date"
                    min={minDate}
                    value={checkIn}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCheckIn(val);
                      if (val && checkOut && checkOut <= val) {
                        setCheckOut(addDaysIso(val, 14));
                      }
                    }}
                    className="w-full min-h-[44px] px-3 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] text-[15px]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="mobile-checkout"
                    className="block text-sm font-medium text-[var(--color-text)] mb-1.5"
                  >
                    {t.search.checkOutLabel}
                  </label>
                  <input
                    id="mobile-checkout"
                    type="date"
                    min={checkIn ? addDaysIso(checkIn, 1) : addDaysIso(minDate, 1)}
                    value={checkOut}
                    onChange={(e) => setCheckOut(e.target.value)}
                    className="w-full min-h-[44px] px-3 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] text-[15px]"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="mobile-guests"
                  className="block text-sm font-medium text-[var(--color-text)] mb-1.5"
                >
                  {t.search.guestsLabel}
                </label>
                <select
                  id="mobile-guests"
                  value={guests}
                  onChange={(e) => setGuests(e.target.value)}
                  className="w-full min-h-[44px] px-3 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] text-[15px]"
                >
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <option key={n} value={String(n)}>
                      {n} {n === 1 ? t.search.guestSingular : t.search.guestPlural}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="mobile-amenity"
                    className="block text-sm font-medium text-[var(--color-text)] mb-1.5"
                  >
                    {t.search.essentialLabel}
                  </label>
                  <select
                    id="mobile-amenity"
                    value={amenity}
                    onChange={(e) => setAmenity(e.target.value)}
                    className="w-full min-h-[44px] px-3 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] text-[15px]"
                  >
                    <option value="">{t.search.anyOption}</option>
                    <option value="kitchen">{t.search.amenities.kitchen}</option>
                    <option value="washer">{t.search.amenities.washer}</option>
                    <option value="dedicated_desk">{t.search.amenities.dedicated_desk}</option>
                    <option value="wifi">{t.search.amenities.wifi}</option>
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="mobile-type"
                    className="block text-sm font-medium text-[var(--color-text)] mb-1.5"
                  >
                    {t.search.stayTypeLabel}
                  </label>
                  <select
                    id="mobile-type"
                    value={propertyType}
                    onChange={(e) => setPropertyType(e.target.value)}
                    className="w-full min-h-[44px] px-3 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] text-[15px]"
                  >
                    <option value="">{t.search.allTypes}</option>
                    <option value="apartment">{t.propertyTypes.apartment}</option>
                    <option value="studio">{t.propertyTypes.studio}</option>
                    <option value="house">{t.propertyTypes.house}</option>
                    <option value="villa">{t.propertyTypes.villa}</option>
                    <option value="homestay">{t.propertyTypes.homestay}</option>
                  </select>
                </div>
              </div>

              <label className="flex items-center gap-2.5 min-h-[44px] text-sm text-[var(--color-text)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={lateCheckin}
                  onChange={(e) => setLateCheckin(e.target.checked)}
                  className="w-4 h-4 accent-[var(--color-primary)]"
                />
                <span>{t.search.lateCheckinMobile}</span>
              </label>

              {validationMsg && (
                <p role="alert" className="text-sm text-[var(--color-danger-text)]">
                  {validationMsg}
                </p>
              )}

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleReset}
                  className="flex-1 min-h-[44px] px-4 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] text-sm font-medium text-[var(--color-text)]"
                >
                  {t.search.resetButton}
                </button>
                <button
                  type="submit"
                  className="flex-1 min-h-[44px] px-4 rounded-[12px] bg-[var(--color-primary)] text-white text-sm font-medium hover:bg-[var(--color-primary-hover)]"
                >
                  {t.search.applyFiltersButton}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Desktop Search Bar */}
      <form
        onSubmit={handleSubmit}
        className="hidden md:block rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-apple-subtle p-2.5"
      >
        <div className="grid grid-cols-12 items-center divide-x divide-[var(--color-hairline)]">
          <div className="col-span-3 px-3 py-1">
            <label
              htmlFor="desktop-area"
              className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-1"
            >
              <MapPin className="w-4 h-4 text-[var(--color-primary)]" aria-hidden="true" />
              <span>{t.search.areaLabel}</span>
            </label>
            <select
              id="desktop-area"
              value={area}
              onChange={(e) => setArea(e.target.value)}
              className="w-full min-h-[40px] bg-transparent text-[15px] font-medium text-[var(--color-text)] focus:outline-none"
            >
              <option value="">{t.search.allVietnamAreas}</option>
              {areas.map((a) => (
                <option key={a.id} value={a.slug}>
                  {locale === 'vi'
                    ? `${a.nameVi}, ${a.cityVi}`
                    : `${a.nameEn}, ${a.cityEn}`}
                </option>
              ))}
            </select>
          </div>

          <div className="col-span-3 px-3 py-1">
            <label
              htmlFor="desktop-checkin"
              className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-1"
            >
              <Calendar className="w-4 h-4 text-[var(--color-primary)]" aria-hidden="true" />
              <span>{t.search.checkInLabel}</span>
            </label>
            <input
              id="desktop-checkin"
              type="date"
              min={minDate}
              value={checkIn}
              onChange={(e) => {
                const val = e.target.value;
                setCheckIn(val);
                if (val && checkOut && checkOut <= val) {
                  setCheckOut(addDaysIso(val, 14));
                }
              }}
              className="w-full min-h-[40px] bg-transparent text-[15px] font-medium text-[var(--color-text)] focus:outline-none"
            />
          </div>

          <div className="col-span-3 px-3 py-1">
            <label
              htmlFor="desktop-checkout"
              className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-1"
            >
              <Calendar className="w-4 h-4 text-[var(--color-primary)]" aria-hidden="true" />
              <span>{t.search.checkOutLabel}</span>
            </label>
            <input
              id="desktop-checkout"
              type="date"
              min={checkIn ? addDaysIso(checkIn, 1) : addDaysIso(minDate, 1)}
              value={checkOut}
              onChange={(e) => setCheckOut(e.target.value)}
              className="w-full min-h-[40px] bg-transparent text-[15px] font-medium text-[var(--color-text)] focus:outline-none"
            />
          </div>

          <div className="col-span-1 px-3 py-1">
            <label
              htmlFor="desktop-guests"
              className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-1"
            >
              <Users className="w-4 h-4 text-[var(--color-primary)]" aria-hidden="true" />
              <span>{t.search.guestsLabel}</span>
            </label>
            <select
              id="desktop-guests"
              value={guests}
              onChange={(e) => setGuests(e.target.value)}
              className="w-full min-h-[40px] bg-transparent text-[15px] font-medium text-[var(--color-text)] focus:outline-none"
            >
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={String(n)}>
                  {n}
                </option>
              ))}
            </select>
          </div>

          <div className="col-span-2 pl-3 border-l-0">
            <button
              type="submit"
              className="w-full min-h-[48px] px-4 rounded-[12px] bg-[var(--color-primary)] text-white text-[15px] font-medium inline-flex items-center justify-center gap-2 hover:bg-[var(--color-primary-hover)] transition-colors"
            >
              <Search className="w-5 h-5" aria-hidden="true" />
              <span>{t.search.searchButton}</span>
            </button>
          </div>
        </div>

        {showExtendedFilters && (
          <div className="mt-2.5 pt-2.5 px-2 border-t border-[var(--color-hairline)] flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <label
                  htmlFor="desktop-amenity"
                  className="text-xs font-medium text-[var(--color-text-muted)]"
                >
                  {t.search.essentialLabel}:
                </label>
                <select
                  id="desktop-amenity"
                  value={amenity}
                  onChange={(e) => setAmenity(e.target.value)}
                  className="min-h-[44px] px-3 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] text-sm"
                >
                  <option value="">{t.search.allAmenities}</option>
                  <option value="kitchen">{t.search.amenities.kitchen}</option>
                  <option value="washer">{t.search.amenities.washer}</option>
                  <option value="dedicated_desk">{t.search.amenities.dedicated_desk}</option>
                  <option value="wifi">{t.search.amenities.wifi}</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <label
                  htmlFor="desktop-type"
                  className="text-xs font-medium text-[var(--color-text-muted)]"
                >
                  {t.search.stayTypeLabel}:
                </label>
                <select
                  id="desktop-type"
                  value={propertyType}
                  onChange={(e) => setPropertyType(e.target.value)}
                  className="min-h-[44px] px-3 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] text-sm"
                >
                  <option value="">{t.search.allTypes}</option>
                  <option value="apartment">{t.propertyTypes.apartment}</option>
                  <option value="studio">{t.propertyTypes.studio}</option>
                  <option value="house">{t.propertyTypes.house}</option>
                  <option value="villa">{t.propertyTypes.villa}</option>
                  <option value="homestay">{t.propertyTypes.homestay}</option>
                </select>
              </div>

              <label className="inline-flex items-center gap-2 min-h-[44px] px-2 text-sm text-[var(--color-text)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={lateCheckin}
                  onChange={(e) => setLateCheckin(e.target.checked)}
                  className="w-4 h-4 accent-[var(--color-primary)]"
                />
                <span>{t.search.lateCheckinDesktop}</span>
              </label>
            </div>

            {(area ||
              checkIn ||
              checkOut ||
              Number(guests) > 1 ||
              amenity ||
              propertyType ||
              lateCheckin) && (
              <button
                type="button"
                onClick={handleReset}
                className="min-h-[44px] px-3.5 rounded-[12px] border border-[var(--color-border)] text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-surface-muted)]"
              >
                {t.search.clearFiltersButton}
              </button>
            )}
          </div>
        )}

        {validationMsg && (
          <p role="alert" className="mt-2 px-3 text-sm text-[var(--color-danger-text)]">
            {validationMsg}
          </p>
        )}
      </form>
    </div>
  );
}
