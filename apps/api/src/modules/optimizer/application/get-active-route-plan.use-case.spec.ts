import type { PagedResult } from '../../../shared/kernel/pagination';
import type { RoutePlanRepositoryPort } from '../domain/ports/route-plan-repository.port';
import { RoutePlan, operationalDayOf, type NewRoutePlan } from '../domain/route-plan';

import { GetActiveRoutePlanUseCase } from './get-active-route-plan.use-case';
import type { DriverRosterLinkPort } from './ports/driver-roster-link.port';

const TENANT = 'tenant-1';
const LOGIN = 'user-1';
const FICHA = 'driver-1';

function plan(driverId: string | null): RoutePlan {
  const base: NewRoutePlan = {
    tenantId: TENANT,
    driverId,
    driverScoped: true,
    strategy: 'nearest-neighbor-2opt',
    status: 'completed',
    params: { averageSpeedKmh: 30, serviceTimeMinutes: 5, hasOrigin: false },
    stops: [],
    metrics: { totalDistanceKm: 10, totalTimeMinutes: 60, stops: 2 },
    baseline: { totalDistanceKm: 12, totalTimeMinutes: 70, stops: 2 },
    savings: { distanceKm: 2, distancePct: 17, timeMinutes: 10, timePct: 14 },
    score: 80,
    explanation: 'ok',
  };
  return RoutePlan.create(base);
}

function build(ficha: string | null, found: RoutePlan | null) {
  const chamadas: { driverId: string | null; day: string }[] = [];
  const plans: RoutePlanRepositoryPort = {
    save: async () => undefined,
    findById: async () => null,
    findAll: async (): Promise<PagedResult<RoutePlan>> => ({ items: [], total: 0 }),
    findActiveForDriver: async (_t, driverId, day) => {
      chamadas.push({ driverId, day });
      return found;
    },
    findActiveForDrivers: async () => new Map(),
    findLatestContainingDelivery: async () => null,
    findLatestRequestedForDriver: async () => null,
  };
  const roster: DriverRosterLinkPort = {
    driverIdForUser: async () => ficha,
    activeDrivers: async () => [],
  };
  return { uc: new GetActiveRoutePlanUseCase(plans, roster), chamadas };
}

describe('GetActiveRoutePlanUseCase', () => {
  it('busca pela ficha do login autenticado, no dia operacional', async () => {
    const esperado = plan(FICHA);
    const { uc, chamadas } = build(FICHA, esperado);

    const view = await uc.execute(TENANT, LOGIN, new Date('2026-08-02T14:00:00.000Z'));

    expect(view?.id).toBe(esperado.id);
    expect(view?.driverId).toBe(FICHA);
    expect(chamadas).toEqual([{ driverId: FICHA, day: '2026-08-02' }]);
  });

  // O autônomo não tem ficha (ADR-0085): a rota dele é a do tenant, que é ele.
  it('sem ficha, procura os planos sem motorista', async () => {
    const { uc, chamadas } = build(null, plan(null));

    const view = await uc.execute(TENANT, LOGIN, new Date('2026-08-02T14:00:00.000Z'));

    expect(view?.driverId).toBeNull();
    expect(chamadas[0].driverId).toBeNull();
  });

  it('sem rota preparada no dia, devolve nulo em vez de a de ontem', async () => {
    const { uc } = build(FICHA, null);

    expect(await uc.execute(TENANT, LOGIN)).toBeNull();
  });

  // A propriedade que mantém o vínculo utilizável: escrita e leitura têm de
  // derivar o mesmo dia. Se divergirem, a rota some da tela sem erro nenhum.
  it('o dia da consulta é derivado como o do plano', async () => {
    const at = new Date('2026-08-02T23:30:00.000Z');
    const { uc, chamadas } = build(FICHA, plan(FICHA));

    await uc.execute(TENANT, LOGIN, at);

    expect(chamadas[0].day).toBe(operationalDayOf(at));
  });
});
