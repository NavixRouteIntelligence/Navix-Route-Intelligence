import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AUDIT_LOG } from '../src/shared/audit/audit-log.port';
import { DomainExceptionFilter } from '../src/shared/interface/domain-exception.filter';
import { JwtAuthGuard } from '../src/shared/security/jwt-auth.guard';
import { RolesGuard } from '../src/shared/security/roles.guard';
import { GetRoutePlanUseCase } from '../src/modules/optimizer/application/get-route-plan.use-case';
import { ListRoutePlansUseCase } from '../src/modules/optimizer/application/list-route-plans.use-case';
import { OptimizeRouteUseCase } from '../src/modules/optimizer/application/optimize-route.use-case';
import { StrategyRegistry } from '../src/modules/optimizer/application/strategy-registry';
import { DELIVERY_GATEWAY } from '../src/modules/optimizer/application/ports/delivery-gateway.port';
import { DISTANCE_PROVIDER } from '../src/modules/optimizer/domain/ports/distance-provider.port';
import { OPTIMIZATION_STRATEGIES } from '../src/modules/optimizer/domain/ports/route-optimization-strategy.port';
import { ROUTE_PLAN_REPOSITORY } from '../src/modules/optimizer/domain/ports/route-plan-repository.port';
import type { RoutePlanRepositoryPort } from '../src/modules/optimizer/domain/ports/route-plan-repository.port';
import type { RoutePlan } from '../src/modules/optimizer/domain/route-plan';
import { HaversineDistanceProvider } from '../src/modules/optimizer/infrastructure/distance/haversine-distance.provider';
import { NearestNeighbor2OptStrategy } from '../src/modules/optimizer/infrastructure/strategies/nearest-neighbor-2opt.strategy';
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
    return { items: items.slice((page.page - 1) * page.pageSize, page.page * page.pageSize), total: items.length };
  }
}

const TENANT = '019f335f-a2ae-7dd9-bcda-d458fe138c98';

const stops = [
  { id: '019f3364-0001-7665-bcb4-2cc75f065d01', latitude: 0, longitude: 0 },
  { id: '019f3364-0002-7665-bcb4-2cc75f065d02', latitude: 10, longitude: 10 },
  { id: '019f3364-0003-7665-bcb4-2cc75f065d03', latitude: 10, longitude: 0 },
  { id: '019f3364-0004-7665-bcb4-2cc75f065d04', latitude: 0, longitude: 10 },
];

describe('Optimizer (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [OptimizerController],
      providers: [
        OptimizeRouteUseCase,
        GetRoutePlanUseCase,
        ListRoutePlansUseCase,
        StrategyRegistry,
        NearestNeighbor2OptStrategy,
        {
          provide: OPTIMIZATION_STRATEGIES,
          useFactory: (nn: NearestNeighbor2OptStrategy) => [nn],
          inject: [NearestNeighbor2OptStrategy],
        },
        { provide: DISTANCE_PROVIDER, useClass: HaversineDistanceProvider },
        { provide: ROUTE_PLAN_REPOSITORY, useClass: InMemoryRoutePlanRepository },
        { provide: DELIVERY_GATEWAY, useValue: { getStops: async () => [] } },
        { provide: AUDIT_LOG, useValue: { record: async () => undefined } },
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

  it('POST /api/v1/route-plans otimiza e persiste (201)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/route-plans')
      .send({ stops })
      .expect(201);
    expect(res.body.data.metrics.stops).toBe(4);
    expect(res.body.data.stops).toHaveLength(4);
    expect(res.body.data.score).toBeGreaterThanOrEqual(0);
    expect(res.body.data.score).toBeLessThanOrEqual(100);
    // otimizada não deve ser pior que a ordem original
    expect(res.body.data.metrics.totalDistanceKm).toBeLessThanOrEqual(
      res.body.data.baseline.totalDistanceKm + 1e-6,
    );
    planId = res.body.data.id;
  });

  it('GET /api/v1/route-plans/:id retorna o plano', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/route-plans/${planId}`)
      .expect(200);
    expect(res.body.data.id).toBe(planId);
  });

  it('rejeita menos de 2 paradas (400)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/route-plans')
      .send({ stops: [stops[0]] })
      .expect(400);
  });
});
