import type { CachePort } from '../../../../shared/cache/cache.port';
import { geohash } from '../../../../shared/kernel/geohash';
import type { LatLng } from '../../../../shared/kernel/geo';
import type { RouteMatrix, RoutingProviderPort } from '../../domain/ports/routing-provider.port';

const MATRIX_TTL_SECONDS = 5 * 60;

/** Cache best-effort da matriz; uma falha no Redis nunca altera o resultado. */
export class CachedRoutingProvider implements RoutingProviderPort {
  constructor(
    private readonly cache: CachePort,
    private readonly delegate: RoutingProviderPort,
    private readonly namespace: string,
  ) {}

  matrix(points: LatLng[], speedKmh: number): Promise<RouteMatrix> {
    const cells = points.map((p) => geohash(p.latitude, p.longitude, 9)).join('.');
    const key = `routing-matrix:v1:${this.namespace}:${speedKmh.toFixed(2)}:${cells}`;
    return this.cache.getOrSet(key, MATRIX_TTL_SECONDS, () =>
      this.delegate.matrix(points, speedKmh),
    );
  }
}
