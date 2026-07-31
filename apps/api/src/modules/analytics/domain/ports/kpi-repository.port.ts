import type { KpiDailyRow } from '../kpi';

/** Read model diário de KPIs (ADR-0092). Escopado por tenant (RLS). */
export interface KpiRepositoryPort {
  /**
   * Recalcula o dia inteiro a partir do OLTP e grava no read model.
   *
   * Recomputação, e não incremento: um evento pode chegar duas vezes (retry,
   * replay) e um `+1` duplicaria o número, sem ninguém perceber. Recalcular é
   * idempotente por construção — o dia tem poucas dezenas de linhas.
   */
  rebuildDay(tenantId: string, day: string): Promise<void>;

  /** Linhas do período, em ordem cronológica. */
  range(tenantId: string, from: string, to: string): Promise<KpiDailyRow[]>;
}

export const KPI_REPOSITORY = Symbol('KPI_REPOSITORY');
