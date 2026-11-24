'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Globe, RotateCcw } from 'lucide-react';
import { SUPPORTED_CURRENCIES } from '@/lib/i18n/currency';
import { getCountryDisplayName } from '@/lib/i18n/country';
import { getUserMessages } from '@/lib/i18n/messages';
import type { SupportedCurrency, UserLocale } from '@/lib/i18n/types';
import { useUserPreferences } from './UserPreferencesProvider';

export function LanguageCurrencySwitcher({
  compact = false,
}: {
  compact?: boolean;
}) {
  const { preferences, updating, updatePreferences } = useUserPreferences();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const t = getUserMessages(preferences.locale);
  const countryName = getCountryDisplayName(
    preferences.detectedCountry,
    preferences.locale
  );
  const hasManualOverride =
    !preferences.isAutoLocale || !preferences.isAutoCurrency;

  useEffect(() => {
    if (!open) return;
    function handleOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  async function selectLocale(nextLocale: UserLocale) {
    await updatePreferences({ locale: nextLocale });
  }

  async function selectCurrency(nextCurrency: SupportedCurrency) {
    await updatePreferences({ currency: nextCurrency });
  }

  async function resetToAuto() {
    await updatePreferences({ locale: 'auto', currency: 'auto' });
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-label={t.switcher.buttonAriaLabel}
        className={`inline-flex items-center gap-1.5 min-h-[44px] px-3 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] text-[13px] font-medium text-[var(--color-text)] hover:border-[var(--color-primary)] transition-colors ${
          compact ? 'w-full justify-between' : ''
        }`}
      >
        <span className="inline-flex items-center gap-1.5">
          <Globe className="w-4 h-4 text-[var(--color-primary)] shrink-0" aria-hidden="true" />
          <span className="uppercase">{preferences.locale}</span>
          <span className="text-[var(--color-text-muted)]">·</span>
          <span>{preferences.currency}</span>
        </span>
        {compact && (
          <span className="text-xs text-[var(--color-text-muted)]">
            {countryName}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={t.switcher.title}
          className={`${
            compact ? 'static mt-2 w-full' : 'absolute right-0 mt-2 w-80 z-50'
          } rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-apple-card p-4 space-y-4`}
        >
          <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-[var(--color-hairline)]">
            <div>
              <p className="text-sm font-semibold text-[var(--color-text)]">
                {t.switcher.title}
              </p>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                {hasManualOverride
                  ? `${t.switcher.manualOverrideLabel} (${t.switcher.autoDetectedLabel}: ${countryName})`
                  : `${t.switcher.autoDetectedLabel}: ${countryName} (${preferences.detectedCountry})`}
              </p>
            </div>
            {hasManualOverride && (
              <button
                type="button"
                disabled={updating}
                onClick={resetToAuto}
                className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-primary)] hover:underline shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{t.switcher.resetAuto}</span>
              </button>
            )}
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
              {t.switcher.languageLabel}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { code: 'vi', label: t.switcher.viName },
                  { code: 'en', label: t.switcher.enName },
                ] as const
              ).map((opt) => {
                const active = preferences.locale === opt.code;
                return (
                  <button
                    key={opt.code}
                    type="button"
                    disabled={updating}
                    onClick={() => selectLocale(opt.code)}
                    className={`min-h-[40px] px-3 rounded-[10px] border text-sm font-medium inline-flex items-center justify-between transition-colors ${
                      active
                        ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]'
                        : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] hover:border-[var(--color-primary)]'
                    }`}
                  >
                    <span>{opt.label}</span>
                    {active && <Check className="w-4 h-4 shrink-0" aria-hidden="true" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor={compact ? 'mobile-currency-select' : 'desktop-currency-select'}
              className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]"
            >
              {t.switcher.currencyLabel}
            </label>
            <select
              id={compact ? 'mobile-currency-select' : 'desktop-currency-select'}
              value={preferences.currency}
              disabled={updating}
              onChange={(e) =>
                selectCurrency(e.target.value as SupportedCurrency)
              }
              className="w-full min-h-[42px] px-3 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] text-sm font-medium text-[var(--color-text)]"
            >
              {SUPPORTED_CURRENCIES.map((cur) => (
                <option key={cur.code} value={cur.code}>
                  {cur.code} ({cur.symbol}) —{' '}
                  {preferences.locale === 'vi' ? cur.nameVi : cur.nameEn}
                </option>
              ))}
            </select>
          </div>

          {updating && (
            <p className="text-xs text-[var(--color-text-muted)]">
              {t.switcher.saving}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
