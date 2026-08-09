import type { TenantAccountTypeReaderPort } from '../../../shared/tenancy/tenant-account-type.port';
import type { TenantTimeZoneReaderPort } from '../../../shared/tenancy/tenant-time-zone.port';
import type { DailyRawRow } from '../domain/daily-subject';
import type { DriverKpiRepositoryPort } from '../domain/ports/driver-kpi-repository.port';

import { GetDriverDailySnapshotUseCase } from './get-driver-daily-snapshot.use-case';

const TENANT = 'tenant-1';
const LOGIN = 'user-1';
const FICHA = 'driver-1';

function linha(over: Partial<DailyRawRow> = {}): DailyRawRow {
  return {
    day: '2026-08-08',
    delivered: 5,
    failed: 1,
    onTime: 4,
    firstActivityAt: new Date('2026-08-08T08:00:00Z'),
    lastActivityAt: new Date('2026-08-08T14:00:00Z'), // 360 min
    plans: 0,
    savedKm: null,
    savedMinutes: null,
    vehicleTypes: [],
    projectedAt: new Date('2026-08-09T02:00:00Z'),
    ...over,
  };
}

function build(opts: {
  ficha?: string | null;
  conta?: 'driver' | 'company';
  linhas?: DailyRawRow[];
  zona?: string;
}) {
  const kpis = {
    rebuildDay: jest.fn(),
    range: jest.fn().mockResolvedValue(opts.linhas ?? []),
    driverIdForUser: jest.fn().mockResolvedValue(opts.ficha ?? null),
  } as unknown as jest.Mocked<DriverKpiRepositoryPort>;
  const contas: TenantAccountTypeReaderPort = {
    findAccountType: async () => opts.conta ?? 'driver',
  };
  const zonas: TenantTimeZoneReaderPort = { findTimeZone: async () => opts.zona ?? 'UTC' };
  return { uc: new GetDriverDailySnapshotUseCase(kpis, contas, zonas), kpis };
}

