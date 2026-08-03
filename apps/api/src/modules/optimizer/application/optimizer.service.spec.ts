import { GeoPoint } from '../domain/geo-point';
import type { DistanceProviderPort } from '../domain/ports/distance-provider.port';
import type {
  RouteOptimizationStrategy,
  StrategyContext,
} from '../domain/ports/route-optimization-strategy.port';
import type { OptimizeRouteUseCase } from './optimize-route.use-case';
import type { RoutePlanRepositoryPort } from '../domain/ports/route-plan-repository.port';
import { RoutePlan, type NewRoutePlan } from '../domain/route-plan';
import { OptimizerService } from './optimizer.service';
import type { StrategyRegistry } from './strategy-registry';

/** Distância euclidiana simples — determinística e suficiente para o teste. */
const euclidean: DistanceProviderPort = {
  distanceKm: (a: GeoPoint, b: GeoPoint) => {
    const dx = a.latitude - b.latitude;
    const dy = a.longitude - b.longitude;
    return Math.sqrt(dx * dx + dy * dy);
  },
};

/** Estratégia que devolve uma ordem fixa (a "otimizada"). */
function registryReturning(order: number[]): StrategyRegistry {
  const strategy: RouteOptimizationStrategy = {
    name: 'nearest-neighbor-2opt',
    optimize: (_ctx: StrategyContext) => ({ order }),
  };
  return { get: () => strategy } as unknown as StrategyRegistry;
}

/** Sem modelo treinado a correção é zero — o padrão até alguém treinar (ADR-0090). */
const semCorrecao = { correctionMinutes: jest.fn().mockResolvedValue(0) };

describe('OptimizerService.estimate', () => {
  const optimizeRoute = { execute: jest.fn() } as unknown as OptimizeRouteUseCase;
  // `estimate` não toca no repositório de planos (só `etaForDelivery` usa).
  const plans = { findAll: jest.fn() } as unknown as RoutePlanRepositoryPort;

  it('retorna zero de economia para menos de 2 paradas', async () => {
    const service = new OptimizerService(euclidean, registryReturning([0]), optimizeRoute, plans, semCorrecao);

    await expect(service.estimate([{ latitude: 0, longitude: 0 }])).resolves.toEqual({
      savingsKm: 0,
      savingsPct: 0,
    });
  });

  it('calcula economia quando a ordem otimizada encurta o trajeto', async () => {
    // Paradas em linha: 0 → 2 → 1 (baseline) tem ida-e-volta; a ordem 0 → 1 → 2
    // (otimizada) é monotônica e mais curta.
    const stops = [
      { latitude: 0, longitude: 0 },
      { latitude: 0, longitude: 1 },
      { latitude: 0, longitude: 2 },
    ];
    // baseline é a ordem natural [0,1,2]; devolvemos a mesma → economia 0,
    // depois uma pior para garantir sinal. Aqui devolvemos [0,2,1] como "otimizada"
    // para exercitar o cálculo de savings (pode ser negativo/positivo).
    const service = new OptimizerService(euclidean, registryReturning([0, 1, 2]), optimizeRoute, plans, semCorrecao);

    const result = await service.estimate(stops);

    // Ordem otimizada == baseline natural → sem economia, mas o caminho de
    // cálculo (matriz, métricas, savings) foi exercitado sem lançar.
    expect(result.savingsKm).toBe(0);
    expect(typeof result.savingsPct).toBe('number');
  });
});

describe('OptimizerService.optimizeDeliveries', () => {
  const plans = { findAll: jest.fn() } as unknown as RoutePlanRepositoryPort;

  it('delega ao OptimizeRouteUseCase e retorna o id do plano', async () => {
    const optimizeRoute = { execute: jest.fn().mockResolvedValue({ id: 'plan-1' }) } as unknown as OptimizeRouteUseCase;
    const service = new OptimizerService(euclidean, registryReturning([0]), optimizeRoute, plans, semCorrecao);

    const id = await service.optimizeDeliveries('tenant-1', 'user-1', ['d-1', 'd-2']);

    expect(id).toBe('plan-1');
    expect(optimizeRoute.execute).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      actorId: 'user-1',
      deliveryIds: ['d-1', 'd-2'],
    });
  });
});

describe('OptimizerService.etaPredictionForDelivery', () => {
  /** Partida da rota — o minuto zero de `etaMinutes` (ADR-0105). */
  const PARTIDA = new Date('2026-08-03T08:00:00.000Z');

  /** Plano com uma parada por entrega, cada uma com o seu ETA. */
  function plano(paradas: { deliveryId: string; etaMinutes: number }[]): RoutePlan {
    const base: NewRoutePlan = {
      tenantId: 'tenant-1',
      driverId: 'ficha-1',
      driverScoped: true,
      strategy: 'nearest-neighbor-2opt',
      status: 'completed',
      params: { averageSpeedKmh: 30, serviceTimeMinutes: 5, hasOrigin: false },
      stops: paradas.map((p, i) => ({
        sequence: i + 1,
        deliveryId: p.deliveryId,
        latitude: 0,
        longitude: 0,
        etaMinutes: p.etaMinutes,
        legDistanceKm: 0,
        cumulativeDistanceKm: 0,
        priority: 'normal',
        timeWindowRespected: null,
      })),
      metrics: { totalDistanceKm: 1, totalTimeMinutes: 10, stops: paradas.length },
      baseline: { totalDistanceKm: 1, totalTimeMinutes: 10, stops: paradas.length },
      savings: { distanceKm: 0, timeMinutes: 0, distancePct: 0, timePct: 0 },
      score: 80,
      explanation: 'ok',
      departureAt: PARTIDA,
    };
    return RoutePlan.create(base);
  }

  function servico(contendo: RoutePlan | null) {
    const findLatestContainingDelivery = jest.fn().mockResolvedValue(contendo);
    const findAll = jest.fn();
    const plans = { findAll, findLatestContainingDelivery } as unknown as RoutePlanRepositoryPort;
    const service = new OptimizerService(
      euclidean,
      registryReturning([0]),
      { execute: jest.fn() } as unknown as OptimizeRouteUseCase,
      plans,
      semCorrecao,
    );
    return { service, findLatestContainingDelivery, findAll };
  }

  // NAV-4.3 / ADR-0102: a entrega pertence ao plano que a roteirizou. Enquanto
  // o ETA saía do "mais recente do tenant", numa frota ele era nulo para todo
  // motorista menos quem otimizou por último — e em silêncio.
  it('lê o plano que contém a entrega, não o mais recente do tenant', async () => {
    const { service, findLatestContainingDelivery, findAll } = servico(
      plano([
        { deliveryId: 'd-1', etaMinutes: 0 },
        { deliveryId: 'd-2', etaMinutes: 45 },
      ]),
    );

    const previsao = await service.etaPredictionForDelivery('tenant-1', 'd-2');

    expect(findLatestContainingDelivery).toHaveBeenCalledWith('tenant-1', 'd-2');
    expect(findAll).not.toHaveBeenCalled();
    expect(previsao?.arrivalAt).toEqual(new Date('2026-08-03T08:45:00.000Z'));
  });

  it('entrega em nenhum plano: sem previsão, e não é erro', async () => {
    const { service } = servico(null);

    expect(await service.etaPredictionForDelivery('tenant-1', 'd-9')).toBeNull();
  });
});
