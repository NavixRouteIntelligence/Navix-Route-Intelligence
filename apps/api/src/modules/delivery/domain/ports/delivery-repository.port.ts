import type { PagedResult } from '../../../../shared/kernel/pagination';
import type { NormalizedSync } from '../../../../shared/kernel/sync';
import type { ListDeliveriesQuery } from '../../application/queries/list-deliveries.query';
import type { Delivery } from '../delivery';

/**
 * Página do feed de sincronização incremental. `items` já vem limitado ao
 * `limit`; `hasMore` sinaliza que havia mais linhas (para montar o cursor).
 * **Inclui tombstones** (entregas com soft delete) para o cache offline.
 */
export interface DeliveryChanges {
  items: Delivery[];
  hasMore: boolean;
}

/** Port do repositório de entregas. Toda operação é escopada por `tenantId`. */
export interface DeliveryRepositoryPort {
  save(delivery: Delivery): Promise<void>;
  /** Por padrão ignora entregas com soft delete. */
  findById(tenantId: string, id: string): Promise<Delivery | null>;
  findByIds(tenantId: string, ids: string[]): Promise<Delivery[]>;
  findAll(tenantId: string, query: ListDeliveriesQuery): Promise<PagedResult<Delivery>>;
  /**
   * Feed de mudanças por keyset `(updated_at, id)` para sync incremental.
   * Inclui **tombstones**; ordenado de forma estável e paginável por cursor.
   */
  findChangedSince(tenantId: string, params: NormalizedSync): Promise<DeliveryChanges>;
}

export const DELIVERY_REPOSITORY = Symbol('DELIVERY_REPOSITORY');
