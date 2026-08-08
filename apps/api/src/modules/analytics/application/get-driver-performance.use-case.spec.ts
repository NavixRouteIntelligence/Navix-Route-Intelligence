import type { DailyRawRow } from '../domain/daily-subject';
import type { DriverKpiRepositoryPort } from '../domain/ports/driver-kpi-repository.port';

import { GetDriverPerformanceUseCase } from './get-driver-performance.use-case';

const TENANT = 'tenant-1';
const LOGIN = 'user-1';
const FICHA = 'driver-1';

function linha(over: Partial<DailyRawRow> = {}): DailyRawRow {
  return {
    day: '2026-07-30',
    delivered: 4,
    failed: 0,
    onTime: 4,
    firstActivityAt: new Date('2026-07-30T08:00:00Z'),
    lastActivityAt: new Date('2026-07-30T11:20:00Z'), // 200 min
    plans: 0,
    savedKm: null,
    savedMinutes: null,
    vehicleTypes: [],
    projectedAt: new Date('2026-07-31T02:00:00Z'),
    ...over,
  };
}

function mocks(ficha: string | null, accountType: 'driver' | 'company' = 'driver') {
  const driverKpis: jest.Mocked<DriverKpiRepositoryPort> = {
    rebuildDay: jest.fn(),
    range: jest.fn().mockResolvedValue([linha()]),
    driverIdForUser: jest.fn().mockResolvedValue(ficha),
  };
  const contas = { findAccountType: jest.fn().mockResolvedValue(accountType) };
  return { driverKpis, contas };
}

/** Constrói o caso de uso com os dublês na ordem do construtor. */
function build(m: ReturnType<typeof mocks>) {
  return new GetDriverPerformanceUseCase(m.driverKpis, m.contas);
}

describe('GetDriverPerformanceUseCase', () => {
  it('lê o read model da ficha do motorista autenticado', async () => {
    const m = mocks(FICHA);
    const { driverKpis } = m;

    const resumo = await build(m).execute(TENANT, LOGIN, 30);

    expect(driverKpis.driverIdForUser).toHaveBeenCalledWith(TENANT, LOGIN);
    // Só o período atual entra no consolidado; o anterior existe apenas para
    // derivar a meta.
    expect(resumo.delivered).toBe(4);
    // Toda leitura passa pelo sujeito de quem pediu — o id nunca vem do cliente.
    for (const call of driverKpis.range.mock.calls) {
      expect(call[1]).toEqual({ kind: 'driver', driverId: FICHA });
    }
  });

  // O autônomo não tem ficha (ADR-0085) e o tenant é dele: passa a ter linha
  // **própria** no read model, projetada pelo login (ADR-0117). Antes lia o
  // rollup do tenant, que não guarda atividade — e o zero resultante dizia
  // "não trabalhou" quando o que se passava era "não sabemos".
  it('sem ficha, em conta de motorista, lê pelo login', async () => {
    const m = mocks(null, 'driver');
    m.driverKpis.range.mockResolvedValue([linha({ delivered: 6, onTime: 5 })]);

    const resumo = await build(m).execute(TENANT, LOGIN, 30);

    expect(resumo.delivered).toBe(6);
    for (const call of m.driverKpis.range.mock.calls) {
      expect(call[1]).toEqual({ kind: 'user', userId: LOGIN });
    }
  });

  it('sem limites de atividade, não se inventa sugestão de pausa', async () => {
    const m = mocks(null, 'driver');
    m.driverKpis.range.mockResolvedValue([linha({ firstActivityAt: null, lastActivityAt: null })]);

    const resumo = await build(m).execute(TENANT, LOGIN, 30);

    expect(resumo.restAdvice).toBeNull();
  });

  it('a janela pedida delimita o período consultado', async () => {
    const m = mocks(FICHA);

    const resumo = await build(m).execute(TENANT, LOGIN, 7);

    const dias =
      (Date.parse(`${resumo.to}T00:00:00Z`) - Date.parse(`${resumo.from}T00:00:00Z`)) / 86_400_000;
    expect(dias).toBe(6); // 7 dias inclusive

    // O período da meta é o anterior, e não se sobrepõe ao atual.
    const [, , baseFrom, baseTo] = m.driverKpis.range.mock.calls[1];
    expect(baseTo < resumo.from).toBe(true);
    expect(baseFrom < baseTo).toBe(true);
  });
});

// T7.1 / ADR-0116: o rollup do tenant só é desempenho pessoal quando o tenant é
// a pessoa. A versão anterior caía nele por "não ter ficha", e um motorista de
// frota com a ficha por ligar via os números da empresa inteira como seus.
describe('GetDriverPerformanceUseCase — a quem pertencem os números', () => {
  it('sem ficha em conta de empresa, não devolve os números da empresa', async () => {
    const m = mocks(null, 'company');

    const resumo = await build(m).execute(TENANT, LOGIN, 30);

    expect(resumo.delivered).toBe(0);
    // Nem sequer há sujeito a consultar: nada é lido.
    expect(m.driverKpis.range).not.toHaveBeenCalled();
  });

  it('o tipo de conta é consultado antes de usar o rollup do tenant', async () => {
    const m = mocks(null, 'driver');

    await build(m).execute(TENANT, LOGIN, 30);

    expect(m.contas.findAccountType).toHaveBeenCalledWith(TENANT);
  });

  it('com ficha, o tipo de conta é irrelevante — os números já são dele', async () => {
    const m = mocks(FICHA, 'company');

    const resumo = await build(m).execute(TENANT, LOGIN, 30);

    expect(resumo.delivered).toBe(4);
    expect(m.contas.findAccountType).not.toHaveBeenCalled();
  });

  // Consolidado vazio é honesto: não há nada atribuível a esta pessoa enquanto
  // a ficha não estiver ligada. Mostrar o da empresa seria pior do que nada.
  it('o consolidado vazio não inventa meta nem sugestão de pausa', async () => {
    const m = mocks(null, 'company');

    const resumo = await build(m).execute(TENANT, LOGIN, 30);

    expect(resumo.goal).toBeNull();
    expect(resumo.restAdvice).toBeNull();
    expect(resumo.successRate).toBeNull();
  });
});
