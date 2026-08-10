'use client';

import 'mapbox-gl/dist/mapbox-gl.css';
import type { RouteStopView } from '@navix/contracts';
import { MapPin } from 'lucide-react';
import { useTheme } from 'next-themes';
import Map, { Marker, NavigationControl } from 'react-map-gl';

import { Alert } from '@/components/ui/alert';

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

/**
 * Mapa da rota: **paradas numeradas, sem traçado** (ADR-0125).
 *
 * Até aqui este componente desenhava um `LineString` ligando as paradas em
 * linha reta, com 4 px e a cor primária, sobre um mapa de ruas. Nada dizia que
 * não era o percurso — e a leitura natural de uma linha grossa sobre estradas é
 * «é por aqui que se vai». Não é: é a ordem de visita, e o caminho real
 * contorna quarteirões, sentidos únicos e rios.
 *
 * A ordem já está nos números dos marcadores, que a prometem sem a inventar. O
 * traçado real entra quando houver geometria da Directions API (fase 2) — aí a
 * linha volta, e será a que corresponde ao percurso.
 */
export function RouteMap({ stops }: { stops: RouteStopView[] }) {
  const { resolvedTheme } = useTheme();

  if (!TOKEN) {
    return <MapFallback stops={stops} />;
  }
  if (stops.length === 0) return null;

  const coords = stops.map((s) => [s.longitude, s.latitude] as [number, number]);
  const lngs = coords.map((c) => c[0]);
  const lats = coords.map((c) => c[1]);
  const same = Math.min(...lngs) === Math.max(...lngs) && Math.min(...lats) === Math.max(...lats);
  const initialViewState = same
    ? { longitude: lngs[0], latitude: lats[0], zoom: 12 }
    : {
        bounds: [
          [Math.min(...lngs), Math.min(...lats)],
          [Math.max(...lngs), Math.max(...lats)],
        ] as [[number, number], [number, number]],
        fitBoundsOptions: { padding: 56 },
      };

  return (
    <div className="h-[420px] overflow-hidden rounded-lg border border-border">
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
        {stops.map((s) => (
          <Marker key={s.sequence} longitude={s.longitude} latitude={s.latitude} anchor="center">
            <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-primary text-xs font-bold text-primary-foreground shadow-elevated">
              {s.sequence}
            </span>
          </Marker>
        ))}
      </Map>
    </div>
  );
}

/** Sem token do Mapbox: mostra a sequência de paradas e como habilitar o mapa. */
function MapFallback({ stops }: { stops: RouteStopView[] }) {
  return (
    <div className="space-y-3">
      <Alert tone="info" title="Mapa desativado">
        Defina <code className="font-mono">NEXT_PUBLIC_MAPBOX_TOKEN</code> no <code className="font-mono">.env</code> para
        ver a rota no mapa. Abaixo, a sequência otimizada de paradas.
      </Alert>
      <ol className="space-y-2">
        {stops.map((s) => (
          <li key={s.sequence} className="flex items-center gap-3 rounded-md border border-border p-3 text-sm">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              {s.sequence}
            </span>
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span className="font-mono text-xs text-muted-foreground">
              {s.latitude.toFixed(4)}, {s.longitude.toFixed(4)}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
