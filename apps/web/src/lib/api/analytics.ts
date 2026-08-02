import type { DriverPerformanceView, KpiSummary, ResourceResponse } from '@navix/contracts';

import { apiRequest, toQuery } from './client';

/**
 * KPIs da operação (ADR-0092).
 *
 * Lê o **read model** — não as tabelas transacionais. Antes o dashboard somava
 * as 100 primeiras linhas de quatro listas e chamava aquilo de total.
 */
export const analyticsApi = {
  kpiSummary: (windowDays = 30) =>
    apiRequest<ResourceResponse<KpiSummary>>(`/kpis/summary${toQuery({ windowDays })}`),

  /**
   * Desempenho do **próprio** motorista (ADR-0097). Não existe variante para
   * consultar outro motorista, de propósito: sem endpoint não há ranking.
   */
  myPerformance: (windowDays = 30) =>
    apiRequest<ResourceResponse<DriverPerformanceView>>(
      `/me/performance${toQuery({ windowDays })}`,
    ),
};
