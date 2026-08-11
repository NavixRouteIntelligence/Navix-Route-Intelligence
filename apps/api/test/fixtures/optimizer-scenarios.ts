import type { VehicleType } from '@navix/contracts';

import type { AppConfigService } from '../../src/shared/config/app-config.service';
import type { AuditLogPort } from '../../src/shared/audit/audit-log.port';
import { DomainEventBus } from '../../src/shared/events/domain-event-bus';
import type { LatLng } from '../../src/shared/kernel/geo';
import type { PagedResult } from '../../src/shared/kernel/pagination';
import { OptimizeRouteUseCase } from '../../src/modules/optimizer/application/optimize-route.use-case';
import type { DeliveryGatewayPort } from '../../src/modules/optimizer/application/ports/delivery-gateway.port';
import type { VehicleCapacityPort } from '../../src/modules/optimizer/application/ports/vehicle-capacity.port';
import { RouteSolver } from '../../src/modules/optimizer/application/route-solver';
import { StrategyRegistry } from '../../src/modules/optimizer/application/strategy-registry';
import type { CostAugmentationPort } from '../../src/modules/optimizer/domain/ports/cost-augmentation.port';
import type {
  PlanSaveResult,
  RoutePlanRepositoryPort,
} from '../../src/modules/optimizer/domain/ports/route-plan-repository.port';
import type {
  RouteMatrix,
  RoutingProviderPort,
} from '../../src/modules/optimizer/domain/ports/routing-provider.port';
import { UNREACHABLE } from '../../src/modules/optimizer/domain/reachability';
import { resolveRoutingProfile } from '../../src/modules/optimizer/domain/routing-profile';
import type { RoutePlan } from '../../src/modules/optimizer/domain/route-plan';
import type { OptimizerMetrics } from '../../src/modules/optimizer/infrastructure/observability/optimizer-metrics';
import { ManualStrategy } from '../../src/modules/optimizer/infrastructure/strategies/manual.strategy';
import { NearestNeighbor2OptStrategy } from '../../src/modules/optimizer/infrastructure/strategies/nearest-neighbor-2opt.strategy';
import { OrOpt2OptStrategy } from '../../src/modules/optimizer/infrastructure/strategies/or-opt-2opt.strategy';

/**
 * Fixtures determinísticas da suíte de regressão do otimizador (ADR-0115).
 *
 * ## Por que uma matriz declarada, e não geometria
 *
 * Os testes deste módulo nasceram cada um com a sua própria geografia inventada,
 * e mais de uma vez o que falhou foi a **fixture**, não o código: 1° de
 * longitude a 30 km/h dá 222 minutos e estourava uma janela; um pórtico de
 * portagem colocado "no meio do caminho" ficava 2 km fora da linha reta. Uma
 * matriz escrita à mão elimina a categoria inteira: a distância entre A e B é o
 * número que está na tabela, e a asserção pode ser exata em vez de aproximada.
 *
 * Também é o que torna a suíte independente do provedor externo — não há
 * Haversine, não há Mapbox, não há rede. O mesmo cenário produz o mesmo plano em
 * qualquer máquina, hoje e daqui a um ano.
 */

/** Ids estáveis (UUIDv7-like) — a ordem lexicográfica é a ordem numérica. */
export const STOP = Object.freeze({
  A: '019f3364-0001-7665-bcb4-2cc75f065d01',
  B: '019f3364-0002-7665-bcb4-2cc75f065d02',
  C: '019f3364-0003-7665-bcb4-2cc75f065d03',
  D: '019f3364-0004-7665-bcb4-2cc75f065d04',
});

export const TENANT = 'tenant-regressao';
export const FICHA = 'ficha-maria';
export const OUTRA_FICHA = 'ficha-joao';

/**
 * Quatro pontos numa linha, 1 km entre vizinhos. As coordenadas existem só
 * porque o contrato pede — quem decide as distâncias é [matrizDaLinha].
 */
export const PONTOS: LatLng[] = [
  { latitude: 38.7, longitude: -9.2 },
  { latitude: 38.7, longitude: -9.19 },
  { latitude: 38.7, longitude: -9.18 },
  { latitude: 38.7, longitude: -9.17 },
];

