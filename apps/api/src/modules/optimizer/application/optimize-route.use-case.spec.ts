import type { AuditLogPort } from '../../../shared/audit/audit-log.port';
import type { PagedResult } from '../../../shared/kernel/pagination';
import { HaversineRoutingProvider } from '../infrastructure/routing/haversine-routing.provider';
import type { RoutingProviderPort } from '../domain/ports/routing-provider.port';
import { UNREACHABLE } from '../domain/reachability';
import { resolveRoutingProfile } from '../domain/routing-profile';
import type { OptimizerMetrics } from '../infrastructure/observability/optimizer-metrics';
import { ManualStrategy } from '../infrastructure/strategies/manual.strategy';
import { NearestNeighbor2OptStrategy } from '../infrastructure/strategies/nearest-neighbor-2opt.strategy';
import { RoutePlan } from '../domain/route-plan';
import type { AppConfigService } from '../../../shared/config/app-config.service';
import type { DeliveryGatewayPort } from './ports/delivery-gateway.port';
import type { VehicleCapacityPort } from './ports/vehicle-capacity.port';
import type { RoutePlanRepositoryPort } from '../domain/ports/route-plan-repository.port';
import { OptimizeRouteUseCase } from './optimize-route.use-case';
import { DomainEventBus } from '../../../shared/events/domain-event-bus';
import { RouteSolver } from './route-solver';
import { StrategyRegistry } from './strategy-registry';

function build(
  vigente: RoutePlan | null = null,
  routing?: RoutingProviderPort,
  vehicles?: VehicleCapacityPort,
  entregasGateway?: DeliveryGatewayPort,
  // Sobrescreve parte do repositório: é o que permite simular outro processo
  // gravando no meio da corrida (ADR-0113).
  planosOverride?: Partial<RoutePlanRepositoryPort>,
) {
  const saved: RoutePlan[] = [];
  const plans: RoutePlanRepositoryPort = {
    save: async (p) => {
      saved.push(p);
      return 'saved' as const;
    },
    findById: async () => null,
    findAll: async (): Promise<PagedResult<RoutePlan>> => ({ items: [], total: 0 }),
    findActiveForDriver: async () => null,
    findActiveForDrivers: async () => new Map(),
    findLatestContainingDelivery: async () => null,
    findLatestRequestedForDriver: async () => vigente,
    ...planosOverride,
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
        weightKg: null,
        volumeM3: null,
        vehicleId: null,
      })),
    getOwnership: async () => [],
    listActiveStops: async () => [],
  };
  const audit: AuditLogPort = { record: async () => undefined };
  // Sem histórico de tempo de serviço por padrão (todos os pontos = null).
  const history = {
    typicalServiceMinutes: async (_t: string, pts: unknown[]) => pts.map(() => null),
  };
  const registry = new StrategyRegistry([new NearestNeighbor2OptStrategy(), new ManualStrategy()]);
  const metrics = {
    observeSolve: jest.fn(),
    markInfeasible: jest.fn(),
    observePlanOutcome: jest.fn(),
    observePlanWrite: jest.fn(),
  } as unknown as OptimizerMetrics;
  const solver = new RouteSolver(
    routing ?? new HaversineRoutingProvider(),
    { augment: () => ({}) },
    registry,
  );
  const bus = new DomainEventBus();
  const uc = new OptimizeRouteUseCase(
    plans,
    entregasGateway ?? gateway,
    vehicles ?? { capacityOf: async () => null },
    audit,
    history,
    solver,
    metrics,
    bus,
    { optimizer: { weightOverrides: {} } } as unknown as AppConfigService,
  );
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

