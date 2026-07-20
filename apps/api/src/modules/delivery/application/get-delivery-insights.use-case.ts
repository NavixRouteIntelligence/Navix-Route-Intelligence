import { Inject, Injectable } from '@nestjs/common';
import type { DeliveryInsights } from '@navix/contracts';

import {
  aggregateDeliveryInsights,
  type InsightInput,
} from '../domain/delivery-insights';
import {
  DELIVERY_REPOSITORY,
  type DeliveryRepositoryPort,
} from '../domain/ports/delivery-repository.port';

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Insights de entrega do período (FASE 3, F2): agrega as entregas **concluídas**
 * por cidade e por hora do dia. Aproxima a conclusão por `updatedAt` (status
 * terminal `delivered`). Escopado por tenant (RLS + filtro explícito no repo).
 */
@Injectable()
export class GetDeliveryInsightsUseCase {
  constructor(
    @Inject(DELIVERY_REPOSITORY) private readonly deliveries: DeliveryRepositoryPort,
  ) {}

  async execute(tenantId: string, from: Date, to: Date): Promise<DeliveryInsights> {
    const { items } = await this.deliveries.findAll(tenantId, {
      page: { page: 1, pageSize: 2000 },
      filters: {},
      sort: [],
    });

    const inputs: InsightInput[] = [];
    for (const d of items) {
      const s = d.snapshot();
      if (s.status !== 'delivered') continue;
      const t = s.updatedAt.getTime();
      if (t < from.getTime() || t > to.getTime()) continue;
      inputs.push({ city: s.address.snapshot().city, hour: s.updatedAt.getUTCHours() });
    }

    const agg = aggregateDeliveryInsights(inputs);
    return {
      from: isoDate(from),
      to: isoDate(to),
      totalDelivered: agg.totalDelivered,
      topRegions: agg.topRegions,
      byHour: agg.byHour,
      bestRegion: agg.bestRegion,
      bestHour: agg.bestHour,
    };
  }
}
