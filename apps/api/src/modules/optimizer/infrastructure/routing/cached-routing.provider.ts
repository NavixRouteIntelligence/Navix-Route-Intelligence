import type { CachePort } from '../../../../shared/cache/cache.port';
import { geohash } from '../../../../shared/kernel/geohash';
import type { LatLng } from '../../../../shared/kernel/geo';
import type { RouteMatrix, RoutingProviderPort } from '../../domain/ports/routing-provider.port';
import type { VehicleType } from '@navix/contracts';

import type {
  RoutingProfileMapping,
  RoutingSource,
} from '../../domain/ports/routing-provider.port';
import { resolveRoutingProfile } from '../../domain/routing-profile';
import { UNREACHABLE } from '../../domain/reachability';

const MATRIX_TTL_SECONDS = 5 * 60;

/** `JSON.stringify(Infinity)` é `null`; o trecho proibido volta como nulo. */
type EncodedMatrix = {
  distanceKm: (number | null)[][];
  durationMin: (number | null)[][];
  source: RoutingSource;
  profile?: RoutingProfileMapping;
};

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

  async matrix(
    points: LatLng[],
    speedKmh: number,
    vehicleType?: VehicleType | null,
  ): Promise<RouteMatrix> {
    const cells = points.map((p) => geohash(p.latitude, p.longitude, 9)).join('.');
    // O perfil entra na chave (ADR-0108): sem ele, uma rota de bicicleta
    // reaproveitaria a matriz de carro dos mesmos pontos — silenciosamente, e
    // só quando o cache estivesse quente.
    const perfil = resolveRoutingProfile(vehicleType).profile;
    // `v4`: `v1` gravava zero onde não há rota (ADR-0106), `v2` não guardava a
    // origem dos números (ADR-0107) e `v3` não distinguia perfil (ADR-0108).
    // Reaproveitar qualquer delas devolveria o defeito pelo cache.
    const key = `routing-matrix:v4:${this.namespace}:${perfil}:${speedKmh.toFixed(2)}:${cells}`;
    const cached = await this.cache.getOrSet<EncodedMatrix>(key, MATRIX_TTL_SECONDS, async () => {
      const fresh = await this.delegate.matrix(points, speedKmh, vehicleType);
      return {
        distanceKm: encode(fresh.distanceKm),
        durationMin: encode(fresh.durationMin),
        // A origem viaja junto: uma matriz geométrica em cache não pode voltar
        // se passando por medida (ADR-0107).
        source: fresh.source,
        ...(fresh.profile ? { profile: fresh.profile } : {}),
      };
    });
    return {
      distanceKm: decode(cached.distanceKm),
      durationMin: decode(cached.durationMin),
      source: cached.source ?? 'geometric',
      ...(cached.profile ? { profile: cached.profile } : {}),
    };
  }
}
