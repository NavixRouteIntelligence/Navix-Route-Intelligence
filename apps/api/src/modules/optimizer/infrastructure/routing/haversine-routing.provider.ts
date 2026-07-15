import { Injectable } from '@nestjs/common';

import { haversineKm, type LatLng } from '../../../../shared/kernel/geo';
import type { RouteMatrix, RoutingProviderPort } from '../../domain/ports/routing-provider.port';

/**
 * Provedor de roteamento geométrico (Haversine) — default e **fallback** (ADR-0027).
 * Distância great-circle; duração derivada da velocidade do veículo. Determinístico,
 * sem rede. Usado por padrão e sempre que um provedor real falha ou não se aplica.
 */
export function haversineMatrix(points: LatLng[], speedKmh: number): RouteMatrix {
  const n = points.length;
  const speed = Math.max(1, speedKmh);
  const distanceKm: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  const durationMin: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const km = haversineKm(points[i], points[j]);
      const min = (km / speed) * 60;
      distanceKm[i][j] = distanceKm[j][i] = km;
      durationMin[i][j] = durationMin[j][i] = min;
    }
  }
  return { distanceKm, durationMin };
}

@Injectable()
export class HaversineRoutingProvider implements RoutingProviderPort {
  async matrix(points: LatLng[], speedKmh: number): Promise<RouteMatrix> {
    return haversineMatrix(points, speedKmh);
  }
}
