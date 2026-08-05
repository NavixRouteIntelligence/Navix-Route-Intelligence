import type { CachePort } from '../../../../shared/cache/cache.port';
import { geohash } from '../../../../shared/kernel/geohash';
import type { LatLng } from '../../../../shared/kernel/geo';
import type { RouteMatrix, RoutingProviderPort } from '../../domain/ports/routing-provider.port';
import { UNREACHABLE } from '../../domain/reachability';

const MATRIX_TTL_SECONDS = 5 * 60;

/** `JSON.stringify(Infinity)` é `null`; o trecho proibido volta como nulo. */
type EncodedMatrix = { distanceKm: (number | null)[][]; durationMin: (number | null)[][] };

const encode = (m: number[][]): (number | null)[][] =>
  m.map((row) => row.map((v) => (Number.isFinite(v) ? v : null)));

const decode = (m: (number | null)[][]): number[][] =>
  m.map((row) => row.map((v) => (v == null ? UNREACHABLE : v)));

/** Cache best-effort da matriz; uma falha no Redis nunca altera o resultado. */
export class CachedRoutingProvider implements RoutingProviderPort {
  constructor(
    private readonly cache: CachePort,
    private readonly delegate: RoutingProviderPort,
    private readonly namespace: string,
  ) {}

  async matrix(points: LatLng[], speedKmh: number): Promise<RouteMatrix> {
    const cells = points.map((p) => geohash(p.latitude, p.longitude, 9)).join('.');
    // `v2`: as matrizes gravadas pela versão anterior traziam zero onde não há
    // rota (ADR-0106). Reaproveitá-las devolveria o defeito pelo cache.
    const key = `routing-matrix:v2:${this.namespace}:${speedKmh.toFixed(2)}:${cells}`;
    const cached = await this.cache.getOrSet<EncodedMatrix>(key, MATRIX_TTL_SECONDS, async () => {
      const fresh = await this.delegate.matrix(points, speedKmh);
      return { distanceKm: encode(fresh.distanceKm), durationMin: encode(fresh.durationMin) };
    });
    return { distanceKm: decode(cached.distanceKm), durationMin: decode(cached.durationMin) };
  }
}
