import { Inject, Injectable } from '@nestjs/common';
import type { CollectiveInsightView } from '@navix/contracts';

import { aggregateInsight, locationCell } from '../domain/collective-insight';
import {
  COLLECTIVE_INSIGHTS,
  type CollectiveInsightsPort,
} from '../domain/collective-insights.port';

export interface GetCollectiveInsightQuery {
  tenantId: string;
  latitude: number;
  longitude: number;
}

/** Janela de observações consideradas (dias) e teto de linhas por célula. */
const WINDOW_DAYS = 90;
const MAX_OBSERVATIONS = 500;

/**
 * Inteligência coletiva (ADR-0031): devolve o insight agregado de uma célula de
 * localização — estacionamento típico, tempo de atendimento e dicas de acesso —
 * a partir das observações recentes da frota do tenant.
 */
@Injectable()
export class GetCollectiveInsightUseCase {
  constructor(
    @Inject(COLLECTIVE_INSIGHTS) private readonly store: CollectiveInsightsPort,
  ) {}

  async execute(query: GetCollectiveInsightQuery): Promise<CollectiveInsightView> {
    const cell = locationCell(query.latitude, query.longitude);
    const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const observations = await this.store.findRecent(
      query.tenantId,
      cell,
      since,
      MAX_OBSERVATIONS,
    );
    return aggregateInsight(cell, observations);
  }
}