/**
 * Provedor de matriz **gravada**: devolve exatamente a tabela recebida.
 *
 * Registra as chamadas para que os cenários de perfil de veículo (ADR-0108) e de
 * ladrilhamento acima de 25 pontos (ADR-0107) possam afirmar o que foi pedido
 * ao provedor, e não só o que voltou.
 */
export class RecordedRoutingProvider implements RoutingProviderPort {
  readonly calls: { points: number; speedKmh: number; vehicleType?: VehicleType | null }[] = [];

  constructor(
    private readonly matriz: (points: LatLng[]) => RouteMatrix = (p) => matrizDaLinha(p),
  ) {}

  async matrix(
    points: LatLng[],
    speedKmh: number,
    vehicleType?: VehicleType | null,
  ): Promise<RouteMatrix> {
    this.calls.push({ points: points.length, speedKmh, vehicleType });
    const m = this.matriz(points);
    return {
      ...m,
      // O perfil acompanha o veículo pedido, como no provedor real: é isto que
      // permite verificar que uma bicicleta não recebeu rota de carro.
      profile: vehicleType ? resolveRoutingProfile(vehicleType) : m.profile,
    };
  }
}

/**
 * Posição do ponto na linha, derivada da **própria coordenada**.
 *
 * É o detalhe que faz a fixture valer. A primeira versão indexava a matriz pela
 * posição no array recebido, de modo que a ordem enviada era sempre a ótima e
 * nenhum teste de reordenação podia falhar — a fixture concordava com qualquer
 * resposta. Distância é propriedade do ponto, não do argumento.
 */
export function posicaoNaLinha(p: LatLng): number {
  return Math.round((p.longitude + 9.2) * 100);
}

/**
 * Matriz da linha: entre dois pontos, `|posição_i − posição_j| × km` e o mesmo
 * em minutos. Pares em `proibidos` (em posições da linha) não têm rota
 * possível (ADR-0106).
 */
export function matrizDaLinha(
  points: LatLng[],
  { km = 1, min = 2, proibidos = [] as [number, number][] } = {},
): RouteMatrix {
  const pos = points.map(posicaoNaLinha);
  const bloqueado = (a: number, b: number): boolean =>
    proibidos.some(([x, y]) => (x === a && y === b) || (x === b && y === a));

  const distanceKm: number[][] = [];
  const durationMin: number[][] = [];
  for (let i = 0; i < points.length; i++) {
    distanceKm.push([]);
    durationMin.push([]);
    for (let j = 0; j < points.length; j++) {
      const passos = Math.abs(pos[i] - pos[j]);
      const proibido = i !== j && bloqueado(pos[i], pos[j]);
      distanceKm[i].push(proibido ? UNREACHABLE : passos * km);
      durationMin[i].push(proibido ? UNREACHABLE : passos * min);
    }
  }
  return { distanceKm, durationMin, source: 'provider' };
}

/** Linha com um ou mais trechos sem rota, dados em posições da linha. */
export function linhaComTrechoProibido(...proibidos: [number, number][]): RecordedRoutingProvider {
  return new RecordedRoutingProvider((p) => matrizDaLinha(p, { proibidos }));
}

/** Linha em que uma posição está isolada de todas as demais. */
export function linhaComPontoIsolado(posicao: number, total: number): RecordedRoutingProvider {
  const proibidos: [number, number][] = [];
  for (let i = 0; i < total; i++) if (i !== posicao) proibidos.push([posicao, i]);
  return new RecordedRoutingProvider((p) => matrizDaLinha(p, { proibidos }));
}

export interface StopFixture {
  id: string;
  latitude: number;
  longitude: number;
  weightKg?: number;
  volumeM3?: number;
  timeWindow?: { start: string; end: string } | null;
  vehicleId?: string | null;
}

/** As quatro paradas da linha, na ordem A→B→C→D. */
export function paradas(n = 4, over: Partial<StopFixture>[] = []): StopFixture[] {
  const ids = [STOP.A, STOP.B, STOP.C, STOP.D];
  return Array.from({ length: n }, (_, i) => ({
    id:
      ids[i] ??
      `019f3364-${String(i + 1).padStart(4, '0')}-7665-bcb4-2cc75f065d${String(i + 1).padStart(2, '0')}`,
    latitude: 38.7,
    longitude: -9.2 + i * 0.01,
    ...(over[i] ?? {}),
  }));
}