describe('GetDriverDailySnapshotUseCase', () => {
  it('lê pelo login quando não há ficha e a conta é de motorista', async () => {
    const { uc, kpis } = build({ ficha: null, linhas: [linha()] });

    const foto = await uc.execute(TENANT, LOGIN, '2026-08-08');

    expect(kpis.range).toHaveBeenCalledWith(
      TENANT,
      { kind: 'user', userId: LOGIN },
      expect.any(String),
      '2026-08-08',
    );
    expect(foto.delivered).toBe(5);
  });

  it('lê pela ficha quando ela existe', async () => {
    const { uc, kpis } = build({ ficha: FICHA, linhas: [linha()] });

    await uc.execute(TENANT, LOGIN, '2026-08-08');

    expect(kpis.range).toHaveBeenCalledWith(
      TENANT,
      { kind: 'driver', driverId: FICHA },
      expect.any(String),
      '2026-08-08',
    );
  });

  // As taxas não ficam gravadas: derivam da contagem crua a cada leitura.
  it('deriva as taxas das contagens cruas', async () => {
    const { uc } = build({ linhas: [linha({ delivered: 3, failed: 1, onTime: 2 })] });

    const foto = await uc.execute(TENANT, LOGIN, '2026-08-08');

    expect(foto.successRate).toBeCloseTo(0.75);
    expect(foto.onTimeRate).toBeCloseTo(2 / 3);
  });

  it('sem finalizadas, a taxa é nula — nunca 0%', async () => {
    const { uc } = build({ linhas: [linha({ delivered: 0, failed: 0, onTime: 0 })] });

    const foto = await uc.execute(TENANT, LOGIN, '2026-08-08');

    expect(foto.successRate).toBeNull();
    expect(foto.onTimeRate).toBeNull();
  });

  describe('estados', () => {
    it('linha ausente é projeção pendente, não dia de folga', async () => {
      const { uc } = build({ linhas: [] });

      const foto = await uc.execute(TENANT, LOGIN, '2026-08-08');

      expect(foto.state).toBe('pending');
      expect(foto.projectedAt).toBeNull();
    });

    it('linha projetada e vazia é dia sem trabalho', async () => {
      const { uc } = build({
        linhas: [linha({ delivered: 0, failed: 0, onTime: 0, plans: 0 })],
      });

      const foto = await uc.execute(TENANT, LOGIN, '2026-08-08');

      expect(foto.state).toBe('no-work');
      expect(foto.projectedAt).not.toBeNull();
    });

    // Trabalho sem limites de atividade: dizer `ok` esconderia que a duração é
    // desconhecida justamente onde ela sugeriria descanso.
    it('trabalho sem limites de atividade é dado incompleto', async () => {
      const { uc } = build({
        linhas: [linha({ firstActivityAt: null, lastActivityAt: null })],
      });

      const foto = await uc.execute(TENANT, LOGIN, '2026-08-08');

      expect(foto.state).toBe('incomplete');
      expect(foto.activeMinutes).toBeNull();
    });

    it('um único carimbo não vira duração', async () => {
      const mesmo = new Date('2026-08-08T08:00:00Z');
      const { uc } = build({ linhas: [linha({ firstActivityAt: mesmo, lastActivityAt: mesmo })] });

      const foto = await uc.execute(TENANT, LOGIN, '2026-08-08');

      expect(foto.activeMinutes).toBeNull();
      expect(foto.state).toBe('incomplete');
    });

    it('dia completo tem duração derivada dos limites', async () => {
      const { uc } = build({ linhas: [linha()] });

      const foto = await uc.execute(TENANT, LOGIN, '2026-08-08');

      expect(foto.state).toBe('ok');
      expect(foto.activeMinutes).toBe(360);
    });
  });

  describe('poupança', () => {
    it('sem plano atribuível, não há poupança nenhuma', async () => {
      const { uc } = build({ linhas: [linha({ plans: 0, savedKm: 12 })] });

      expect((await uc.execute(TENANT, LOGIN, '2026-08-08')).savings).toBeNull();
    });

    it('com um tipo de veículo, o combustível é derivado e declarado estimativa', async () => {
      const { uc } = build({
        linhas: [linha({ plans: 1, savedKm: 50, savedMinutes: 30, vehicleTypes: ['car'] })],
      });

      const foto = await uc.execute(TENANT, LOGIN, '2026-08-08');

      expect(foto.savings).toEqual({
        distanceKm: 50,
        timeMinutes: 30,
        fuelLiters: 4, // 50 km × 8 l/100 km
        estimated: true,
      });
    });

    it('dia com veículos diferentes não tem consumo do dia', async () => {
      const { uc } = build({
        linhas: [linha({ plans: 2, savedKm: 50, vehicleTypes: ['car', 'van'] })],
      });

      expect((await uc.execute(TENANT, LOGIN, '2026-08-08')).savings?.fuelLiters).toBeNull();
    });

    it('bicicleta não consome combustível', async () => {
      const { uc } = build({
        linhas: [linha({ plans: 1, savedKm: 50, vehicleTypes: ['bicycle'] })],
      });

      expect((await uc.execute(TENANT, LOGIN, '2026-08-08')).savings?.fuelLiters).toBeNull();
    });
  });

  describe('sujeito e fuso', () => {
    it('sem ficha em conta de empresa, não há sujeito nem leitura', async () => {
      const { uc, kpis } = build({ ficha: null, conta: 'company' });

      const foto = await uc.execute(TENANT, LOGIN, '2026-08-08');

      expect(foto.state).toBe('no-work');
      expect(kpis.range).not.toHaveBeenCalled();
    });

    // "Ontem" é o dia de quem opera. Em UTC-3, às 00h30 de dia 9, ontem ainda é
    // o dia 7 para o relógio do servidor — e é o 8 para o motorista.
    it('sem dia informado, usa ontem no fuso do tenant', async () => {
      const { uc, kpis } = build({ zona: 'America/Sao_Paulo', linhas: [] });

      await uc.execute(TENANT, LOGIN, undefined, new Date('2026-08-09T02:30:00Z'));

      expect(kpis.range).toHaveBeenCalledWith(
        TENANT,
        expect.anything(),
        expect.any(String),
        '2026-08-07',
      );
    });

    it('em UTC, ontem é o dia anterior do relógio', async () => {
      const { uc, kpis } = build({ zona: 'UTC', linhas: [] });

      await uc.execute(TENANT, LOGIN, undefined, new Date('2026-08-09T02:30:00Z'));

      expect(kpis.range).toHaveBeenCalledWith(
        TENANT,
        expect.anything(),
        expect.any(String),
        '2026-08-08',
      );
    });

    it('o dia devolvido é sempre o consultado — a tela não adivinha', async () => {
      const { uc } = build({ linhas: [] });

      expect((await uc.execute(TENANT, LOGIN, '2026-07-01')).day).toBe('2026-07-01');
    });
  });
});

// T7.3 / ADR-0118: a comparação viaja junto com a fotografia, e só quando o dia
// pedido é de facto o último trabalhado.
describe('GetDriverDailySnapshotUseCase — comparação com o próprio histórico', () => {
  function dias(n: number, delivered: number): DailyRawRow[] {
    return Array.from({ length: n }, (_, i) =>
      linha({
        day: `2026-08-${String(i + 1).padStart(2, '0')}`,
        delivered,
        failed: 0,
        onTime: delivered,
      }),
    );
  }

  it('o dia mais recente trabalhado traz a comparação', async () => {
    const janela = [
      ...dias(5, 10),
      linha({ day: '2026-08-06', delivered: 20, failed: 0, onTime: 20 }),
    ];
    const { uc } = build({ linhas: janela });

    const foto = await uc.execute(TENANT, LOGIN, '2026-08-06');

    expect(foto.baseline?.day).toBe('2026-08-06');
    expect(foto.baseline?.delivered).toMatchObject({
      current: 20,
      baseline: 10,
      trend: 'improved',
    });
  });

  it('um dia anterior não recebe a comparação de outro dia', async () => {
    const { uc } = build({ linhas: dias(5, 10) });

    const foto = await uc.execute(TENANT, LOGIN, '2026-08-02');

    expect(foto.baseline).toBeUndefined();
  });

  it('sem histórico suficiente, os indicadores dizem que estão a construir', async () => {
    const { uc } = build({ linhas: dias(2, 10) });

    const foto = await uc.execute(TENANT, LOGIN, '2026-08-02');

    expect(foto.baseline?.delivered.trend).toBe('building-history');
    expect(foto.baseline?.delivered.baseline).toBeNull();
  });
});
