'use client';

import 'mapbox-gl/dist/mapbox-gl.css';
import type { PublicTrackingView } from '@navix/contracts';
import { MapPin, Truck } from 'lucide-react';
import { useTheme } from 'next-themes';
import Map, { Marker, NavigationControl } from 'react-map-gl';

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

/**
 * Mapa da página pública de rastreamento (ADR-0082): o destino e, quando a
 * entrega está em rota, o veículo. Sem token do Mapbox o mapa é simplesmente
 * omitido — status e ETA continuam visíveis, que é o essencial.
 */
export function TrackMap({
  destination,
  vehicle,
  labels,
}: {
  destination: PublicTrackingView['destination'];
  vehicle: PublicTrackingView['vehiclePosition'];
  labels: { destination: string; vehicle: string };
}) {
  const { resolvedTheme } = useTheme();
  if (!TOKEN || !destination) return null;

  // Enquadra o veículo junto do destino quando há os dois; senão centra no destino.
  const center = vehicle
    ? {
        latitude: (destination.latitude + vehicle.latitude) / 2,
        longitude: (destination.longitude + vehicle.longitude) / 2,
      }
    : destination;

  return (
    <div className="h-64 w-full overflow-hidden rounded-xl border sm:h-80">
      <Map
        mapboxAccessToken={TOKEN}
        initialViewState={{ ...center, zoom: vehicle ? 11 : 13 }}
        mapStyle={
          resolvedTheme === 'dark'
            ? 'mapbox://styles/mapbox/dark-v11'
            : 'mapbox://styles/mapbox/streets-v12'
        }
        attributionControl={false}
        style={{ width: '100%', height: '100%' }}
      >
        <NavigationControl position="top-right" showCompass={false} />

        <Marker latitude={destination.latitude} longitude={destination.longitude} anchor="bottom">
          <span
            className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg"
            aria-label={labels.destination}
            title={labels.destination}
          >
            <MapPin className="size-4" aria-hidden />
          </span>
        </Marker>

        {vehicle ? (
          <Marker latitude={vehicle.latitude} longitude={vehicle.longitude} anchor="center">
            <span
              className="flex size-8 items-center justify-center rounded-full bg-success text-white shadow-lg ring-2 ring-white/70"
              aria-label={labels.vehicle}
              title={labels.vehicle}
            >
              <Truck className="size-4" aria-hidden />
            </span>
          </Marker>
        ) : null}
      </Map>
    </div>
  );
}