// NAV-4.7 / ADR-0106: trecho sem rota é proibição, e a rota parcial diz o que
// ficou de fora e por quê.
describe('OptimizeRouteUseCase — trechos sem rota', () => {
  /** Provedor com um conjunto de pares proibidos (índices na ordem enviada). */
  function comProibidos(n: number, proibidos: [number, number][]): RoutingProviderPort {
    return {
      matrix: async () => {
        const m = (): number[][] =>
          Array.from({ length: n }, (_, i) =>
            Array.from({ length: n }, (_, j): number => (i === j ? 0 : 10)),
          );
        const distanceKm = m();
        const durationMin = m();
        for (const [a, b] of proibidos) {
          distanceKm[a][b] = distanceKm[b][a] = UNREACHABLE;
          durationMin[a][b] = durationMin[b][a] = UNREACHABLE;
        }
        return { distanceKm, durationMin, source: 'provider' as const };
      },
    };
  }

  const tresParadas = [
    { id: S1, latitude: 38.72, longitude: -9.14 },
    { id: S2, latitude: 38.73, longitude: -9.15 },
    { id: S3, latitude: 38.74, longitude: -9.16 },
  ];

  const comando = (over: Record<string, unknown> = {}) => ({
    tenantId: 't1',
    actorId: 'u1',
    stops: tresParadas,
    ...over,
  });

  it('parada isolada sai da rota, com motivo rastreável', async () => {
    // S3 sem rota para ninguém.
    const { uc, saved } = build(
      null,
      comProibidos(3, [
        [2, 0],
        [2, 1],
      ]),
    );

    const view = await uc.execute(comando());

    expect(view.stops.map((s) => s.deliveryId)).toEqual([S1, S2]);
    expect(view.unassignedStops).toEqual([{ deliveryId: S3, reason: 'isolated' }]);
    // O plano deixa de se dizer completo quando deixou entrega para trás.
    expect(view.status).toBe('partial');
    // O sinal chega a quem lê a tela: a explicação é o que web e app mostram.
    expect(view.explanation).toContain('1 parada(s) sem rota viável, fora do plano');
    // Nenhum trecho da rota resultante ficou com custo zero forjado.
    expect(saved[0].snapshot().metrics.totalDistanceKm).toBeGreaterThan(0);
  });

  it('nenhum trecho inválido entra no tempo total', async () => {
    const { uc, saved } = build(
      null,
      comProibidos(3, [
        [2, 0],
        [2, 1],
      ]),
    );

    await uc.execute(comando());

    const m = saved[0].snapshot().metrics;
    expect(Number.isFinite(m.totalTimeMinutes)).toBe(true);
    expect(Number.isFinite(m.totalDistanceKm)).toBe(true);
    // Duas paradas de fato roteirizadas — a excluída não conta.
    expect(m.stops).toBe(2);
  });

  // Sem rota viável entre o que sobrou, falhar é a resposta honesta: entregar
  // uma "rota" de uma parada só seria ajuste silencioso.
  it('sem paradas conectadas suficientes, falha explicitamente', async () => {
    const { uc, saved } = build(
      null,
      comProibidos(3, [
        [0, 1],
        [0, 2],
        [1, 2],
      ]),
    );

    await expect(uc.execute(comando())).rejects.toThrow(/não há rota viável/i);
    expect(saved).toHaveLength(0);
  });

  it('matriz sem trecho proibido não muda nada (retrocompatível)', async () => {
    const { uc } = build(null, comProibidos(3, []));

    const view = await uc.execute(comando());

    expect(view.stops).toHaveLength(3);
    expect(view.unassignedStops).toBeUndefined();
    expect(view.status).toBe('completed');
    expect(view.explanation).not.toContain('sem rota viável');
  });
});

// NAV-4.8 / ADR-0107: a degradação deixa de ser silenciosa — o plano declara
// de onde vieram os números.
describe('OptimizeRouteUseCase — origem das distâncias no plano', () => {
  const duasParadas = [
    { id: S1, latitude: 38.72, longitude: -9.14 },
    { id: S2, latitude: 38.73, longitude: -9.15 },
  ];
  const comando = { tenantId: 't1', actorId: 'u1', stops: duasParadas };

  function comFonte(source: 'provider' | 'geometric'): RoutingProviderPort {
    return {
      matrix: async () => ({
        distanceKm: [
          [0, 5],
          [5, 0],
        ],
        durationMin: [
          [0, 10],
          [10, 0],
        ],
        source,
      }),
    };
  }

  it('rota medida registra a origem e não polui a explicação', async () => {
    const { uc } = build(null, comFonte('provider'));

    const view = await uc.execute(comando);

    expect(view.params.routingSource).toBe('provider');
    // Dizer "medido" em toda rota seria ruído; a ausência do aviso é que passa
    // a significar medição.
    expect(view.explanation).not.toContain('linha reta');
  });

  it('rota geométrica declara a estimativa no plano e na explicação', async () => {
    const { uc } = build(null, comFonte('geometric'));

    const view = await uc.execute(comando);

    expect(view.params.routingSource).toBe('geometric');
    expect(view.explanation).toContain('distâncias estimadas em linha reta');
  });
});

