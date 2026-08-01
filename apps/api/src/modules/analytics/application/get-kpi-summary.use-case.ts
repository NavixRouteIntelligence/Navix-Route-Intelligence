import { Inject, Injectable } from '@nestjs/common';

import { summarizeKpis, type KpiSummary } from '../domain/kpi';
import { KPI_REPOSITORY, type KpiRepositoryPort } from '../domain/ports/kpi-repository.port';

/** Dias exibidos por padrão no dashboard. */
export const DEFAULT_WINDOW_DAYS = 30;

/** Formata como `YYYY-MM-DD` em UTC — a chave do rollup é uma data, não um instante. */
export function isoDay(at: Date): string {
  return at.toISOString().slice(0, 10);
}

/**
 * Resumo de KPIs do período (ADR-0092).
 *
 * Lê **só** o read model. É essa restrição que dá o resultado correto: o
 * dashboard antigo somava as 100 primeiras linhas do OLTP e chamava aquilo de
 * total.
 */
@Injectable()
export class GetKpiSummaryUseCase {
  constructor(@Inject(KPI_REPOSITORY) private readonly kpis: KpiRepositoryPort) {}

  async execute(tenantId: string, windowDays = DEFAULT_WINDOW_DAYS): Promise<KpiSummary> {
    const to = new Date();
    const from = new Date(to.getTime() - (windowDays - 1) * 24 * 60 * 60 * 1000);
    const desde = isoDay(from);
    const ate = isoDay(to);

    return summarizeKpis(await this.kpis.range(tenantId, desde, ate), desde, ate);
  }
}
