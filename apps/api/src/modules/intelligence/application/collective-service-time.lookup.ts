import { Inject, Injectable } from '@nestjs/common';

import { aggregateInsight, locationCell } from '../domain/collective-insight';
import {
  COLLECTIVE_INSIGHTS,
  type CollectiveInsightsPort,
} from '../domain/collective-insights.port';

export interface ServiceTimePoint {
  latitude: number;
  longitude: number;
}

/**
 * API pública do Intelligence para o **tempo de serviço típico** por local, a
 * partir das observações coletivas (ADR-0031/0065). Exposta para outros módulos
 * (ex.: Optimizer) sem revelar o repositório/agregação internos.
 */
export interface CollectiveServiceTimeLookupPort {
  /**
   * Tempo de serviço típico (min) de cada ponto, na ordem informada. `null`
   * quando não há amostra suficiente (< MIN_SAMPLE) — o consumidor cai no seu
   * próprio default. Consulta em lote (uma query para todos os pontos).
   */
  typicalServiceMinutes(tenantId: string, points: ServiceTimePoint[]): Promise<(number | null)[]>;
}

export const COLLECTIVE_SERVICE_TIMES = Symbol('COLLECTIVE_SERVICE_TIMES');

const WINDOW_DAYS = 90;
const MAX_OBSERVATIONS = 2000;

@Injectable()
export class CollectiveServiceTimeLookup implements CollectiveServiceTimeLookupPort {
  constructor(@Inject(COLLECTIVE_INSIGHTS) private readonly store: CollectiveInsightsPort) {}

  async typicalServiceMinutes(
    tenantId: string,
    points: ServiceTimePoint[],
  ): Promise<(number | null)[]> {
    if (points.length === 0) return [];

    const cells = points.map((p) => locationCell(p.latitude, p.longitude));
    const uniqueCells = [...new Set(cells)];
    const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);

    const observations = await this.store.findRecentByCells(
      tenantId,
      uniqueCells,
      since,
      MAX_OBSERVATIONS,
    );

    // Agrupa por célula e agrega uma vez por célula (evita reprocessar).
    const byCell = new Map<string, typeof observations>();
    for (const o of observations) {
      const list = byCell.get(o.cell);
      if (list) list.push(o);
      else byCell.set(o.cell, [o]);
    }
    const typicalByCell = new Map<string, number | null>();
    for (const cell of uniqueCells) {
      const insight = aggregateInsight(cell, byCell.get(cell) ?? []);
      typicalByCell.set(cell, insight.typicalServiceMinutes ?? null);
    }

    return cells.map((cell) => typicalByCell.get(cell) ?? null);
  }
}
