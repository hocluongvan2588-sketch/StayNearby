'use client';

import { useRouter } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useState,
  useTransition,
  type ReactNode,
} from 'react';
import type { SupportedCurrency, UserLocale, UserPreferences } from '@/lib/i18n/types';

interface UserPreferencesContextValue {
  preferences: UserPreferences;
  updating: boolean;
  updatePreferences: (patch: {
    locale?: UserLocale | 'auto';
    currency?: SupportedCurrency | 'auto';
  }) => Promise<void>;
}

const UserPreferencesContext = createContext<UserPreferencesContextValue | null>(
  null
);

function getPrefsKey(prefs: UserPreferences): string {
  return `${prefs.locale}:${prefs.currency}:${prefs.isAutoLocale}:${prefs.isAutoCurrency}:${prefs.detectedCountry}`;
}

export function UserPreferencesProvider({
  initialPreferences,
  children,
}: {
  initialPreferences: UserPreferences;
  children: ReactNode;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const [overrideState, setOverrideState] = useState<{
    baseKey: string;
    value: UserPreferences;
  } | null>(null);

  const currentServerKey = getPrefsKey(initialPreferences);
  const preferences =
    overrideState && overrideState.baseKey === currentServerKey
      ? overrideState.value
      : initialPreferences;

  const updatePreferences = useCallback(
    async (patch: {
      locale?: UserLocale | 'auto';
      currency?: SupportedCurrency | 'auto';
    }) => {
      setSaving(true);
      try {
        const res = await fetch('/api/preferences', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        });
        const json = await res.json();
        if (res.ok && json.ok && json.preferences) {
          setOverrideState({
            baseKey: currentServerKey,
            value: json.preferences as UserPreferences,
          });
          startTransition(() => {
            router.refresh();
          });
        }
      } finally {
        setSaving(false);
      }
    },
    [currentServerKey, router]
  );

  return (
    <UserPreferencesContext.Provider
      value={{
        preferences,
        updating: saving || isPending,
        updatePreferences,
      }}
    >
      {children}
    </UserPreferencesContext.Provider>
  );
}

export function useUserPreferences(): UserPreferencesContextValue {
  const ctx = useContext(UserPreferencesContext);
  if (!ctx) {
    throw new Error(
      'useUserPreferences must be used within UserPreferencesProvider'
    );
  }
  return ctx;
}
