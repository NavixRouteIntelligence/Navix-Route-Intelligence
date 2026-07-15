import type { AuditLogPort } from '../../../shared/audit/audit-log.port';
import type { PagedResult } from '../../../shared/kernel/pagination';
import { HaversineDistanceProvider } from '../infrastructure/distance/haversine-distance.provider';
import type { OptimizerMetrics } from '../infrastructure/observability/optimizer-metrics';
import { NearestNeighbor2OptStrategy } from '../infrastructure/strategies/nearest-neighbor-2opt.strategy';
import type { RoutePlan } from '../domain/route-plan';
import type { DeliveryGatewayPort } from './ports/delivery-gateway.port';
import type { RoutePlanRepositoryPort } from '../domain/ports/route-plan-repository.port';
import { OptimizeRouteUseCase } from './optimize-route.use-case';
import { RouteSolver } from './route-solver';
import { StrategyRegistry } from './strategy-registry';

function build() {
  const saved: RoutePlan[] = [];
  const plans: RoutePlanRepositoryPort = {
    save: async (p) => void saved.push(p),
    findById: async () => null,
    findAll: async (): Promise<PagedResult<RoutePlan>> => ({ items: [], total: 0 }),
  };
  const gateway: DeliveryGatewayPort = {
    getStops: async () => [],
    listActiveStops: async () => [],
  };
  const audit: AuditLogPort = { record: async () => undefined };
  const registry = new StrategyRegistry([new NearestNeighbor2OptStrategy()]);
  const metrics = {
    observeSolve: jest.fn(),
    markInfeasible: jest.fn(),
  } as unknown as OptimizerMetrics;
  const solver = new RouteSolver(new HaversineDistanceProvider(), { augment: () => ({}) }, registry);
  const uc = new OptimizeRouteUseCase(plans, gateway, audit, solver, metrics);
  return { uc, saved, metrics };
}

const S1 = '019f3364-0001-7665-bcb4-2cc75f065d01';
const S2 = '019f3364-0002-7665-bcb4-2cc75f065d02';
const base = { tenantId: 't1', actorId: 'u1' };

describe('OptimizeRouteUseCase (restrições ricas — ADR-0022)', () => {
  it('capacidade excedida: rota inviável, score penalizado e métrica marcada', async () => {
    const { uc, metrics } = build();
    const view = await uc.execute({
      ...base,
      vehicle: { type: 'motorcycle' }, // capacidade 30 kg
      stops: [
        { id: S1, latitude: 0, longitude: 0, weightKg: 20 },
        { id: S2, latitude: 0.1, longitude: 0.1, weightKg: 20 },
      ],
    });

    expect(view.params.vehicleType).toBe('motorcycle');
    expect(view.metrics.totalWeightKg).toBe(40);
    expect(view.capacity?.feasible).toBe(false);
    expect(view.capacity?.overWeightKg).toBe(10);
    expect(metrics.markInfeasible).toHaveBeenCalledTimes(1);
    expect(view.explanation).toContain('capacidade excedida');
  });

  it('capacidade suficiente (carrinha): viável', async () => {
    const { uc, metrics } = build();
    const view = await uc.execute({
      ...base,
      vehicle: { type: 'van' }, // 1200 kg
      stops: [
        { id: S1, latitude: 0, longitude: 0, weightKg: 20 },
        { id: S2, latitude: 0.1, longitude: 0.1, weightKg: 20 },
      ],
    });
    expect(view.capacity?.feasible).toBe(true);
    expect(metrics.markInfeasible).not.toHaveBeenCalled();
    expect(view.stops[0].weightKg).toBeDefined();
  });

  it('Modo Economia: registra o modo e estima CO₂ com o veículo (ADR-0026)', async () => {
    const { uc } = build();
    const view = await uc.execute({
      ...base,
      vehicle: { type: 'car' },
      economyMode: 'co2',
      stops: [
        { id: S1, latitude: 0, longitude: 0 },
        { id: S2, latitude: 0.1, longitude: 0.1 },
      ],
    });
    expect(view.params.economyMode).toBe('co2');
    expect(view.metrics.estimatedCo2Kg).toBeGreaterThan(0);
  });

  it('sem veículo nem demanda: retrocompatível (sem bloco de capacidade)', async () => {
    const { uc } = build();
    const view = await uc.execute({
      ...base,
      stops: [
        { id: S1, latitude: 0, longitude: 0 },
        { id: S2, latitude: 0.1, longitude: 0.1 },
      ],
    });
    expect(view.capacity).toBeUndefined();
    expect(view.metrics.totalWeightKg).toBeUndefined();
    expect(view.params.vehicleType).toBeUndefined();
  });

  it('tempo de serviço por parada entra no tempo total', async () => {
    const { uc } = build();
    const view = await uc.execute({
      ...base,
      serviceTimeMinutes: 5,
      stops: [
        { id: S1, latitude: 0, longitude: 0, serviceTimeMinutes: 40 },
        { id: S2, latitude: 0.01, longitude: 0.01 },
      ],
    });
    // 40 (parada 1) + 5 (global na parada 2) = 45 min de serviço, + deslocamento.
    expect(view.metrics.totalTimeMinutes).toBeGreaterThanOrEqual(45);
  });
});

