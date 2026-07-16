import { Injectable } from '@nestjs/common';

import type { CollectiveObservation } from '../domain/collective-insight';
import type { CollectiveInsightsPort } from '../domain/collective-insights.port';

/**
 * Adaptador em memória da inteligência coletiva (ADR-0031). Usado em testes e
 * como implementação de referência da port. Em produção usa-se o repositório
 * Postgres (RLS por tenant).
 */
@Injectable()
export class InMemoryCollectiveInsights implements CollectiveInsightsPort {
  private readonly rows: CollectiveObservation[] = [];

  record(observation: CollectiveObservation): Promise<void> {
    this.rows.push(observation);
    return Promise.resolve();
  }

  findRecent(
    tenantId: string,
    cell: string,
    since: Date,
    limit: number,
  ): Promise<CollectiveObservation[]> {
    return this.query(tenantId, (c) => c === cell, since, limit);
  }

  findRecentByCells(
    tenantId: string,
    cells: string[],
    since: Date,
    limit: number,
  ): Promise<CollectiveObservation[]> {
    if (cells.length === 0) return Promise.resolve([]);
    const set = new Set(cells);
    return this.query(tenantId, (c) => set.has(c), since, limit);
  }

  private query(
    tenantId: string,
    cellMatches: (cell: string) => boolean,
    since: Date,
    limit: number,
  ): Promise<CollectiveObservation[]> {
    const found = this.rows
      .filter(
        (o) =>
          o.tenantId === tenantId &&
          cellMatches(o.cell) &&
          o.createdAt.getTime() >= since.getTime(),
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
    return Promise.resolve(found);
  }
}
