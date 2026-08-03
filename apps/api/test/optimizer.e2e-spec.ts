import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AUDIT_LOG } from '../src/shared/audit/audit-log.port';
import { DomainEventBus } from '../src/shared/events/domain-event-bus';
import { DomainExceptionFilter } from '../src/shared/interface/domain-exception.filter';
import { JwtAuthGuard } from '../src/shared/security/jwt-auth.guard';
import { RolesGuard } from '../src/shared/security/roles.guard';
import { FeatureAccessService } from '../src/shared/tenancy/feature-access.service';
import { EnqueueOptimizationUseCase } from '../src/modules/optimizer/application/enqueue-optimization.use-case';
import { GetOptimizationJobUseCase } from '../src/modules/optimizer/application/get-optimization-job.use-case';
import { GetRoutePlanUseCase } from '../src/modules/optimizer/application/get-route-plan.use-case';
import { ListRoutePlansUseCase } from '../src/modules/optimizer/application/list-route-plans.use-case';
import { OptimizeRouteUseCase } from '../src/modules/optimizer/application/optimize-route.use-case';
import { ProcessOptimizationJobUseCase } from '../src/modules/optimizer/application/process-optimization-job.use-case';
import { StrategyRegistry } from '../src/modules/optimizer/application/strategy-registry';
import { DELIVERY_GATEWAY } from '../src/modules/optimizer/application/ports/delivery-gateway.port';
import { SERVICE_TIME_HISTORY } from '../src/modules/optimizer/application/ports/service-time-history.port';
import { DISTANCE_PROVIDER } from '../src/modules/optimizer/domain/ports/distance-provider.port';
import { JOB_EVENTS } from '../src/modules/optimizer/domain/ports/job-events.port';
import { OPTIMIZATION_JOB_QUEUE } from '../src/modules/optimizer/domain/ports/optimization-job-queue.port';
import {
  OPTIMIZATION_JOB_REPOSITORY,
  type OptimizationJobRecord,
  type OptimizationJobRepositoryPort,
  type OptimizationJobUpdate,
} from '../src/modules/optimizer/domain/ports/optimization-job-repository.port';
import { COST_AUGMENTATION } from '../src/modules/optimizer/domain/ports/cost-augmentation.port';
import { OPTIMIZATION_STRATEGIES } from '../src/modules/optimizer/domain/ports/route-optimization-strategy.port';
import { ROUTING_PROVIDER } from '../src/modules/optimizer/domain/ports/routing-provider.port';
import { HaversineRoutingProvider } from '../src/modules/optimizer/infrastructure/routing/haversine-routing.provider';
import { ROUTE_PLAN_REPOSITORY } from '../src/modules/optimizer/domain/ports/route-plan-repository.port';
import type { RoutePlanRepositoryPort } from '../src/modules/optimizer/domain/ports/route-plan-repository.port';
import type { RoutePlan } from '../src/modules/optimizer/domain/route-plan';
import { DistributeDeliveriesUseCase } from '../src/modules/optimizer/application/distribute-deliveries.use-case';
import { GetFleetDistributionUseCase } from '../src/modules/optimizer/application/get-fleet-distribution.use-case';
import { ReoptimizeActiveUseCase } from '../src/modules/optimizer/application/reoptimize-active.use-case';
import { RouteSolver } from '../src/modules/optimizer/application/route-solver';
import { HaversineDistanceProvider } from '../src/modules/optimizer/infrastructure/distance/haversine-distance.provider';
import { OptimizerMetrics } from '../src/modules/optimizer/infrastructure/observability/optimizer-metrics';
import { NearestNeighbor2OptStrategy } from '../src/modules/optimizer/infrastructure/strategies/nearest-neighbor-2opt.strategy';
import { OrOpt2OptStrategy } from '../src/modules/optimizer/infrastructure/strategies/or-opt-2opt.strategy';
import { GetActiveRoutePlanUseCase } from '../src/modules/optimizer/application/get-active-route-plan.use-case';
import { DRIVER_ROSTER_LINK } from '../src/modules/optimizer/application/ports/driver-roster-link.port';
import { OptimizerController } from '../src/modules/optimizer/interface/optimizer.controller';

