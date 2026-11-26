'use client';

import { createContext, useCallback, useContext, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CURRENCY_MAP,
  formatMoneyFromVnd,
  type CurrencyCode,
  type Locale,
} from '@/lib/i18n';
import type { StayCardItem } from '@/modules/catalog';

export type FxRatesMap = Record<string, number>;

export interface ClientPlatformConfig {
  serviceFeeRate: number;
  hostCommissionRate: number;
  vatDiscountRate: number;
  premiumRewardRate: number;
  defaultMinNights: number;
  fxRates: FxRatesMap;
}

const DEFAULT_PLATFORM_CONFIG: ClientPlatformConfig = {
  serviceFeeRate: 0.12,
  hostCommissionRate: 0,
  vatDiscountRate: 0.05,
  premiumRewardRate: 0.04,
  defaultMinNights: 7,
  fxRates: Object.fromEntries(
    Object.values(CURRENCY_MAP).map((m) => [m.code, m.vndPerUnit])
  ),
};

interface PreferencesContextValue {
  locale: Locale;
  currency: CurrencyCode;
  setLocale: (loc: Locale) => Promise<void>;
  setCurrency: (cur: CurrencyCode) => Promise<void>;
  platformConfig: ClientPlatformConfig;
  serviceFeePct: number;
  hostCommissionPct: number;
  vatDiscountPct: number;
  premiumRewardPct: number;
  formatMoney: (amountVnd: number, opts?: { showVndHint?: boolean }) => string;
  compareList: StayCardItem[];
  toggleCompare: (stay: StayCardItem) => void;
  clearCompare: () => void;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function PreferencesProvider({
  initialLocale,
  initialCurrency,
  platformConfig = DEFAULT_PLATFORM_CONFIG,
  children,
}: {
  initialLocale: Locale;
  initialCurrency: CurrencyCode;
  platformConfig?: ClientPlatformConfig;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const [currency, setCurrencyState] = useState<CurrencyCode>(initialCurrency);
  const [compareList, setCompareList] = useState<StayCardItem[]>([]);

  async function setLocale(loc: Locale) {
    setLocaleState(loc);
    await fetch('/api/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locale: loc }),
    });
    router.refresh();
  }

  async function setCurrency(cur: CurrencyCode) {
    setCurrencyState(cur);
    await fetch('/api/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currency: cur }),
    });
    router.refresh();
  }

  function toggleCompare(stay: StayCardItem) {
    setCompareList((prev) => {
      const exists = prev.some((s) => s.id === stay.id);
      if (exists) return prev.filter((s) => s.id !== stay.id);
      if (prev.length >= 3) return [...prev.slice(1), stay];
      return [...prev, stay];
    });
  }

  function clearCompare() {
    setCompareList([]);
  }

  const formatMoney = useCallback(
    (amountVnd: number, opts?: { showVndHint?: boolean }) =>
      formatMoneyFromVnd(amountVnd, currency, {
        ...opts,
        fxRates: platformConfig.fxRates,
      }),
    [currency, platformConfig.fxRates]
  );

  return (
    <PreferencesContext.Provider
      value={{
        locale,
        currency,
        setLocale,
        setCurrency,
        platformConfig,
        serviceFeePct: Math.round(platformConfig.serviceFeeRate * 100),
        hostCommissionPct: Math.round(platformConfig.hostCommissionRate * 100),
        vatDiscountPct: Math.round(platformConfig.vatDiscountRate * 100),
        premiumRewardPct: Math.round(platformConfig.premiumRewardRate * 100),
        formatMoney,
        compareList,
        toggleCompare,
        clearCompare,
      }}
    >
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences must be inside PreferencesProvider');
  return ctx;
}
