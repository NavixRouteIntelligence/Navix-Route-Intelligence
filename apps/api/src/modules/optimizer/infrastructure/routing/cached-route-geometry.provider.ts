import type { VehicleType } from '@navix/contracts';

import type { CachePort } from '../../../../shared/cache/cache.port';
import { geohash } from '../../../../shared/kernel/geohash';
import type { LatLng } from '../../../../shared/kernel/geo';
import type {
  RouteGeometry,
  RouteGeometryProviderPort,
} from '../../domain/ports/route-geometry.port';
import { resolveRoutingProfile } from '../../domain/routing-profile';
import type { OptimizerMetrics } from '../observability/optimizer-metrics';

/**
 * Doze horas, contra os cinco minutos da matriz.
 *
 * A diferença não é de gosto: a matriz guarda **durações**, que mudam com o
 * trânsito, e por isso azeda depressa. Isto guarda o **desenho das ruas**, que
 * não muda durante uma jornada. Uma rota reaberta vinte vezes ao longo do dia —
 * depois de cada entrega, de cada puxar-para-atualizar — pagaria vinte pedidos
 * à Directions por uma linha idêntica.
 */
const GEOMETRY_TTL_SECONDS = 12 * 60 * 60;

/**
 * Cache do traçado. *Best-effort*: uma falha do Redis nunca altera o resultado.
 *
 * **A ausência de traçado não é guardada.** Se uma falha do provedor ficasse em
 * cache, um pico de instabilidade de dez segundos deixaria a rota sem linha
 * durante doze horas — e o motorista não teria como perceber porquê nem como
 * recuperar. Repetir o pedido é mais barato do que isso.
 */
export class CachedRouteGeometryProvider implements RouteGeometryProviderPort {
  constructor(
    private readonly cache: CachePort,
    private readonly delegate: RouteGeometryProviderPort,
    private readonly namespace: string,
    /**
     * Opcional para não obrigar os testes do cache a montar métricas. Sem ela
     * o comportamento é idêntico — o que se perde é saber **quanto** o cache
     * está a poupar, que é a diferença entre uma conta previsível e uma
     * surpresa na fatura (ADR-0134).
     */
    private readonly metrics?: OptimizerMetrics,
  ) {}

  async geometry(
    points: LatLng[],
    vehicleType?: VehicleType | null,
  ): Promise<RouteGeometry | null> {
    if (points.length < 2) return null;

    const key = this.keyFor(points, vehicleType);

    // *Best-effort*, como o [CachePort] promete: uma falha do Redis vira um
    // *miss*, nunca uma falha de leitura. Sem isto, uma indisponibilidade do
    // cache apagaria o traçado de **todas** as rotas ao mesmo tempo — e a
    // causa não estaria em lado nenhum visível, porque a tela apenas deixaria
    // de mostrar a linha.
    try {
      const cached = await this.cache.get<RouteGeometry>(key);
      if (cached) {
        this.metrics?.observeGeometryCache('hit');
        return cached;
      }
      this.metrics?.observeGeometryCache('miss');
    } catch {
      // Segue para o provedor.
    }

    const fresh = await this.delegate.geometry(points, vehicleType);
    if (fresh) {
      try {
        await this.cache.set(key, fresh, GEOMETRY_TTL_SECONDS);
      } catch {
        // Não gravar é aceitável; falhar por não ter gravado não é.
      }
    }
    return fresh;
  }

  private keyFor(points: LatLng[], vehicleType?: VehicleType | null): string {
    // A **ordem** entra na chave por construção, porque a sequência é
    // concatenada: A→B→C e C→B→A são traçados diferentes, e num sentido único
    // são ruas diferentes. Uma chave que ordenasse os pontos devolveria a linha
    // ao contrário depois de uma reorganização.
    const sequencia = points.map((p) => geohash(p.latitude, p.longitude, 9)).join('.');
    // O perfil entra na chave pelo mesmo motivo da matriz (ADR-0108): sem ele,
    // uma rota de bicicleta reaproveitaria o traçado de carro pelos mesmos
    // pontos — por autoestradas onde ela não pode circular.
    const perfil = resolveRoutingProfile(vehicleType).profile;
    return `route-geometry:v1:${this.namespace}:${perfil}:${sequencia}`;
  }
}
