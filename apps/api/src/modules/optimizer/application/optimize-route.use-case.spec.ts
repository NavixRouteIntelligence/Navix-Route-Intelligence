import type { AuditLogPort } from '../../../shared/audit/audit-log.port';
import type { PagedResult } from '../../../shared/kernel/pagination';
import { HaversineRoutingProvider } from '../infrastructure/routing/haversine-routing.provider';
import type { OptimizerMetrics } from '../infrastructure/observability/optimizer-metrics';
import { ManualStrategy } from '../infrastructure/strategies/manual.strategy';
import { NearestNeighbor2OptStrategy } from '../infrastructure/strategies/nearest-neighbor-2opt.strategy';
import type { RoutePlan } from '../domain/route-plan';
import type { DeliveryGatewayPort } from './ports/delivery-gateway.port';
import type { RoutePlanRepositoryPort } from '../domain/ports/route-plan-repository.port';
import { OptimizeRouteUseCase } from './optimize-route.use-case';
import { DomainEventBus } from '../../../shared/events/domain-event-bus';
import { RouteSolver } from './route-solver';
import { StrategyRegistry } from './strategy-registry';

function build(vigente: RoutePlan | null = null) {
  const saved: RoutePlan[] = [];
  const plans: RoutePlanRepositoryPort = {
    save: async (p) => void saved.push(p),
    findById: async () => null,
    findAll: async (): Promise<PagedResult<RoutePlan>> => ({ items: [], total: 0 }),
    findActiveForDriver: async () => null,
    findActiveForDrivers: async () => new Map(),
    findLatestContainingDelivery: async () => null,
    findLatestRequestedForDriver: async () => vigente,
  };
  const gateway: DeliveryGatewayPort = {
    // Devolve as entregas em ordem **invertida** de propósito: é o que a busca
    // por id faz na prática, já que `IN (...)` não preserva a ordem do pedido.
    getStops: async (_t, ids) =>
      [...ids].reverse().map((id, i) => ({
        id,
        latitude: 0,
        longitude: i,
        priority: 'normal' as const,
        timeWindow: null,
      })),
    getOwnership: async () => [],
    listActiveStops: async () => [],
  };
  const audit: AuditLogPort = { record: async () => undefined };
  // Sem histórico de tempo de serviço por padrão (todos os pontos = null).
  const history = { typicalServiceMinutes: async (_t: string, pts: unknown[]) => pts.map(() => null) };
  const registry = new StrategyRegistry([new NearestNeighbor2OptStrategy(), new ManualStrategy()]);
  const metrics = {
    observeSolve: jest.fn(),
    markInfeasible: jest.fn(),
  } as unknown as OptimizerMetrics;
  const solver = new RouteSolver(new HaversineRoutingProvider(), { augment: () => ({}) }, registry);
  const bus = new DomainEventBus();
  const uc = new OptimizeRouteUseCase(plans, gateway, audit, history, solver, metrics, bus);
  return { uc, saved, metrics, bus };
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

// NAV-4.4 / ADR-0103: a ordem que o motorista arrastou não pode ser desfeita
// por um job que ficou para trás na fila.
describe('OptimizeRouteUseCase — preservação da ordem manual', () => {
  const FICHA = 'ficha-maria';
  const PEDIDO_ANTIGO = new Date('2026-08-03T09:00:00.000Z');
  const PEDIDO_NOVO = new Date('2026-08-03T09:05:00.000Z');

  /** Três paradas em linha, para que "otimizar" tenha o que reordenar. */
  const paradas = [
    { id: S1, latitude: 0, longitude: 0 },
    { id: S2, latitude: 0, longitude: 2 },
    { id: S3, latitude: 0, longitude: 1 },
  ];

  function comando(over: Record<string, unknown> = {}) {
    return {
      tenantId: 't1',
      actorId: 'u1',
      driverId: FICHA,
      driverScoped: true,
      stops: paradas,
      ...over,
    };
  }

  it('a ordem manual é gravada com posição explícita por parada', async () => {
    const { uc, saved } = build();

    const view = await uc.execute(comando({ strategy: 'manual', requestedAt: PEDIDO_NOVO }));

    // Identidade: a sequência sai exatamente na ordem enviada, numerada.
    expect(view.stops.map((s) => s.deliveryId)).toEqual([S1, S2, S3]);
    expect(view.stops.map((s) => s.sequence)).toEqual([1, 2, 3]);
    expect(saved).toHaveLength(1);
    expect(saved[0].snapshot().strategy).toBe('manual');
  });

  /** Executa uma otimização e devolve o plano de domínio realmente gravado. */
  async function planoGravado(over: Record<string, unknown>): Promise<RoutePlan> {
    const { uc, saved } = build();
    await uc.execute(comando(over));
    return saved[0];
  }

  it('job pedido antes não desfaz a ordem pedida depois', async () => {
    const manual = await planoGravado({ strategy: 'manual', requestedAt: PEDIDO_NOVO });

    // O job antigo termina agora, depois da reordenação manual.
    const { uc, saved } = build(manual);
    const view = await uc.execute(comando({ requestedAt: PEDIDO_ANTIGO }));

    // Nada gravado, e quem chamou recebe a rota que vale — não a dele.
    expect(saved).toHaveLength(0);
    expect(view.id).toBe(manual.id);
    expect(view.stops.map((s) => s.deliveryId)).toEqual([S1, S2, S3]);
  });

  it('um pedido mais recente substitui normalmente', async () => {
    const antigo = await planoGravado({ requestedAt: PEDIDO_ANTIGO });

    const { uc, saved } = build(antigo);
    const view = await uc.execute(comando({ strategy: 'manual', requestedAt: PEDIDO_NOVO }));

    expect(saved).toHaveLength(1);
    expect(view.id).not.toBe(antigo.id);
  });

  // O plano do despacho roteiriza recortes diferentes da frota: vários por dia
  // são legítimos, e a regra de substituição não se aplica a eles.
  it('plano do despacho não é descartado por um plano de motorista', async () => {
    const doMotorista = await planoGravado({ requestedAt: PEDIDO_NOVO });

    const { uc, saved } = build(doMotorista);
    await uc.execute(comando({ driverScoped: false, requestedAt: PEDIDO_ANTIGO }));

    expect(saved).toHaveLength(1);
  });

  // O dia é o do pedido: um job pedido às 23h55 e concluído às 00h05 pertence
  // ao dia em que o motorista o pediu.
  it('o dia operacional segue o pedido, não a conclusão', async () => {
    const { uc, saved } = build();

    await uc.execute(
      comando({ strategy: 'manual', requestedAt: new Date('2026-08-03T23:55:00.000Z') }),
    );

    expect(saved[0].snapshot().operationalDay).toBe('2026-08-03');
  });

  // A armadilha que fazia a ordem manual não sobreviver: a busca por id devolve
  // as linhas na ordem do banco, e a estratégia `manual` é a identidade — sem
  // reordenar pelo pedido, ela preservava a ordem do Postgres.
  it('a ordem pedida em deliveryIds é a que a estratégia manual preserva', async () => {
    const { uc } = build();

    const view = await uc.execute(
      comando({ stops: undefined, deliveryIds: [S3, S1, S2], strategy: 'manual' }),
    );

    expect(view.stops.map((s) => s.deliveryId)).toEqual([S3, S1, S2]);
    expect(view.stops.map((s) => s.sequence)).toEqual([1, 2, 3]);
  });
});

// NAV-4.6 / ADR-0105: o minuto zero da rota deixa de ser inventado.
describe('OptimizeRouteUseCase — horário real de início', () => {
  const paradas = [
    { id: S1, latitude: 0, longitude: 0 },
    { id: S2, latitude: 0, longitude: 1 },
  ];

  function comando(over: Record<string, unknown> = {}) {
    return { tenantId: 't1', actorId: 'u1', stops: paradas, ...over };
  }

  it('sem partida informada, a rota começa quando foi pedida', async () => {
    const pedido = new Date('2026-08-04T14:00:00.000Z');
    const { uc, saved } = build();

    await uc.execute(comando({ requestedAt: pedido }));

    expect(saved[0].snapshot().departureAt).toEqual(pedido);
  });

  // Planejar hoje a rota de amanhã: sem `startAt`, os ETAs sairiam ancorados
  // em hoje, e o rastreio anunciaria a entrega para o dia errado.
  it('a partida informada vence o instante do pedido', async () => {
    const pedido = new Date('2026-08-03T18:00:00.000Z');
    const partida = new Date('2026-08-04T08:00:00.000Z');
    const { uc, saved } = build();

    await uc.execute(comando({ requestedAt: pedido, startAt: partida }));

    expect(saved[0].snapshot().departureAt).toEqual(partida);
    // O dia operacional segue o pedido (ADR-0103), não a partida.
    expect(saved[0].snapshot().operationalDay).toBe('2026-08-03');
  });

  // A âncora tem de ser a mesma nos dois lados: se o solver medisse a partir de
  // um instante e o consumidor somasse a outro, o ETA sairia deslocado — que é
  // exatamente o defeito que esta ADR fecha.
  it('as janelas são medidas a partir da mesma partida', async () => {
    const partida = new Date('2026-08-04T08:00:00.000Z');
    const abre = new Date('2026-08-04T09:00:00.000Z');
    const fecha = new Date('2026-08-04T17:00:00.000Z');
    const { uc, saved } = build();

    await uc.execute(
      comando({
        startAt: partida,
        // Paradas vizinhas (~1 km): o trajeto é curto o bastante para o veículo
        // chegar bem antes de a janela abrir.
        stops: [
          { id: S1, latitude: 38.72, longitude: -9.14 },
          {
            id: S2,
            latitude: 38.73,
            longitude: -9.14,
            timeWindow: { start: abre.toISOString(), end: fecha.toISOString() },
          },
        ],
      }),
    );

    const plano = saved[0].snapshot();
    const comJanela = plano.stops.find((s) => s.deliveryId === S2)!;
    // A janela abre 60 min depois da partida; o veículo chega antes e espera.
    expect(comJanela.etaMinutes).toBeLessThan(60);
    expect(comJanela.waitMinutes).toBeGreaterThan(0);
    expect(comJanela.etaMinutes + comJanela.waitMinutes!).toBeCloseTo(60, 1);
  });

  it('o fuso do tenant decide o dia operacional', async () => {
    // 00:30 UTC = 21:30 do dia anterior em São Paulo.
    const pedido = new Date('2026-08-04T00:30:00.000Z');
    const { uc, saved } = build();

    await uc.execute(comando({ requestedAt: pedido, timeZone: 'America/Sao_Paulo' }));

    expect(saved[0].snapshot().operationalDay).toBe('2026-08-03');
  });
});
