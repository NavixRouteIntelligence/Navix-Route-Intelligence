'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { DICTIONARY, HTML_LANG, type Locale, type TranslationKey } from './dictionary';

const STORAGE_KEY = 'navix.locale';
const VALID: Locale[] = ['pt-BR', 'pt-PT', 'en', 'es'];

/** Normaliza valores persistidos (inclui migração dos antigos 'pt'/'en'). */
function normalizeLocale(raw: string | null): Locale | null {
  if (!raw) return null;
  if (raw === 'pt') return 'pt-BR';
  return (VALID as string[]).includes(raw) ? (raw as Locale) : null;
}

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('pt-BR');

  // Restaura a preferência persistida (client-side).
  useEffect(() => {
    const stored = normalizeLocale(window.localStorage.getItem(STORAGE_KEY));
    if (stored) setLocaleState(stored);
  }, []);

  // Mantém <html lang> em sincronia (acessibilidade).
  useEffect(() => {
    document.documentElement.lang = HTML_LANG[locale];
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  }, []);

  const t = useCallback(
    (key: TranslationKey) => DICTIONARY[locale][key] ?? DICTIONARY['pt-BR'][key] ?? key,
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
