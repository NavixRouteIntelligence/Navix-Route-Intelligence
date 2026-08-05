import { Injectable, Logger } from '@nestjs/common';

import { AppConfigService } from '../../../../shared/config/app-config.service';
import type { LatLng } from '../../../../shared/kernel/geo';
import { UNREACHABLE } from '../../domain/reachability';
import type { RouteMatrix, RoutingProviderPort } from '../../domain/ports/routing-provider.port';
import { haversineMatrix } from './haversine-routing.provider';

const MAX_COORDS = 25; // limite do Mapbox Matrix API (driving)

/** Matriz em que nenhum par tem rota — só a diagonal (ficar parado) é possível. */
function allUnreachable(n: number): RouteMatrix {
  const build = (): number[][] =>
    Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j): number => (i === j ? 0 : UNREACHABLE)),
    );
  return { distanceKm: build(), durationMin: build() };
}
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
      // `NoRoute` é o provedor afirmando que **não existe rota** entre os
      // pontos — não é falha dele (ADR-0106). Degradar para Haversine aqui
      // devolveria distâncias em linha reta sobre o oceano, que é o mesmo
      // ajuste silencioso que o `null` por par produzia.
      if (body.code === 'NoRoute') return allUnreachable(points.length);
      if (body.code !== 'Ok' || !body.distances || !body.durations) {
        throw new Error(`resposta inválida (${body.code ?? 'sem code'})`);
      }
      // `null` no Mapbox significa **não existe rota** entre o par (ADR-0106).
      // Antes a duração virava zero — a aresta mais barata do grafo, logo a
      // preferida — e a distância caía em Haversine, que finge uma estrada em
      // linha reta sobre rio, mar ou muro. As duas viram proibição explícita.
      return {
        distanceKm: body.distances.map((row) =>
          row.map((m) => (m == null ? UNREACHABLE : m / 1000)),
        ),
        durationMin: body.durations.map((row) =>
          row.map((s) => (s == null ? UNREACHABLE : s / 60)),
        ),
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