class InMemoryRoutePlanRepository implements RoutePlanRepositoryPort {
  private readonly store = new Map<string, RoutePlan>();
  async save(plan: RoutePlan): Promise<void> {
    this.store.set(plan.id, plan);
  }
  async findById(tenantId: string, id: string): Promise<RoutePlan | null> {
    const p = this.store.get(id);
    return p && p.snapshot().tenantId === tenantId ? p : null;
  }
  async findAll(tenantId: string, page: { page: number; pageSize: number }) {
    const items = [...this.store.values()].filter((p) => p.snapshot().tenantId === tenantId);
    return {
      items: items.slice((page.page - 1) * page.pageSize, page.page * page.pageSize),
      total: items.length,
    };
  }
  /** Espelha o repositório real: mais recente do motorista no dia (ADR-0098). */
  async findActiveForDriver(
    tenantId: string,
    driverId: string | null,
    operationalDay: string,
  ): Promise<RoutePlan | null> {
    const matches = [...this.store.values()]
      .map((p) => p.snapshot())
      .filter(
        (s) =>
          s.tenantId === tenantId && s.driverId === driverId && s.operationalDay === operationalDay,
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return matches.length > 0 ? (this.store.get(matches[0].id) ?? null) : null;
  }

  async findActiveForDrivers(
    tenantId: string,
    driverIds: string[],
    operationalDay: string,
  ): Promise<Map<string, RoutePlan>> {
    const porFicha = new Map<string, RoutePlan>();
    for (const driverId of driverIds) {
      const plano = await this.findActiveForDriver(tenantId, driverId, operationalDay);
      if (plano) porFicha.set(driverId, plano);
    }
    return porFicha;
  }
}

class InMemoryJobRepository implements OptimizationJobRepositoryPort {
  private readonly store = new Map<string, OptimizationJobRecord>();
  async create(record: Omit<OptimizationJobRecord, 'createdAt' | 'updatedAt'>): Promise<void> {
    this.store.set(record.id, { ...record, createdAt: new Date(), updatedAt: new Date() });
  }
  async findById(tenantId: string, id: string): Promise<OptimizationJobRecord | null> {
    const j = this.store.get(id);
    return j && j.tenantId === tenantId ? { ...j } : null;
  }
  async update(id: string, patch: OptimizationJobUpdate): Promise<void> {
    const j = this.store.get(id);
    if (j) this.store.set(id, { ...j, ...patch, updatedAt: new Date() });
  }
  async claim(id: string): Promise<boolean> {
    const j = this.store.get(id);
    if (!j || j.status !== 'queued') return false;
    this.store.set(id, { ...j, status: 'running', updatedAt: new Date() });
    return true;
  }
  async resetForRetry(id: string): Promise<boolean> {
    const j = this.store.get(id);
    if (!j || j.status !== 'running') return false;
    this.store.set(id, { ...j, status: 'queued', updatedAt: new Date() });
    return true;
  }
}

const TENANT = '019f335f-a2ae-7dd9-bcda-d458fe138c98';

const stops = [
  { id: '019f3364-0001-7665-bcb4-2cc75f065d01', latitude: 0, longitude: 0 },
  { id: '019f3364-0002-7665-bcb4-2cc75f065d02', latitude: 10, longitude: 10 },
  { id: '019f3364-0003-7665-bcb4-2cc75f065d03', latitude: 10, longitude: 0 },
  { id: '019f3364-0004-7665-bcb4-2cc75f065d04', latitude: 0, longitude: 10 },
];

/**
 * Dois motoristas na **mesma** frota (NAV-4.2 / ADR-0099). `driver-e2e` é a
 * ficha que o `DRIVER_ROSTER_LINK` do teste devolve para quem está autenticado.
 */
const DONOS: Record<string, string | null> = {
  '019f3364-0001-7665-bcb4-2cc75f065d01': 'driver-e2e',
  '019f3364-0002-7665-bcb4-2cc75f065d02': 'driver-e2e',
  '019f3364-0003-7665-bcb4-2cc75f065d03': 'ficha-do-colega',
  '019f3364-0004-7665-bcb4-2cc75f065d04': 'ficha-do-colega',
};

const MINHAS = stops.slice(0, 2).map((s) => s.id);
const DO_COLEGA = stops.slice(2).map((s) => s.id);
/** Id que o tenant não enxerga — é o que a RLS faz com dado de outro tenant. */
const DE_OUTRO_TENANT = '019f3364-9999-7665-bcb4-2cc75f065d99';

async function pollJob(app: INestApplication, jobId: string) {
  for (let i = 0; i < 30; i++) {
    const r = await request(app.getHttpServer())
      .get(`/api/v1/route-plans/jobs/${jobId}`)
      .expect(200);
    if (r.body.data.status === 'succeeded' || r.body.data.status === 'failed') return r.body.data;
    await new Promise((res) => setTimeout(res, 20));
  }
  throw new Error('job não concluiu a tempo');
}

describe('Optimizer (e2e, assíncrono)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [OptimizerController],
      providers: [
        OptimizeRouteUseCase,
        EnqueueOptimizationUseCase,
        ProcessOptimizationJobUseCase,
        GetOptimizationJobUseCase,
        GetRoutePlanUseCase,
        ListRoutePlansUseCase,
        ReoptimizeActiveUseCase,
        GetActiveRoutePlanUseCase,
        // Ficha do motorista (ADR-0098). Fixa: o e2e do otimizador não exercita
        // o Fleet, só precisa que a tradução exista e seja determinística.
        {
          provide: DRIVER_ROSTER_LINK,
          useValue: { driverIdForUser: async () => 'driver-e2e', activeDriverIds: async () => [] },
        },
        // A distribuição (ADR-0101) é exercitada em unidade e ao vivo; aqui só
        // precisa existir para o controller resolver, sem arrastar o Delivery.
        {
          provide: DistributeDeliveriesUseCase,
          useValue: { execute: async () => ({ assigned: 0, unassigned: 0, shares: [] }) },
        },
        {
          provide: GetFleetDistributionUseCase,
          useValue: { execute: async () => ({ drivers: [], unassigned: 0 }) },
        },
        DomainEventBus,
        {
          provide: FeatureAccessService,
          useValue: {
            isEnabled: async () => true,
            require: async () => undefined,
          },
        },
        StrategyRegistry,
        RouteSolver,
        NearestNeighbor2OptStrategy,
        OrOpt2OptStrategy,
        {
          provide: OPTIMIZATION_STRATEGIES,
          useFactory: (nn: NearestNeighbor2OptStrategy, orOpt: OrOpt2OptStrategy) => [nn, orOpt],
          inject: [NearestNeighbor2OptStrategy, OrOpt2OptStrategy],
        },
        { provide: DISTANCE_PROVIDER, useClass: HaversineDistanceProvider },
        { provide: ROUTING_PROVIDER, useClass: HaversineRoutingProvider },
        { provide: COST_AUGMENTATION, useValue: { augment: () => ({}) } },
        // Sem histórico de tempo de serviço no e2e (todos os pontos = null).
        {
          provide: SERVICE_TIME_HISTORY,
          useValue: {
            typicalServiceMinutes: async (_t: string, pts: unknown[]) => pts.map(() => null),
          },
        },
        { provide: ROUTE_PLAN_REPOSITORY, useClass: InMemoryRoutePlanRepository },
        { provide: OPTIMIZATION_JOB_REPOSITORY, useClass: InMemoryJobRepository },
        // Fila imediata: processa em microtask (sem DataSource), suficiente p/ e2e.
        {
          provide: OPTIMIZATION_JOB_QUEUE,
          useFactory: (processor: ProcessOptimizationJobUseCase) => ({
            enqueue: (jobId: string, tenantId: string) => {
              void processor.execute(tenantId, jobId);
            },
          }),
          inject: [ProcessOptimizationJobUseCase],
        },
        { provide: JOB_EVENTS, useValue: { optimizationJobUpdated: () => undefined } },
        {
          provide: DELIVERY_GATEWAY,
          useValue: {
            getStops: async (_tenantId: string, ids: string[]) =>
              stops
                .filter((s) => ids.includes(s.id))
                .map((s) => ({ ...s, priority: 'normal', timeWindow: null })),
            // Reotimização: devolve as 4 paradas ativas do tenant.
            listActiveStops: async () =>
              stops.map((s) => ({ ...s, priority: 'normal', timeWindow: null })),
            // Só o que o tenant enxerga: id de fora simplesmente não volta.
            getOwnership: async (_tenantId: string, ids: string[]) =>
              ids.filter((id) => id in DONOS).map((id) => ({ id, driverId: DONOS[id] })),
          },
        },
        { provide: AUDIT_LOG, useValue: { record: async () => undefined } },
        DomainEventBus,
        {
          provide: OptimizerMetrics,
          useValue: { observeSolve: () => undefined, markInfeasible: () => undefined },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (ctx: { switchToHttp: () => { getRequest: () => { user: unknown } } }) => {
          ctx.switchToHttp().getRequest().user = {
            id: '019f335f-a2de-7dd9-bcda-d97de1d9ca11',
            tenantId: TENANT,
            email: 'admin@navix.test',
            roles: ['admin', 'dispatcher'],
          };
          return true;
        },
      })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.useGlobalFilters(new DomainExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  let planId: string;

  it('POST /api/v1/route-plans enfileira (202) e o job conclui com um plano', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/route-plans')
      .send({ stops })
      .expect(202);
    expect(res.body.data.status).toBe('queued');
    expect(res.body.data.jobId).toEqual(expect.any(String));

    const job = await pollJob(app, res.body.data.jobId);
    expect(job.status).toBe('succeeded');
    planId = job.routePlanId;

    const plan = await request(app.getHttpServer())
      .get(`/api/v1/route-plans/${planId}`)
      .expect(200);
    expect(plan.body.data.metrics.stops).toBe(4);
    expect(plan.body.data.stops).toHaveLength(4);
    expect(plan.body.data.metrics.totalDistanceKm).toBeLessThanOrEqual(
      plan.body.data.baseline.totalDistanceKm + 1e-6,
    );
  });

  it('GET /api/v1/route-plans/:id retorna o plano', async () => {
    const res = await request(app.getHttpServer()).get(`/api/v1/route-plans/${planId}`).expect(200);
    expect(res.body.data.id).toBe(planId);
  });

  it('menos de 2 paradas: rejeitado na borda (400), sem enfileirar', async () => {
    // Validação estrutural do DTO (@ArrayMinSize) continua síncrona — só o solver
    // é assíncrono. Entrada obviamente inválida não vira job.
    await request(app.getHttpServer())
      .post('/api/v1/route-plans')
      .send({ stops: [stops[0]] })
      .expect(400);
  });

  it('veículo + peso: plano reporta capacidade excedida (ADR-0022)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/route-plans')
      .send({
        vehicle: { type: 'motorcycle' }, // capacidade 30 kg
        stops: [
          { ...stops[0], weightKg: 20 },
          { ...stops[1], weightKg: 20 },
        ],
      })
      .expect(202);

    const job = await pollJob(app, res.body.data.jobId);
    expect(job.status).toBe('succeeded');

    const plan = await request(app.getHttpServer())
      .get(`/api/v1/route-plans/${job.routePlanId}`)
      .expect(200);
    expect(plan.body.data.params.vehicleType).toBe('motorcycle');
    expect(plan.body.data.metrics.totalWeightKg).toBe(40);
    expect(plan.body.data.capacity.feasible).toBe(false);
    expect(plan.body.data.capacity.overWeightKg).toBe(10);
  });

  it('frota multi-veículo: plano com routes[] por veículo (ADR-0022 Fase 2)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/route-plans')
      .send({ vehicles: [{ type: 'van' }, { type: 'van' }], stops })
      .expect(202);

    const job = await pollJob(app, res.body.data.jobId);
    expect(job.status).toBe('succeeded');

    const plan = await request(app.getHttpServer())
      .get(`/api/v1/route-plans/${job.routePlanId}`)
      .expect(200);
    expect(plan.body.data.params.vehicleCount).toBe(2);
    expect(plan.body.data.routes).toHaveLength(2);
    const total = plan.body.data.routes.reduce(
      (n: number, r: { stops: unknown[] }) => n + r.stops.length,
      0,
    );
    expect(total).toBe(4);
    expect(plan.body.data.stops).toHaveLength(4);
  });

  it('POST /route-plans/reoptimize enfileira a reotimização das ativas (ADR-0023)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/route-plans/reoptimize')
      .expect(202);
    expect(res.body.data.jobId).toEqual(expect.any(String));

    const job = await pollJob(app, res.body.data.jobId);
    expect(job.status).toBe('succeeded');
  });

  it('estratégia metaheurística or-opt-2opt otimiza e persiste (ADR-0024)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/route-plans')
      .send({ stops, strategy: 'or-opt-2opt' })
      .expect(202);

    const job = await pollJob(app, res.body.data.jobId);
    expect(job.status).toBe('succeeded');

    const plan = await request(app.getHttpServer())
      .get(`/api/v1/route-plans/${job.routePlanId}`)
      .expect(200);
    expect(plan.body.data.strategy).toBe('or-opt-2opt');
    expect(plan.body.data.metrics.totalDistanceKm).toBeLessThanOrEqual(
      plan.body.data.baseline.totalDistanceKm + 1e-6,
    );
  });

  // NAV-4.1 / ADR-0098: a rota do motorista sai carimbada com a ficha e com o
  // dia, e `mine/active` devolve **essa** — não o plano mais recente do tenant.
  it('POST /route-plans/mine carimba a ficha e GET mine/active devolve só a dele', async () => {
    const antes = await request(app.getHttpServer())
      .post('/api/v1/route-plans/mine')
      .send({ stops })
      .expect(202);
    const job = await pollJob(app, antes.body.data.jobId);
    expect(job.status).toBe('succeeded');

    const plano = await request(app.getHttpServer())
      .get(`/api/v1/route-plans/${job.routePlanId}`)
      .expect(200);
    expect(plano.body.data.driverId).toBe('driver-e2e');
    expect(plano.body.data.operationalDay).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    // Um plano do despacho, criado DEPOIS: sob a regra antiga ("o mais recente
    // do tenant"), seria ele que voltaria para o motorista.
    const doDespacho = await request(app.getHttpServer())
      .post('/api/v1/route-plans')
      .send({ stops })
      .expect(202);
    await pollJob(app, doDespacho.body.data.jobId);

    const ativa = await request(app.getHttpServer())
      .get('/api/v1/route-plans/mine/active')
      .expect(200);
    expect(ativa.body.data.id).toBe(job.routePlanId);
    expect(ativa.body.data.driverId).toBe('driver-e2e');
  });

  // NAV-4.2 / ADR-0099: o motorista só otimiza o que é dele, e a recusa chega
  // como status HTTP — não como 202 seguido de um job que falha.
  describe('restrição do /route-plans/mine ao motorista (ADR-0099)', () => {
    it('otimiza as próprias entregas (202)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/route-plans/mine')
        .send({ deliveryIds: MINHAS })
        .expect(202);

      const job = await pollJob(app, res.body.data.jobId);
      expect(job.status).toBe('succeeded');
    });

    it('entrega de outro motorista do mesmo tenant: 403', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/route-plans/mine')
        .send({ deliveryIds: DO_COLEGA })
        .expect(403);
    });

    it('uma entrega alheia no meio das próprias já recusa o pedido inteiro', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/route-plans/mine')
        .send({ deliveryIds: [MINHAS[0], DO_COLEGA[0]] })
        .expect(403);
    });

    // Id de outro tenant não é distinguível de inexistente, e não deve ser: a
    // resposta não confirma que existe dado em outra organização.
    it('id de outro tenant: 404, sem confirmar existência', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/route-plans/mine')
        .send({ deliveryIds: [MINHAS[0], DE_OUTRO_TENANT] })
        .expect(404);

      expect(JSON.stringify(res.body)).not.toContain('outro');
    });

    // O despacho roteiriza a frota por definição do papel — a restrição é do
    // caminho `/mine`, não do otimizador.
    it('o despacho segue otimizando as entregas de qualquer motorista', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/route-plans')
        .send({ deliveryIds: [...MINHAS, ...DO_COLEGA] })
        .expect(202);

      const job = await pollJob(app, res.body.data.jobId);
      expect(job.status).toBe('succeeded');
    });
  });
});