// NAV-4.9 / ADR-0108: o perfil usado fica no plano, e a ressalva chega a quem
// lê a rota.
describe('OptimizeRouteUseCase — perfil do veículo no plano', () => {
  const duasParadas = [
    { id: S1, latitude: 38.72, longitude: -9.14 },
    { id: S2, latitude: 38.73, longitude: -9.15 },
  ];

  /** Provedor que devolve o perfil pedido, como o Mapbox faria. */
  function provedorQueDeclara(): RoutingProviderPort & { tipos: (string | null | undefined)[] } {
    const tipos: (string | null | undefined)[] = [];
    return {
      tipos,
      matrix: async (_p, _s, vehicleType) => {
        tipos.push(vehicleType);
        return {
          distanceKm: [
            [0, 5],
            [5, 0],
          ],
          durationMin: [
            [0, 10],
            [10, 0],
          ],
          source: 'provider' as const,
          profile: resolveRoutingProfile(vehicleType),
        };
      },
    };
  }

  it('o tipo do veículo chega ao provedor e o perfil fica no plano', async () => {
    const routing = provedorQueDeclara();
    const { uc } = build(null, routing);

    const view = await uc.execute({
      tenantId: 't1',
      actorId: 'u1',
      stops: duasParadas,
      vehicle: { type: 'bicycle' },
    });

    expect(routing.tipos).toEqual(['bicycle']);
    expect(view.params.routingProfile).toEqual({ profile: 'cycling', fidelity: 'exact' });
    expect(view.params.vehicleType).toBe('bicycle');
  });

  it('perfil aproximado declara a ressalva na explicação', async () => {
    const { uc } = build(null, provedorQueDeclara());

    const view = await uc.execute({
      tenantId: 't1',
      actorId: 'u1',
      stops: duasParadas,
      vehicle: { type: 'truck' },
    });

    expect(view.params.routingProfile?.fidelity).toBe('approximate');
    expect(view.explanation).toMatch(/altura, peso e restrição de centro urbano/);
  });

  it('perfil exato não polui a explicação', async () => {
    const { uc } = build(null, provedorQueDeclara());

    const view = await uc.execute({
      tenantId: 't1',
      actorId: 'u1',
      stops: duasParadas,
      vehicle: { type: 'car' },
    });

    expect(view.params.routingProfile?.fidelity).toBe('exact');
    expect(view.explanation).not.toMatch(/não entram no traçado/);
  });

  // A velocidade do perfil do veículo continua valendo onde ela importa: no
  // caminho geométrico, que deriva duração da velocidade (ADR-0022).
  it('a velocidade do tipo é a do perfil operacional', async () => {
    const { uc, saved } = build();

    await uc.execute({
      tenantId: 't1',
      actorId: 'u1',
      stops: duasParadas,
      vehicle: { type: 'bicycle' },
    });

    expect(saved[0].snapshot().params.averageSpeedKmh).toBe(15);
  });
});

