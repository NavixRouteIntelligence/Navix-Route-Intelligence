'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { DICTIONARY, type Locale, type TranslationKey } from './dictionary';

const STORAGE_KEY = 'navix.locale';

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('pt');

  // Restaura a preferência persistida (client-side).
  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'pt' || stored === 'en') setLocaleState(stored);
  }, []);

  // Mantém <html lang> em sincronia (acessibilidade).
  useEffect(() => {
    document.documentElement.lang = locale === 'pt' ? 'pt-BR' : 'en';
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  }, []);

  const t = useCallback(
    (key: TranslationKey) => DICTIONARY[locale][key] ?? DICTIONARY.pt[key] ?? key,
    [locale],
  );

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t }}>{children}</LocaleContext.Provider>
  );
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useLocale deve ser usado dentro de <LocaleProvider>.');
  return ctx;
}

/** Atalho para tradução. */
export function useT(): (key: TranslationKey) => string {
  return useLocale().t;
}
