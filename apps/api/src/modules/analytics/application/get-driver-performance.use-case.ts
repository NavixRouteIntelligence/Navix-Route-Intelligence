import { Inject, Injectable } from '@nestjs/common';

import {
  summarizeDriverPerformance,
  type DriverDayRow,
  type DriverPerformance,
} from '../domain/driver-performance';
import {
  DRIVER_KPI_REPOSITORY,
  type DriverKpiRepositoryPort,
} from '../domain/ports/driver-kpi-repository.port';
import { KPI_REPOSITORY, type KpiRepositoryPort } from '../domain/ports/kpi-repository.port';

import { isoDay } from './get-kpi-summary.use-case';

/** Janela padrão do consolidado do motorista. */
export const DEFAULT_WINDOW_DAYS = 30;

const DIA_MS = 24 * 60 * 60 * 1000;

/**
 * Desempenho consolidado do **próprio** motorista (ADR-0097).
 *
 * Recebe o login autenticado e resolve a ficha internamente. Lê o período
 * pedido e o imediatamente anterior — este último apenas para derivar a meta,
 * que é a média do próprio motorista. Nenhuma consulta olha para outro
 * motorista: não há como comparar porque não há o que comparar.
 */
@Injectable()
export class GetDriverPerformanceUseCase {
  constructor(
    @Inject(DRIVER_KPI_REPOSITORY) private readonly kpis: DriverKpiRepositoryPort,
    @Inject(KPI_REPOSITORY) private readonly tenantKpis: KpiRepositoryPort,
  ) {}

  async execute(
    tenantId: string,
    userId: string,
    windowDays = DEFAULT_WINDOW_DAYS,
  ): Promise<DriverPerformance> {
    const agora = Date.now();
    const from = isoDay(new Date(agora - (windowDays - 1) * DIA_MS));
    const to = isoDay(new Date(agora));
    // Período anterior de mesmo tamanho — a base da meta.
    const baseFrom = isoDay(new Date(agora - (windowDays * 2 - 1) * DIA_MS));
    const baseTo = isoDay(new Date(agora - windowDays * DIA_MS));

    const ficha = await this.kpis.driverIdForUser(tenantId, userId);
    const ler = ficha
      ? (de: string, ate: string) => this.kpis.range(tenantId, ficha, de, ate)
      : (de: string, ate: string) => this.porTenant(tenantId, de, ate);

    const [atual, anterior] = await Promise.all([ler(from, to), ler(baseFrom, baseTo)]);

    return summarizeDriverPerformance(atual, anterior, from, to);
  }

  /**
   * Motorista autônomo: sem ficha (ADR-0085), o tenant é ele, e o rollup do
   * tenant **é** o desempenho dele — a organização tem uma pessoa só.
   *
   * O que se perde é `activeMinutes`, que o rollup do tenant não guarda: a
   * sugestão de descanso não aparece para o autônomo. Preferi a ausência a uma
   * estimativa inventada — sugerir pausa com base em número errado corrói a
   * confiança justamente na parte que existe para proteger quem dirige.
   */
  private async porTenant(tenantId: string, from: string, to: string): Promise<DriverDayRow[]> {
    const rows = await this.tenantKpis.range(tenantId, from, to);
    return rows.map((r) => ({
      day: r.day,
      delivered: r.delivered,
      failed: r.failed,
      onTime: r.onTime,
      activeMinutes: 0,
    }));
  }
}