// NAV-4.10 / ADR-0109: peso e volume reais da entrega, e capacidade do veículo
// **atribuído**. Até aqui a demanda de toda entrega real era zero, então a
// máquina de capacidade da ADR-0022 nunca acusava excesso no caminho que
// importa.
describe('OptimizeRouteUseCase — demanda real das entregas', () => {
  const D1 = S1;
  const D2 = S2;
  const D3 = S3;

  /** Gateway que devolve entregas com demanda e veículo atribuído. */
  function entregas(
    itens: { id: string; weightKg: number | null; volumeM3: number | null; vehicleId?: string }[],
  ): DeliveryGatewayPort {
    return {
      getOwnership: async () => [],
      listActiveStops: async () => [],
      getStops: async (_t, ids) =>
        ids.map((id, i) => {
          const item = itens.find((x) => x.id === id)!;
          return {
            id,
            latitude: 38.7 + i * 0.01,
            longitude: -9.1,
            priority: 'normal' as const,
            timeWindow: null,
            weightKg: item.weightKg,
            volumeM3: item.volumeM3,
            vehicleId: item.vehicleId ?? null,
          };
        }),
    };
  }

  /** Executa com o gateway de entregas, montando o caso de uso à mão. */
  async function rodar(
    itens: Parameters<typeof entregas>[0],
    capacidade?: { weightKg: number | null; volumeM3: number | null },
  ) {
    const vehicles: VehicleCapacityPort = {
      capacityOf: async () => (capacidade ? { type: 'van' as const, ...capacidade } : null),
    };
    const { uc } = build(null, undefined, vehicles, entregas(itens));
    return uc.execute({
      tenantId: 't1',
      actorId: 'u1',
      deliveryIds: itens.map((i) => i.id),
    });
  }

  it('a demanda real da entrega chega ao plano', async () => {
    const view = await rodar([
      { id: D1, weightKg: 30, volumeM3: 0.5, vehicleId: 'v1' },
      { id: D2, weightKg: 20, volumeM3: 0.3, vehicleId: 'v1' },
    ]);

    expect(view.metrics.totalWeightKg).toBe(50);
    expect(view.metrics.totalVolumeM3).toBe(0.8);
  });

  // A capacidade vem do veículo **atribuído**, não do default do tipo.
  it('a capacidade sai do veículo atribuído às entregas', async () => {
    const view = await rodar(
      [
        { id: D1, weightKg: 60, volumeM3: 1, vehicleId: 'v1' },
        { id: D2, weightKg: 40, volumeM3: 1, vehicleId: 'v1' },
      ],
      { weightKg: 100, volumeM3: 10 },
    );

    // Limite exato: 100 de 100 cabe, e a rota é viável.
    expect(view.capacity?.feasible).toBe(true);
    expect(view.unassignedStops).toBeUndefined();
  });

  it('excesso vira parada não atribuída, com motivo na explicação', async () => {
    const view = await rodar(
      [
        { id: D1, weightKg: 40, volumeM3: 1, vehicleId: 'v1' },
        { id: D2, weightKg: 40, volumeM3: 1, vehicleId: 'v1' },
        { id: D3, weightKg: 900, volumeM3: 1, vehicleId: 'v1' },
      ],
      { weightKg: 100, volumeM3: 10 },
    );

    // Motivo junto do id (ADR-0110): uma lista só responde "o que ficou de fora".
    expect(view.unassignedStops).toEqual([{ deliveryId: D3, reason: 'capacity' }]);
    expect(view.status).toBe('partial');
    expect(view.stops.map((s) => s.deliveryId)).toEqual([D1, D2]);
    expect(view.explanation).toContain('não atribuída(s) por capacidade');
  });

  // Política explícita de ausência: conta como zero, mas o plano declara.
  it('entrega sem peso/volume conta como zero e é declarada no plano', async () => {
    const view = await rodar(
      [
        { id: D1, weightKg: null, volumeM3: null, vehicleId: 'v1' },
        { id: D2, weightKg: 10, volumeM3: 0.1, vehicleId: 'v1' },
      ],
      { weightKg: 100, volumeM3: 10 },
    );

    expect(view.params.stopsWithoutDemand).toBe(1);
    expect(view.metrics.totalWeightKg).toBe(10);
    expect(view.explanation).toContain('1 parada(s) sem peso/volume informados');
  });

  it('sem paradas desconhecidas, a explicação não menciona ausência', async () => {
    const view = await rodar(
      [
        { id: D1, weightKg: 10, volumeM3: 0.1, vehicleId: 'v1' },
        { id: D2, weightKg: 10, volumeM3: 0.1, vehicleId: 'v1' },
      ],
      { weightKg: 100, volumeM3: 10 },
    );

    expect(view.params.stopsWithoutDemand).toBeUndefined();
    expect(view.explanation).not.toContain('sem peso/volume');
  });

  // Entregas de veículos diferentes: não existe "a capacidade" dessa rota, e
  // escolher uma delas seria adivinhar.
  it('veículos diferentes na mesma rota não definem capacidade', async () => {
    const view = await rodar(
      [
        { id: D1, weightKg: 900, volumeM3: 1, vehicleId: 'v1' },
        { id: D2, weightKg: 900, volumeM3: 1, vehicleId: 'v2' },
      ],
      { weightKg: 100, volumeM3: 10 },
    );

    expect(view.unassignedStops).toBeUndefined();
    // A carga é reportada, mas nenhum limite é aplicado — que é o honesto para
    // uma rota que ninguém sabe quem vai levar.
    expect(view.capacity?.capacityKg).toBeNull();
    expect(view.capacity?.feasible).toBe(true);
  });
});