export interface CenarioOpcoes {
  routing?: RoutingProviderPort;
  /** Rota já gravada do motorista, para os cenários de substituição. */
  vigente?: RoutePlan | null;
  capacity?: VehicleCapacityPort;
  augmentation?: CostAugmentationPort;
  /** Sobrescreve o repositório — usado para simular corrida de gravação. */
  plans?: Partial<RoutePlanRepositoryPort>;
  /** Entregas visíveis ao gateway, por id. Ausente: nenhuma (usa `stops`). */
  entregas?: StopFixture[];
}

/**
 * Monta o otimizador **real** — solver, estratégias e caso de uso de verdade —
 * com as bordas trocadas por dublês determinísticos.
 *
 * O que se testa aqui é a composição: um cenário que passa garante que aquele
 * comportamento sobrevive a mudanças em qualquer peça do caminho, o que um teste
 * unitário de uma peça só não garante.
 */
export function montarOtimizador(opts: CenarioOpcoes = {}) {
  const gravados: RoutePlan[] = [];
  const plans: RoutePlanRepositoryPort = {
    save: async (p): Promise<PlanSaveResult> => {
      gravados.push(p);
      return 'saved';
    },
    findById: async () => null,
    findAll: async (): Promise<PagedResult<RoutePlan>> => ({ items: [], total: 0 }),
    findActiveForDriver: async () => null,
    findActiveForDrivers: async () => new Map(),
    findLatestContainingDelivery: async () => null,
    findLatestRequestedForDriver: async () => opts.vigente ?? null,
    ...opts.plans,
  };

  const catalogo = new Map((opts.entregas ?? []).map((e) => [e.id, e]));
  const gateway: DeliveryGatewayPort = {
    // Devolve **invertido** de propósito: é o que um `IN (...)` faz na prática,
    // e é o que revela um caminho que confia na ordem do banco.
    getStops: async (_t, ids) =>
      [...ids]
        .reverse()
        .filter((id) => catalogo.has(id))
        .map((id) => {
          const e = catalogo.get(id)!;
          return {
            id: e.id,
            latitude: e.latitude,
            longitude: e.longitude,
            priority: 'normal' as const,
            timeWindow: e.timeWindow ?? null,
            weightKg: e.weightKg ?? null,
            volumeM3: e.volumeM3 ?? null,
            vehicleId: e.vehicleId ?? null,
          };
        }),
    getRouteStops: async () => [],
    getOwnership: async () => [],
    listActiveStops: async () => [],
  };

  const metrics = {
    observeSolve: jest.fn(),
    markInfeasible: jest.fn(),
    observePlanOutcome: jest.fn(),
    observePlanWrite: jest.fn(),
  } as unknown as OptimizerMetrics;

  const solver = new RouteSolver(
    opts.routing ?? new RecordedRoutingProvider(),
    opts.augmentation ?? { augment: () => ({}) },
    new StrategyRegistry([
      new NearestNeighbor2OptStrategy(),
      new OrOpt2OptStrategy(),
      new ManualStrategy(),
    ]),
  );

  const audit: AuditLogPort = { record: async () => undefined };
  const bus = new DomainEventBus();
  const uc = new OptimizeRouteUseCase(
    plans,
    gateway,
    opts.capacity ?? { capacityOf: async () => null },
    audit,
    { typicalServiceMinutes: async (_t: string, pts: unknown[]) => pts.map(() => null) },
    solver,
    metrics,
    bus,
    { optimizer: { weightOverrides: {} } } as unknown as AppConfigService,
  );

  return { uc, gravados, metrics, bus };
}

/** Comando padrão da rota de um motorista — o caso que mais regride. */
export function comandoDoMotorista(over: Record<string, unknown> = {}) {
  return {
    tenantId: TENANT,
    actorId: 'user-1',
    driverId: FICHA,
    driverScoped: true,
    stops: paradas(),
    ...over,
  };
}
