import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { DomainExceptionFilter } from '../src/shared/interface/domain-exception.filter';
import { JwtAuthGuard } from '../src/shared/security/jwt-auth.guard';
import { RolesGuard } from '../src/shared/security/roles.guard';
import { ForecastRouteUseCase } from '../src/modules/intelligence/application/forecast-route.use-case';
import { GetCollectiveInsightUseCase } from '../src/modules/intelligence/application/get-collective-insight.use-case';
import { PlanLoadUseCase } from '../src/modules/intelligence/application/plan-load.use-case';
import { RecordObservationUseCase } from '../src/modules/intelligence/application/record-observation.use-case';
import { ACCESS_INSTRUCTIONS } from '../src/modules/intelligence/domain/access-instructions.port';
import { COLLECTIVE_INSIGHTS } from '../src/modules/intelligence/domain/collective-insights.port';
import { DRIVER_PROFILE_SOURCE } from '../src/modules/intelligence/domain/driver-profile-source.port';
import { LOAD_PLANNER } from '../src/modules/intelligence/domain/load-planner.port';
import { PARKING_PREDICTOR } from '../src/modules/intelligence/domain/parking-predictor.port';
import { TRAFFIC_MODEL, TimeContextTrafficModel } from '../src/modules/intelligence/domain/traffic-model';
import { HeuristicAccessInstructions } from '../src/modules/intelligence/infrastructure/heuristic-access-instructions';
import { HeuristicLoadPlanner } from '../src/modules/intelligence/infrastructure/heuristic-load-planner';
import { HeuristicParkingPredictor } from '../src/modules/intelligence/infrastructure/heuristic-parking-predictor';
import { InMemoryCollectiveInsights } from '../src/modules/intelligence/infrastructure/in-memory-collective-insights';
import { NoHistoryDriverProfileSource } from '../src/modules/intelligence/infrastructure/no-history-driver-profile.source';
import { IntelligenceController } from '../src/modules/intelligence/interface/intelligence.controller';

const TENANT = '019f335f-a2ae-7dd9-bcda-d458fe138c98';

describe('Intelligence (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [IntelligenceController],
      providers: [
        ForecastRouteUseCase,
        PlanLoadUseCase,
        RecordObservationUseCase,
        GetCollectiveInsightUseCase,
        { provide: TRAFFIC_MODEL, useClass: TimeContextTrafficModel },
        { provide: DRIVER_PROFILE_SOURCE, useClass: NoHistoryDriverProfileSource },
        { provide: ACCESS_INSTRUCTIONS, useClass: HeuristicAccessInstructions },
        { provide: PARKING_PREDICTOR, useClass: HeuristicParkingPredictor },
        { provide: LOAD_PLANNER, useClass: HeuristicLoadPlanner },
        { provide: COLLECTIVE_INSIGHTS, useClass: InMemoryCollectiveInsights },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (ctx: { switchToHttp: () => { getRequest: () => { user: unknown } } }) => {
          ctx.switchToHttp().getRequest().user = { id: 'u1', tenantId: TENANT, roles: ['driver'] };
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

  it('POST /api/v1/intelligence/route-forecast retorna o relatório', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/intelligence/route-forecast')
      .send({
        vehicleType: 'van',
        currentFuelPercent: 30,
        earliestDeparture: '2026-07-14T08:00:00.000Z',
        stops: [
          { id: 'a', latitude: -23.55, longitude: -46.63 },
          {
            id: 'b',
            latitude: -23.6,
            longitude: -46.65,
            timeWindow: { start: '2026-07-14T08:00:00.000Z', end: '2026-07-14T08:10:00.000Z' },
          },
        ],
      })
      .expect(201);

    expect(res.body.data.schedule.stops).toHaveLength(2);
    expect(res.body.data.fuel.vehicleType).toBe('van');
    expect(res.body.data.departure.recommendedDepartureAt).toEqual(expect.any(String));
    expect(res.body.data.traffic.window).toEqual(expect.any(String));
  });

  it('rejeita payload sem paradas (400)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/intelligence/route-forecast')
      .send({ stops: [] })
      .expect(400);
  });

  it('POST /api/v1/intelligence/load-plan retorna o plano de carga (LIFO)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/intelligence/load-plan')
      .send({
        vehicleType: 'van',
        items: [
          { id: 'a', sequence: 1, weightKg: 100, volumeM3: 1 },
          { id: 'b', sequence: 2, weightKg: 200, volumeM3: 2, fragile: true },
        ],
      })
      .expect(201);

    expect(res.body.data.placements.map((p: { id: string }) => p.id)).toEqual(['b', 'a']);
    expect(res.body.data.totalWeightKg).toBe(300);
    expect(res.body.data.capacityKg).toBe(1200);
    expect(res.body.data.overCapacity).toBe(false);
  });

  it('rejeita plano de carga sem itens (400)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/intelligence/load-plan')
      .send({ items: [] })
      .expect(400);
  });

  it('inteligência coletiva: registra observações e agrega o insight', async () => {
    const point = { latitude: -23.55, longitude: -46.63 };
    for (const difficulty of ['hard', 'hard', 'moderate']) {
      await request(app.getHttpServer())
        .post('/api/v1/intelligence/observations')
        .send({ ...point, kind: 'parking', parkingDifficulty: difficulty })
        .expect(201);
    }

    const res = await request(app.getHttpServer())
      .get('/api/v1/intelligence/insights')
      .query(point)
      .expect(200);

    expect(res.body.data.sampleSize).toBe(3);
    expect(res.body.data.parking.difficulty).toBe('hard');
    expect(res.body.data.cell).toBe('-23.550,-46.630');
  });

  it('rejeita observação de estacionamento sem dificuldade (400)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/intelligence/observations')
      .send({ latitude: 0, longitude: 0, kind: 'parking' })
      .expect(400);
  });
});
