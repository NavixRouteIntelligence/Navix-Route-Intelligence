'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

const STORAGE_KEY = 'navix.preferences';

export interface Preferences {
  /** Desativa animações/transições (também respeita prefers-reduced-motion). */
  reducedMotion: boolean;
  /** Espaçamentos reduzidos. */
  compact: boolean;
}

const DEFAULTS: Preferences = { reducedMotion: false, compact: false };

interface PreferencesContextValue {
  preferences: Preferences;
  setPreference: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<Preferences>(DEFAULTS);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setPreferences({ ...DEFAULTS, ...(JSON.parse(raw) as Partial<Preferences>) });
    } catch {
      /* ignora preferências corrompidas */
    }
  }, []);

  // Reflete as preferências como classes no <html> (CSS cuida do efeito).
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('reduce-motion', preferences.reducedMotion);
    root.classList.toggle('compact', preferences.compact);
  }, [preferences]);

  const value = useMemo<PreferencesContextValue>(
    () => ({
      preferences,
      setPreference: (key, val) =>
        setPreferences((prev) => {
          const next = { ...prev, [key]: val };
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
          return next;
        }),
    }),
    [preferences],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): PreferencesContextValue {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences deve ser usado dentro de <PreferencesProvider>.');
  return ctx;
}
