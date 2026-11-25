'use client';

import { createContext, useContext, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { CurrencyCode, Locale } from '@/lib/i18n';
import type { StayCardItem } from '@/modules/catalog';

interface PreferencesContextValue {
  locale: Locale;
  currency: CurrencyCode;
  setLocale: (loc: Locale) => Promise<void>;
  setCurrency: (cur: CurrencyCode) => Promise<void>;
  compareList: StayCardItem[];
  toggleCompare: (stay: StayCardItem) => void;
  clearCompare: () => void;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function PreferencesProvider({
  initialLocale,
  initialCurrency,
  children,
}: {
  initialLocale: Locale;
  initialCurrency: CurrencyCode;
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

  return (
    <PreferencesContext.Provider
      value={{
        locale,
        currency,
        setLocale,
        setCurrency,
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
