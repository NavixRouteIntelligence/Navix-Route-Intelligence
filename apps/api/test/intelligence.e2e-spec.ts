import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { DomainExceptionFilter } from '../src/shared/interface/domain-exception.filter';
import { JwtAuthGuard } from '../src/shared/security/jwt-auth.guard';
import { RolesGuard } from '../src/shared/security/roles.guard';
import { ForecastRouteUseCase } from '../src/modules/intelligence/application/forecast-route.use-case';
import { ACCESS_INSTRUCTIONS } from '../src/modules/intelligence/domain/access-instructions.port';
import { DRIVER_PROFILE_SOURCE } from '../src/modules/intelligence/domain/driver-profile-source.port';
import { PARKING_PREDICTOR } from '../src/modules/intelligence/domain/parking-predictor.port';
import { TRAFFIC_MODEL, TimeContextTrafficModel } from '../src/modules/intelligence/domain/traffic-model';
import { HeuristicAccessInstructions } from '../src/modules/intelligence/infrastructure/heuristic-access-instructions';
import { HeuristicParkingPredictor } from '../src/modules/intelligence/infrastructure/heuristic-parking-predictor';
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
        { provide: TRAFFIC_MODEL, useClass: TimeContextTrafficModel },
        { provide: DRIVER_PROFILE_SOURCE, useClass: NoHistoryDriverProfileSource },
        { provide: ACCESS_INSTRUCTIONS, useClass: HeuristicAccessInstructions },
        { provide: PARKING_PREDICTOR, useClass: HeuristicParkingPredictor },
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
});
