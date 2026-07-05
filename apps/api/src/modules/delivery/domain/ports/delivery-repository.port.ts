import type { PagedResult } from '../../../../shared/kernel/pagination';
import type { ListDeliveriesQuery } from '../../application/queries/list-deliveries.query';
import type { Delivery } from '../delivery';

/** Port do repositório de entregas. Toda operação é escopada por `tenantId`. */
export interface DeliveryRepositoryPort {
  save(delivery: Delivery): Promise<void>;
  /** Por padrão ignora entregas com soft delete. */
  findById(tenantId: string, id: string): Promise<Delivery | null>;
  findByIds(tenantId: string, ids: string[]): Promise<Delivery[]>;
  findAll(tenantId: string, query: ListDeliveriesQuery): Promise<PagedResult<Delivery>>;
}

export const DELIVERY_REPOSITORY = Symbol('DELIVERY_REPOSITORY');
