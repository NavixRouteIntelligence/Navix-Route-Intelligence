'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { trackingApi } from '@/lib/api/tracking';

interface ShareState {
  sharing: boolean;
  error: string | null;
  toggle: () => void;
  stop: (markFinished?: boolean) => void;
}

/**
 * Compartilha a posição do motorista via Geolocation API, enviando ao backend a
 * cada atualização. Isolado para que a estratégia de transporte (hoje POST por
 * evento de watchPosition) possa evoluir sem afetar a UI.
 */
export function useShareLocation(): ShareState {
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const watchId = useRef<number | null>(null);

  const clearWatch = useCallback(() => {
    if (watchId.current !== null && typeof navigator !== 'undefined') {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
  }, []);

  const stop = useCallback(
    (markFinished = false) => {
      clearWatch();
      setSharing(false);
      if (markFinished) {
        void navigator.geolocation?.getCurrentPosition((pos) => {
          void trackingApi
            .update({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              speed: pos.coords.speed != null ? pos.coords.speed * 3.6 : null,
              heading: pos.coords.heading ?? null,
              status: 'finished',
            })
            .catch(() => undefined);
        });
      }
    },
    [clearWatch],
  );

  const start = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setError('Geolocalização não suportada neste dispositivo.');
      return;
    }
    setError(null);
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        void trackingApi
          .update({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            // Geolocation retorna m/s; convertemos para km/h.
            speed: pos.coords.speed != null ? pos.coords.speed * 3.6 : null,
            heading: pos.coords.heading ?? null,
            status: 'en_route',
          })
          .catch(() => undefined);
      },
      (err) => setError(err.message || 'Não foi possível obter a localização.'),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    );
    setSharing(true);
  }, []);

  const toggle = useCallback(() => {
    if (sharing) stop(true);
    else start();
  }, [sharing, start, stop]);

  useEffect(() => clearWatch, [clearWatch]);

  return { sharing, error, toggle, stop };
}
