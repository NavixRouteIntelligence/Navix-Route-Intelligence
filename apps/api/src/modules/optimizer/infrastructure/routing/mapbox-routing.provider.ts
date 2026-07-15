import { Injectable, Logger } from '@nestjs/common';

import { AppConfigService } from '../../../../shared/config/app-config.service';
import { haversineKm, type LatLng } from '../../../../shared/kernel/geo';
import type { RouteMatrix, RoutingProviderPort } from '../../domain/ports/routing-provider.port';
import { haversineMatrix } from './haversine-routing.provider';

const MAX_COORDS = 25; // limite do Mapbox Matrix API (driving)
const TIMEOUT_MS = 4000;

interface MatrixResponse {
  code?: string;
  distances?: (number | null)[][]; // metros
  durations?: (number | null)[][]; // segundos
}

/**
 * Provedor de roteamento **real** via Mapbox Matrix API (ADR-0027): distância e
 * **duração de trânsito** medidas. Resiliente por design — sem token, acima do
 * limite de coordenadas, ou em qualquer falha/timeout externo, **degrada para
 * Haversine**, nunca derrubando a otimização (mesmo princípio do Redis).
 * Requer `MAPBOX_TOKEN` no ambiente (segredo fornecido pelo operador).
 */
@Injectable()
export class MapboxRoutingProvider implements RoutingProviderPort {
  private readonly logger = new Logger('MapboxRouting');
  private readonly token: string | undefined;
  private warned = false;

  constructor(config: AppConfigService) {
    this.token = config.maps.mapboxToken;
  }

  async matrix(points: LatLng[], speedKmh: number): Promise<RouteMatrix> {
    if (!this.token || points.length < 2 || points.length > MAX_COORDS) {
      return haversineMatrix(points, speedKmh);
    }
    try {
      const coords = points.map((p) => `${p.longitude},${p.latitude}`).join(';');
      const url =
        `https://api.mapbox.com/directions-matrix/v1/mapbox/driving/${coords}` +
        `?annotations=distance,duration&access_token=${this.token}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as MatrixResponse;
      if (body.code !== 'Ok' || !body.distances || !body.durations) {
        throw new Error(`resposta inválida (${body.code ?? 'sem code'})`);
      }
      return {
        distanceKm: body.distances.map((row, i) =>
          row.map((m, j) => (m == null ? haversineKm(points[i], points[j]) : m / 1000)),
        ),
        durationMin: body.durations.map((row) => row.map((s) => (s == null ? 0 : s / 60))),
      };
    } catch (err) {
      if (!this.warned) {
        this.logger.warn(
          `Mapbox indisponível (${err instanceof Error ? err.message : String(err)}); usando Haversine.`,
        );
        this.warned = true;
      }
      return haversineMatrix(points, speedKmh);
    }
  }
}
