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

function mocks(ficha: string | null) {
  const driverKpis: jest.Mocked<DriverKpiRepositoryPort> = {
    rebuildDay: jest.fn(),
    range: jest.fn().mockResolvedValue([linha()]),
    driverIdForUser: jest.fn().mockResolvedValue(ficha),
  };
  const tenantKpis: jest.Mocked<KpiRepositoryPort> = {
    rebuildDay: jest.fn(),
    range: jest.fn().mockResolvedValue([]),
  };
  return { driverKpis, tenantKpis };
}

describe('GetDriverPerformanceUseCase', () => {
  it('lê o read model da ficha do motorista autenticado', async () => {
    const { driverKpis, tenantKpis } = mocks(FICHA);

    const resumo = await new GetDriverPerformanceUseCase(driverKpis, tenantKpis).execute(
      TENANT,
      LOGIN,
      30,
    );

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

  // O autônomo não tem ficha (ADR-0085): o rollup do tenant é o desempenho dele.
  it('sem ficha, cai no rollup do tenant', async () => {
    const { driverKpis, tenantKpis } = mocks(null);
    tenantKpis.range.mockResolvedValue([
      { day: '2026-07-30', delivered: 6, failed: 0, onTime: 5 } as KpiDailyRow,
    ]);

    const resumo = await new GetDriverPerformanceUseCase(driverKpis, tenantKpis).execute(
      TENANT,
      LOGIN,
      30,
    );

    expect(driverKpis.range).not.toHaveBeenCalled();
    expect(resumo.delivered).toBe(6);
    // Sem `activeMinutes` no rollup do tenant, não se inventa sugestão de pausa.
    expect(resumo.restAdvice).toBeNull();
  });

  it('a janela pedida delimita o período consultado', async () => {
    const { driverKpis, tenantKpis } = mocks(FICHA);

    const resumo = await new GetDriverPerformanceUseCase(driverKpis, tenantKpis).execute(
      TENANT,
      LOGIN,
      7,
    );

    const dias =
      (Date.parse(`${resumo.to}T00:00:00Z`) - Date.parse(`${resumo.from}T00:00:00Z`)) / 86_400_000;
    expect(dias).toBe(6); // 7 dias inclusive

    // O período da meta é o anterior, e não se sobrepõe ao atual.
    const [, , baseFrom, baseTo] = driverKpis.range.mock.calls[1];
    expect(baseTo < resumo.from).toBe(true);
    expect(baseFrom < baseTo).toBe(true);
  });
});
