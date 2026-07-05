import { Injectable } from '@nestjs/common';

import type { GeoPoint } from '../../domain/geo-point';
import type { DistanceProviderPort } from '../../domain/ports/distance-provider.port';

const EARTH_RADIUS_KM = 6371;
const toRad = (deg: number): number => (deg * Math.PI) / 180;

/**
 * Distância great-circle (Haversine) em km. Sem dependências externas,
 * determinística — adequada ao MVP. Substituível por matriz real (ADR-0007).
 */
@Injectable()
export class HaversineDistanceProvider implements DistanceProviderPort {
  distanceKm(a: GeoPoint, b: GeoPoint): number {
    const dLat = toRad(b.latitude - a.latitude);
    const dLon = toRad(b.longitude - a.longitude);
    const lat1 = toRad(a.latitude);
    const lat2 = toRad(b.latitude);

    const h =
      Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
  }
}
