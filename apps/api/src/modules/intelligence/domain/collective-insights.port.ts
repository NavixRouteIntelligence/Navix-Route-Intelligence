import type { CollectiveObservation } from './collective-insight';

/**
 * Armazenamento das observações coletivas (ADR-0031). Port desacoplada: hoje um
 * repositório Postgres (RLS por tenant); amanhã um store de eventos/streaming ou
 * um índice geoespacial — sem tocar os casos de uso. A agregação vive no domínio
 * (`aggregateInsight`), independente do armazenamento.
 */
export interface CollectiveInsightsPort {
  record(observation: CollectiveObservation): Promise<void>;
  /** Observações recentes de uma célula (a partir de `since`, até `limit`). */
  findRecent(
    tenantId: string,
    cell: string,
    since: Date,
    limit: number,
  ): Promise<CollectiveObservation[]>;
}

export const COLLECTIVE_INSIGHTS = Symbol('COLLECTIVE_INSIGHTS');
