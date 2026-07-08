'use client';

import 'mapbox-gl/dist/mapbox-gl.css';
import type { DriverPositionView } from '@navix/contracts';
import { Navigation } from 'lucide-react';
import { useTheme } from 'next-themes';
import Map, { Marker, NavigationControl } from 'react-map-gl';

import { Alert } from '@/components/ui/alert';

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

const DOT: Record<DriverPositionView['status'], string> = {
  en_route: 'bg-success',
  finished: 'bg-primary',
  offline: 'bg-muted-foreground',
};

/** Mapa da frota em tempo real: um marcador por motorista, colorido por status. */
export function FleetMap({ positions }: { positions: DriverPositionView[] }) {
  const { resolvedTheme } = useTheme();

  if (!TOKEN) {
    return (
      <Alert tone="info" title="Mapa desativado">
        Defina <code className="font-mono">NEXT_PUBLIC_MAPBOX_TOKEN</code> para ver a frota no mapa.
      </Alert>
    );
  }
  if (positions.length === 0) return null;

  const lngs = positions.map((p) => p.longitude);
  const lats = positions.map((p) => p.latitude);
  const same = Math.min(...lngs) === Math.max(...lngs) && Math.min(...lats) === Math.max(...lats);
  const initialViewState = same
    ? { longitude: lngs[0], latitude: lats[0], zoom: 12 }
    : {
        bounds: [
          [Math.min(...lngs), Math.min(...lats)],
          [Math.max(...lngs), Math.max(...lats)],
        ] as [[number, number], [number, number]],
        fitBoundsOptions: { padding: 64 },
      };

  return (
    <div className="h-[460px] overflow-hidden rounded-lg border border-border">
      <Map
        mapboxAccessToken={TOKEN}
        initialViewState={initialViewState}
        mapStyle={
          resolvedTheme === 'dark'
            ? 'mapbox://styles/mapbox/dark-v11'
            : 'mapbox://styles/mapbox/light-v11'
        }
        style={{ width: '100%', height: '100%' }}
      >
        <NavigationControl position="top-right" showCompass={false} />
        {positions.map((p) => (
          <Marker key={p.driverId} longitude={p.longitude} latitude={p.latitude} anchor="center">
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-full border-2 border-white text-white shadow-elevated ${DOT[p.status]}`}
              style={p.heading != null ? { transform: `rotate(${p.heading}deg)` } : undefined}
              title={`Motorista ${p.driverId.slice(0, 8)} · ${p.status}`}
            >
              <Navigation className="h-4 w-4" aria-hidden />
            </span>
          </Marker>
        ))}
      </Map>
    </div>
  );
}