const S3 = '019f3364-0003-7665-bcb4-2cc75f065d03';
const S4 = '019f3364-0004-7665-bcb4-2cc75f065d04';

describe('OptimizeRouteUseCase — multi-veículo (ADR-0022 Fase 2)', () => {
  it('distribui as paradas entre a frota e devolve routes[]', async () => {
    const { uc } = build();
    const view = await uc.execute({
      ...base,
      vehicles: [{ type: 'van' }, { type: 'van' }],
      stops: [
        { id: S1, latitude: 1, longitude: 1 },
        { id: S2, latitude: 1, longitude: -1 },
        { id: S3, latitude: -1, longitude: -1 },
        { id: S4, latitude: -1, longitude: 1 },
      ],
    });

    expect(view.routes).toBeDefined();
    expect(view.routes).toHaveLength(2);
    expect(view.params.vehicleCount).toBe(2);
    // Todas as 4 paradas aparecem, distribuídas entre as rotas.
    const total = view.routes!.reduce((n, r) => n + r.stops.length, 0);
    expect(total).toBe(4);
    expect(view.stops).toHaveLength(4);
    expect(view.metrics.stops).toBe(4);
  });

  it('reporta paradas não atribuídas quando a frota não tem capacidade', async () => {
    const { uc, metrics } = build();
    const view = await uc.execute({
      ...base,
      // 3 paradas de 20 kg, 2 motos (30 kg) → cabe 1 por moto, 1 sobra.
      vehicles: [{ type: 'motorcycle' }, { type: 'motorcycle' }],
      stops: [
        { id: S1, latitude: 1, longitude: 1, weightKg: 20 },
        { id: S2, latitude: 1, longitude: -1, weightKg: 20 },
        { id: S3, latitude: -1, longitude: 0, weightKg: 20 },
      ],
    });
    expect(view.unassignedStops).toHaveLength(1);
    expect(view.params.unassignedCount).toBe(1);
    expect(metrics.markInfeasible).toHaveBeenCalled();
  });

  it('rejeita vehicle + vehicles simultâneos', async () => {
    const { uc } = build();
    await expect(
      uc.execute({
        ...base,
        vehicle: { type: 'car' },
        vehicles: [{ type: 'van' }],
        stops: [
          { id: S1, latitude: 0, longitude: 0 },
          { id: S2, latitude: 1, longitude: 1 },
        ],
      }),
    ).rejects.toThrow(/vehicle.*OU.*vehicles|não ambos/i);
  });
});
