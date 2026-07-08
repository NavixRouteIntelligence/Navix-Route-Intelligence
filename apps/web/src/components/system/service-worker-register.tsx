'use client';

import { useEffect } from 'react';

/**
 * Registra o service worker (PWA) apenas em produção — em desenvolvimento o SW
 * atrapalharia o hot reload. Falhas são silenciosas (o app funciona sem SW).
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (
      process.env.NODE_ENV !== 'production' ||
      typeof navigator === 'undefined' ||
      !('serviceWorker' in navigator)
    ) {
      return;
    }
    const onLoad = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    };
    window.addEventListener('load', onLoad);
    return () => window.removeEventListener('load', onLoad);
  }, []);

  return null;
}
