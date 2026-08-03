import type { DeliveryLookupPort } from '../../delivery/application/delivery-lookup.service';
import type { RoutePlanRepositoryPort } from '../domain/ports/route-plan-repository.port';
import { RoutePlan, type NewRoutePlan } from '../domain/route-plan';

import { GetFleetDistributionUseCase } from './get-fleet-distribution.use-case';
import type { DriverRosterLinkPort } from './ports/driver-roster-link.port';

const TENANT = 'tenant-1';
const HOJE = new Date('2026-08-03T12:00:00Z');

function plano(driverId: string, paradas: number, km: number): RoutePlan {
  const base: NewRoutePlan = {
    tenantId: TENANT,
    driverId,
    driverScoped: true,

    strategy: 'nearest-neighbor-2opt',
    status: 'completed',
    params: { averageSpeedKmh: 30, serviceTimeMinutes: 5, hasOrigin: false },
    stops: Array.from({ length: paradas }, (_, i) => ({
      sequence: i + 1,
      deliveryId: `d-${i}`,
      latitude: -23.5,
      longitude: -46.6,
      priority: 'normal' as const,
      legDistanceKm: 1,
      cumulativeDistanceKm: i + 1,
      etaMinutes: i * 10,
      timeWindowRespected: null,
    })),
    metrics: { totalDistanceKm: km, totalTimeMinutes: 60, stops: paradas },
    baseline: { totalDistanceKm: km, totalTimeMinutes: 60, stops: paradas },
    savings: { distanceKm: 0, distancePct: 0, timeMinutes: 0, timePct: 0 },
    score: 80,
    explanation: 'ok',
  };
  return RoutePlan.create(base);
}

function build(opts: {
  carga?: { driverId: string | null; pending: number; inRoute: number }[];
  fichas?: { id: string; name: string }[];
  rotas?: Map<string, RoutePlan>;
}) {
  const countActiveByDriver = jest.fn().mockResolvedValue(opts.carga ?? []);
  const deliveries = { countActiveByDriver } as unknown as DeliveryLookupPort;

  const activeDrivers = jest
    .fn()
    .mockResolvedValue(opts.fichas ?? [{ id: 'ficha-a', name: 'Ana' }]);
  const roster = { activeDrivers } as unknown as DriverRosterLinkPort;

  const findActiveForDrivers = jest.fn().mockResolvedValue(opts.rotas ?? new Map());
  const plans = { findActiveForDrivers } as unknown as RoutePlanRepositoryPort;

  return {
    useCase: new GetFleetDistributionUseCase(deliveries, roster, plans),
    findActiveForDrivers,
    countActiveByDriver,
  };
}

describe('GetFleetDistributionUseCase (ADR-0101)', () => {
  it('junta carga e rota de cada motorista', async () => {
    const { useCase } = build({
      fichas: [
        { id: 'ficha-a', name: 'Ana' },
        { id: 'ficha-b', name: 'Bruno' },
      ],
      carga: [
        { driverId: 'ficha-a', pending: 3, inRoute: 2 },
        { driverId: 'ficha-b', pending: 1, inRoute: 0 },
      ],
      rotas: new Map([['ficha-a', plano('ficha-a', 5, 23.4)]]),
    });

    const { drivers } = await useCase.execute(TENANT, HOJE);

    expect(drivers[0]).toEqual({
      driverId: 'ficha-a',
      driverName: 'Ana',
      pending: 3,
      inRoute: 2,
      routePlanId: expect.any(String),
      stops: 5,
      distanceKm: 23.4,
    });
    // Bruno tem carga mas ainda não tem rota do dia — `null`, não zero.
    expect(drivers[1]).toMatchObject({
      driverName: 'Bruno',
      pending: 1,
      routePlanId: null,
      stops: null,
      distanceKm: null,
    });
  });

  it('lista o motorista ocioso — que é justamente quem o painel precisa mostrar', async () => {
    const { useCase } = build({
      fichas: [
        { id: 'ficha-a', name: 'Ana' },
        { id: 'ficha-ociosa', name: 'Carla' },
      ],
      carga: [{ driverId: 'ficha-a', pending: 4, inRoute: 0 }],
    });

    const { drivers } = await useCase.execute(TENANT, HOJE);

    expect(drivers).toHaveLength(2);
    expect(drivers[1]).toMatchObject({ driverName: 'Carla', pending: 0, inRoute: 0 });
  });

  it('soma o balde sem dono como `unassigned`, e ele não vira um motorista', async () => {
    const { useCase } = build({
      fichas: [{ id: 'ficha-a', name: 'Ana' }],
      carga: [
        { driverId: null, pending: 5, inRoute: 2 },
        { driverId: 'ficha-a', pending: 1, inRoute: 0 },
      ],
    });

    const { drivers, unassigned } = await useCase.execute(TENANT, HOJE);

    expect(unassigned).toBe(7);
    expect(drivers).toHaveLength(1);
    expect(drivers.map((d) => d.driverId)).not.toContain(null);
  });

  it('frota vazia devolve lista vazia, não erro', async () => {
    const { useCase } = build({ fichas: [], carga: [{ driverId: null, pending: 3, inRoute: 0 }] });

    const resultado = await useCase.execute(TENANT, HOJE);

    expect(resultado).toEqual({ drivers: [], unassigned: 3 });
  });

  it('sem entrega alguma, todo mundo aparece zerado', async () => {
    const { useCase } = build({ fichas: [{ id: 'ficha-a', name: 'Ana' }], carga: [] });

    const { drivers, unassigned } = await useCase.execute(TENANT, HOJE);

    expect(unassigned).toBe(0);
    expect(drivers[0]).toMatchObject({ pending: 0, inRoute: 0, routePlanId: null });
  });

  it('busca as rotas em lote e no dia operacional da escrita', async () => {
    const { useCase, findActiveForDrivers } = build({
      fichas: [
        { id: 'ficha-a', name: 'Ana' },
        { id: 'ficha-b', name: 'Bruno' },
      ],
    });

    await useCase.execute(TENANT, HOJE);

    // Uma consulta com as duas fichas — não uma por motorista (N+1).
    expect(findActiveForDrivers).toHaveBeenCalledTimes(1);
    expect(findActiveForDrivers).toHaveBeenCalledWith(TENANT, ['ficha-a', 'ficha-b'], '2026-08-03');
  });

  it('lê tudo do tenant do request (isolamento)', async () => {
    const { useCase, countActiveByDriver } = build({});

    await useCase.execute('tenant-X', HOJE);

    expect(countActiveByDriver).toHaveBeenCalledWith('tenant-X');
  });
});
