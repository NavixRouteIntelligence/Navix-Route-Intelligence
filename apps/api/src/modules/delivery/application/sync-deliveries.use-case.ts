import { Inject, Injectable } from '@nestjs/common';
import type { Delivery as DeliveryView, SyncParams, SyncResponse } from '@navix/contracts';

import { buildSyncMeta, normalizeSync, type SyncCursor } from '../../../shared/kernel/sync';
import {
  DELIVERY_REPOSITORY,
  type DeliveryRepositoryPort,
} from '../domain/ports/delivery-repository.port';
import { toDeliveryView } from './mappers/delivery.mapper';

/**
 * Sincronização incremental de entregas (offline-first, ADR-0020). Devolve
 * apenas o que mudou desde a marca d'água do cliente — incluindo tombstones —
 * paginado por cursor de keyset, evitando o full refetch.
 */
@Injectable()
export class SyncDeliveriesUseCase {
  constructor(
    @Inject(DELIVERY_REPOSITORY) private readonly deliveries: DeliveryRepositoryPort,
  ) {}

  async execute(tenantId: string, params: SyncParams): Promise<SyncResponse<DeliveryView>> {
    const normalized = normalizeSync(params);
    const { items, hasMore } = await this.deliveries.findChangedSince(tenantId, normalized);

    const last: SyncCursor | null =
      items.length > 0
        ? { updatedAt: items[items.length - 1].snapshot().updatedAt, id: items[items.length - 1].snapshot().id }
        : null;

    return {
      data: items.map(toDeliveryView),
      meta: buildSyncMeta(last, normalized.limit, hasMore),
    };
  }
}
