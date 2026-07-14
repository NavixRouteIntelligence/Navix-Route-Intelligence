import type { AuditLogPort } from '../../../shared/audit/audit-log.port';
import type { PagedResult } from '../../../shared/kernel/pagination';
import { HaversineDistanceProvider } from '../infrastructure/distance/haversine-distance.provider';
import type { OptimizerMetrics } from '../infrastructure/observability/optimizer-metrics';
import { NearestNeighbor2OptStrategy } from '../infrastructure/strategies/nearest-neighbor-2opt.strategy';
import type { RoutePlan } from '../domain/route-plan';
import type { DeliveryGatewayPort } from './ports/delivery-gateway.port';
import type { RoutePlanRepositoryPort } from '../domain/ports/route-plan-repository.port';
import { OptimizeRouteUseCase } from './optimize-route.use-case';
import { StrategyRegistry } from './strategy-registry';

function build() {
  const saved: RoutePlan[] = [];
  const plans: RoutePlanRepositoryPort = {
    save: async (p) => void saved.push(p),
    findById: async () => null,
    findAll: async (): Promise<PagedResult<RoutePlan>> => ({ items: [], total: 0 }),
  };
  const gateway: DeliveryGatewayPort = { getStops: async () => [] };
  const audit: AuditLogPort = { record: async () => undefined };
  const registry = new StrategyRegistry([new NearestNeighbor2OptStrategy()]);
  const metrics = {
    observeSolve: jest.fn(),
    markInfeasible: jest.fn(),
  } as unknown as OptimizerMetrics;
  const uc = new OptimizeRouteUseCase(
    plans,
    new HaversineDistanceProvider(),
    gateway,
    audit,
    registry,
    metrics,
  );
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
