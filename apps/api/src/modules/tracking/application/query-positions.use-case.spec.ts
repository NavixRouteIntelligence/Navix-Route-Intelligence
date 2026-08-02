import type { DriverPosition } from '../domain/driver-position';
import type { PositionRepositoryPort } from '../domain/ports/position-repository.port';

import type { DriverAccountLinkPort } from './ports/driver-account-link.port';
import { QueryPositionsUseCase } from './query-positions.use-case';

const TENANT = 'tenant-a';
const FICHA = 'ficha-maria';
const LOGIN = 'login-maria';

function position(driverId: string): DriverPosition {
  return {
    id: `pos-${driverId}`,
    tenantId: TENANT,
    driverId,
    latitude: 38.72,
    longitude: -9.14,
    recordedAt: new Date(),
    speed: 40,
    heading: 90,
    status: 'en_route',
  };
}

/** `vinculos` mapeia ficha → login; o resto do mock deriva daí. */
function build(rows: DriverPosition[] = [], vinculos: Record<string, string> = {}) {
  const findLatestForDriver = jest.fn(
    async (_t: string, driverId: string) => rows.find((r) => r.driverId === driverId) ?? null,
  );
  const findHistory = jest.fn(async (_t: string, driverId: string) =>
    rows.filter((r) => r.driverId === driverId),
  );
  const findBetween = jest.fn().mockResolvedValue(rows);
  const positions: PositionRepositoryPort = {
    save: jest.fn(),
    saveMany: jest.fn(),
    findLatestForDriver,
    findLatestPerDriver: jest.fn().mockResolvedValue(rows),
    findBetween,
    findHistory,
    pruneOlderThan: jest.fn(),
  };

  const porLogin = new Map(Object.entries(vinculos).map(([f, l]) => [l, f]));
  const link: DriverAccountLinkPort = {
    userIdForDriver: jest.fn(async (_t: string, ficha: string) => vinculos[ficha] ?? null),
    driverIdsForUsers: jest.fn(
      async (_t: string, logins: string[]) =>
        new Map(logins.filter((l) => porLogin.has(l)).map((l) => [l, porLogin.get(l) as string])),
    ),
  };

  return {
    uc: new QueryPositionsUseCase(positions, link),
    findLatestForDriver,
    findHistory,
    findBetween,
  };
}

describe('QueryPositionsUseCase — junção ficha↔login (ADR-0086)', () => {
  // O sintoma que abriu a ADR: a frota mostrava toda ficha como "offline, sem
  // sinal" enquanto o motorista transmitia, porque os ids não casavam.
  describe('fleetLatest', () => {
    it('devolve a posição sob o id da FICHA, não do login', async () => {
      const { uc } = build([position(LOGIN)], { [FICHA]: LOGIN });

      const [view] = await uc.fleetLatest(TENANT);

      expect(view.driverId).toBe(FICHA);
      expect(view.latitude).toBe(38.72);
    });

    it('login sem ficha (autônomo) mantém o próprio id', async () => {
      const { uc } = build([position('login-solo')], {});

      const [view] = await uc.fleetLatest(TENANT);

      expect(view.driverId).toBe('login-solo');
    });

    it('traduz a frota inteira numa consulta só (sem N+1)', async () => {
      const { uc } = build([position(LOGIN), position('login-2')], {
        [FICHA]: LOGIN,
        'ficha-2': 'login-2',
      });

      const views = await uc.fleetLatest(TENANT);

      expect(views.map((v) => v.driverId).sort()).toEqual(['ficha-2', FICHA]);
    });
  });

  describe('latestForDriver (recebe ficha)', () => {
    it('traduz a ficha e consulta pelo login', async () => {
      const { uc, findLatestForDriver } = build([position(LOGIN)], { [FICHA]: LOGIN });

      const view = await uc.latestForDriver(TENANT, FICHA);

      expect(findLatestForDriver).toHaveBeenCalledWith(TENANT, LOGIN);
      // E devolve o id pelo qual foi perguntado.
      expect(view?.driverId).toBe(FICHA);
    });

    // Terceirizado cadastrado na frota que não usa o app: ausência de posição é
    // o estado correto, não um erro.
    it('ficha sem conta no app devolve null sem ir ao banco', async () => {
      const { uc, findLatestForDriver } = build([position(LOGIN)], {});

      await expect(uc.latestForDriver(TENANT, FICHA)).resolves.toBeNull();
      expect(findLatestForDriver).not.toHaveBeenCalled();
    });
  });

  describe('history (recebe ficha)', () => {
    it('traduz a ficha e devolve os pontos sob o id da ficha', async () => {
      const { uc, findHistory } = build([position(LOGIN)], { [FICHA]: LOGIN });

      const result = await uc.history(TENANT, FICHA);

      expect(findHistory).toHaveBeenCalledWith(TENANT, LOGIN, 200);
      expect(result.driverId).toBe(FICHA);
      expect(result.points).toHaveLength(1);
    });

    it('ficha sem conta devolve histórico vazio', async () => {
      const { uc } = build([position(LOGIN)], {});

      await expect(uc.history(TENANT, FICHA)).resolves.toEqual({ driverId: FICHA, points: [] });
    });
  });

  // O motorista autônomo não tem ficha: as rotas `me/*` precisam continuar
  // consultando direto pelo login, sem passar pela tradução.
  describe('rotas do próprio motorista', () => {
    it('latestForUser consulta pelo login, sem traduzir', async () => {
      const { uc, findLatestForDriver } = build([position(LOGIN)], { [FICHA]: LOGIN });

      const view = await uc.latestForUser(TENANT, LOGIN);

      expect(findLatestForDriver).toHaveBeenCalledWith(TENANT, LOGIN);
      expect(view?.driverId).toBe(LOGIN);
    });

    it('historyForUser consulta pelo login, sem traduzir', async () => {
      const { uc, findHistory } = build([position(LOGIN)], { [FICHA]: LOGIN });

      const result = await uc.historyForUser(TENANT, LOGIN);

      expect(findHistory).toHaveBeenCalledWith(TENANT, LOGIN, 200);
      expect(result.driverId).toBe(LOGIN);
    });
  });

  it('calcula vários geofences com uma única leitura de rastro', async () => {
    const endedAt = new Date('2026-08-02T10:02:00.000Z');
    const rows = [
      {
        ...position(LOGIN),
        latitude: 38.7223,
        longitude: -9.1393,
        recordedAt: new Date('2026-08-02T10:00:00.000Z'),
      },
      {
        ...position(LOGIN),
        id: 'pos-2',
        latitude: 38.7223,
        longitude: -9.1393,
        recordedAt: endedAt,
      },
    ];
    const { uc, findBetween } = build(rows, { [FICHA]: LOGIN });

    const result = await uc.serviceMinutesAtStops(
      TENANT,
      FICHA,
      [
        { id: 'd1', latitude: 38.7223, longitude: -9.1393 },
        { id: 'd2', latitude: 41.1579, longitude: -8.6291 },
      ],
      endedAt,
    );

    expect(result.get('d1')).toBe(2);
    expect(result.get('d2')).toBeNull();
    expect(findBetween).toHaveBeenCalledTimes(1);
  });
});
