'use client';

import { WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';

import { useT } from '@/lib/i18n/locale-provider';

/**
 * Overlay "Sem Conexão". Escuta os eventos online/offline do navegador e cobre a
 * tela quando não há internet, reconectando automaticamente ao voltar.
 */
export function OfflineOverlay() {
  const t = useT();
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="alertdialog"
      aria-label={t('state.offline.title')}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-background/95 px-4 text-center backdrop-blur"
    >
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-warning/10 text-warning">
        <WifiOff className="h-8 w-8" aria-hidden />
      </span>
      <h2 className="text-h2">{t('state.offline.title')}</h2>
      <p className="max-w-sm text-sm text-muted-foreground">{t('state.offline.description')}</p>
      <span className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="h-2 w-2 animate-pulse rounded-full bg-warning" />
        {t('state.loading')}
      </span>
    </div>
  );
}