// NAV-4.13 / ADR-0113: entre ler a rota vigente e gravar havia uma janela, e
// dois processos cabiam nela. A API escala por processo (`concurrency: 1` em
// cada worker), então isto não é hipótese: reproduzido com duas instâncias,
// seis rodadas, seis pares de planos gravados para o mesmo motorista e dia.
describe('OptimizeRouteUseCase — concorrência entre gravações', () => {
  const FICHA = 'ficha-maria';
  const PEDIDO_ANTIGO = new Date('2026-08-03T09:00:00.000Z');
  const PEDIDO_NOVO = new Date('2026-08-03T09:05:00.000Z');
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

  /** Plano de domínio para servir de "rota vigente" nos testes. */
  function vigenteCom(requestedAt: Date, version: number): RoutePlan {
    return RoutePlan.create({
      tenantId: 't1',
      driverId: FICHA,
      driverScoped: true,
      requestedAt,
      version,
      strategy: 'nearest-neighbor-2opt',
      params: { averageSpeedKmh: 30, serviceTimeMinutes: 5, hasOrigin: false },
      stops: [],
      metrics: { totalDistanceKm: 1, totalTimeMinutes: 1, stops: 0 },
      baseline: { totalDistanceKm: 1, totalTimeMinutes: 1, stops: 0 },
      savings: { distanceKm: 0, distancePct: 0, timeMinutes: 0, timePct: 0 },
      score: 1,
      explanation: 'vigente',
    });
  }

  it('a rota do motorista nasce na versão 1 e cresce a cada substituição', async () => {
    const { uc, saved } = build(vigenteCom(PEDIDO_ANTIGO, 4));

    await uc.execute(comando({ requestedAt: PEDIDO_NOVO }));

    expect(saved[0].snapshot().version).toBe(5);
  });

  // O banco recusa a versão: outro processo gravou primeiro. Relendo, o pedido
  // deste resultado ainda é o mais recente, então ele fica — na versão seguinte.
  it('perder a versão para outro processo não descarta o resultado mais recente', async () => {
    const gravados: RoutePlan[] = [];
    let vigente = vigenteCom(PEDIDO_ANTIGO, 1);
    const { uc } = build(null, undefined, undefined, undefined, {
      findLatestRequestedForDriver: async () => vigente,
      save: async (p) => {
        // A primeira tentativa perde: alguém gravou a versão 2 nesse intervalo.
        if (gravados.length === 0 && p.snapshot().version === 2) {
          vigente = vigenteCom(PEDIDO_ANTIGO, 2);
          return 'version-taken' as const;
        }
        gravados.push(p);
        return 'saved' as const;
      },
    });

    await uc.execute(comando({ requestedAt: PEDIDO_NOVO }));

    expect(gravados).toHaveLength(1);
    expect(gravados[0].snapshot().version).toBe(3);
  });

  // A mesma corrida, com o outro processo trazendo um pedido MAIS recente:
  // agora quem perde a versão é quem tem de sair.
  it('perder a versão para um pedido mais recente descarta este resultado', async () => {
    const gravados: RoutePlan[] = [];
    let vigente = vigenteCom(PEDIDO_ANTIGO, 1);
    const { uc } = build(null, undefined, undefined, undefined, {
      findLatestRequestedForDriver: async () => vigente,
      save: async (p) => {
        if (gravados.length === 0 && p.snapshot().version === 2) {
          vigente = vigenteCom(new Date(PEDIDO_NOVO.getTime() + 60_000), 2);
          return 'version-taken' as const;
        }
        gravados.push(p);
        return 'saved' as const;
      },
    });

    const view = await uc.execute(comando({ requestedAt: PEDIDO_NOVO }));

    expect(gravados).toHaveLength(0);
    expect(view.version).toBe(2);
  });

  // Disputa que não termina: em vez de gravar por cima de quem chegou depois,
  // o resultado sai como qualquer outro que perdeu.
  it('disputa contínua termina em descarte, não em gravação forçada', async () => {
    let versao = 1;
    const { uc } = build(null, undefined, undefined, undefined, {
      findLatestRequestedForDriver: async () => vigenteCom(PEDIDO_ANTIGO, versao),
      save: async () => {
        versao += 1;
        return 'version-taken' as const;
      },
    });

    const view = await uc.execute(comando({ requestedAt: PEDIDO_NOVO }));

    // Nada gravado, e quem chamou recebe a rota que vale.
    expect(view.version).toBe(versao);
  });

  // Repetição: o mesmo pedido processado duas vezes. A segunda não acrescenta
  // rota — o que é o que torna reprocessar um job seguro.
  it('o mesmo pedido processado duas vezes grava uma rota só', async () => {
    const gravados: RoutePlan[] = [];
    let vigente: RoutePlan | null = null;
    const repo: Partial<RoutePlanRepositoryPort> = {
      findLatestRequestedForDriver: async () => vigente,
      save: async (p) => {
        gravados.push(p);
        vigente = p;
        return 'saved' as const;
      },
    };

    const primeira = build(null, undefined, undefined, undefined, repo);
    await primeira.uc.execute(comando({ requestedAt: PEDIDO_NOVO }));
    const segunda = build(null, undefined, undefined, undefined, repo);
    await segunda.uc.execute(comando({ requestedAt: PEDIDO_NOVO }));

    expect(gravados).toHaveLength(1);
  });
});
