'use client';

import { useTheme } from 'next-themes';
import { useEffect, useRef, type ReactNode } from 'react';

import { useAuth } from '@/lib/auth/auth-provider';
import type { Locale } from '@/lib/i18n/dictionary';
import { useLocale } from '@/lib/i18n/locale-provider';
import { usePreferences } from '@/lib/preferences/preferences-provider';
import { useSettings } from '@/lib/settings/use-settings';

/**
 * Ponte de sincronização: após o login, reflete as preferências do servidor
 * (fonte de verdade) nos provedores locais de Tema, Idioma e Preferências de UI.
 * Antes do login, cada provedor mantém seu fallback local (client-first/offline).
 * Ver docs/modules/settings.md §3.3–3.5.
 */
export function SettingsSyncProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const { settings, isLoading } = useSettings();
  const { setTheme } = useTheme();
  const { setLocale } = useLocale();
  const { setPreference } = usePreferences();

  // Evita reaplicar o mesmo snapshot repetidamente.
  const lastApplied = useRef<string | null>(null);

  useEffect(() => {
    if (status !== 'authenticated' || isLoading) return;
    const snapshot = JSON.stringify(settings);
    if (lastApplied.current === snapshot) return;
    lastApplied.current = snapshot;

    setTheme(settings.theme);
    setLocale(settings.locale as Locale);
    setPreference('reducedMotion', settings.reducedMotion);
    setPreference('compact', settings.compact);
  }, [status, isLoading, settings, setTheme, setLocale, setPreference]);

  return <>{children}</>;
}
