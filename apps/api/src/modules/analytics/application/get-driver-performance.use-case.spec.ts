import type { DriverDayRow } from '../domain/driver-performance';
import type { KpiDailyRow } from '../domain/kpi';
import type { DriverKpiRepositoryPort } from '../domain/ports/driver-kpi-repository.port';
import type { KpiRepositoryPort } from '../domain/ports/kpi-repository.port';

import { GetDriverPerformanceUseCase } from './get-driver-performance.use-case';

const TENANT = 'tenant-1';
const LOGIN = 'user-1';
const FICHA = 'driver-1';

function linha(over: Partial<DriverDayRow> = {}): DriverDayRow {
  return { day: '2026-07-30', delivered: 4, failed: 0, onTime: 4, activeMinutes: 200, ...over };
}

function mocks(ficha: string | null, accountType: 'driver' | 'company' = 'driver') {
  const driverKpis: jest.Mocked<DriverKpiRepositoryPort> = {
    rebuildDay: jest.fn(),
    range: jest.fn().mockResolvedValue([linha()]),
    driverIdForUser: jest.fn().mockResolvedValue(ficha),
  };
  const tenantKpis: jest.Mocked<KpiRepositoryPort> = {
    rebuildDay: jest.fn(),
    range: jest.fn().mockResolvedValue([]),
  };
  const contas = { findAccountType: jest.fn().mockResolvedValue(accountType) };
  return { driverKpis, tenantKpis, contas };
}

/** Constrói o caso de uso com os dublês na ordem do construtor. */
function build(m: ReturnType<typeof mocks>) {
  return new GetDriverPerformanceUseCase(m.driverKpis, m.tenantKpis, m.contas);
}

describe('GetDriverPerformanceUseCase', () => {
  it('lê o read model da ficha do motorista autenticado', async () => {
    const m = mocks(FICHA);
    const { driverKpis, tenantKpis } = m;

    const resumo = await build(m).execute(TENANT, LOGIN, 30);

    expect(driverKpis.driverIdForUser).toHaveBeenCalledWith(TENANT, LOGIN);
    // Só o período atual entra no consolidado; o anterior existe apenas para
    // derivar a meta.
    expect(resumo.delivered).toBe(4);
    // Toda leitura passa pela ficha de quem pediu — o id nunca vem do cliente.
    for (const call of driverKpis.range.mock.calls) {
      expect(call[1]).toBe(FICHA);
    }
    expect(tenantKpis.range).not.toHaveBeenCalled();
  });

  // O autônomo não tem ficha (ADR-0085) **e** o tenant é dele: o rollup do
  // tenant é o desempenho dele.
  it('sem ficha, em conta de motorista, cai no rollup do tenant', async () => {
    const m = mocks(null, 'driver');
    const { driverKpis, tenantKpis } = m;
    tenantKpis.range.mockResolvedValue([
      { day: '2026-07-30', delivered: 6, failed: 0, onTime: 5 } as KpiDailyRow,
    ]);

    const resumo = await build(m).execute(TENANT, LOGIN, 30);

    expect(driverKpis.range).not.toHaveBeenCalled();
    expect(resumo.delivered).toBe(6);
    // Sem `activeMinutes` no rollup do tenant, não se inventa sugestão de pausa.
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
  const DIAS_DA_EMPRESA = [
    { day: '2026-07-30', delivered: 120, failed: 3, onTime: 110 } as KpiDailyRow,
  ];

  it('sem ficha em conta de empresa, não devolve os números da empresa', async () => {
    const m = mocks(null, 'company');
    m.tenantKpis.range.mockResolvedValue(DIAS_DA_EMPRESA);

    const resumo = await build(m).execute(TENANT, LOGIN, 30);

    expect(resumo.delivered).toBe(0);
    expect(m.tenantKpis.range).not.toHaveBeenCalled();
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
