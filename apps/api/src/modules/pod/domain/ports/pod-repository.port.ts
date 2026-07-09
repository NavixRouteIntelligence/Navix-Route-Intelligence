import type { PageParams, PagedResult } from '../../../../shared/kernel/pagination';
import type { ProofOfDelivery } from '../proof-of-delivery';

export interface PodRepositoryPort {
  save(pod: ProofOfDelivery): Promise<void>;
  findByDelivery(tenantId: string, deliveryId: string): Promise<ProofOfDelivery | null>;
  findAll(tenantId: string, page: PageParams): Promise<PagedResult<ProofOfDelivery>>;
  countByStatus(tenantId: string): Promise<{ delivered: number; absent: number; refused: number }>;
}

export const POD_REPOSITORY = Symbol('POD_REPOSITORY');

/** Porta anti-corrupção do POD para alterar o desfecho da entrega. */
export interface DeliveryOutcomePort {
  markOutcome(input: {
    tenantId: string;
    actorId: string;
    deliveryId: string;
    status: 'delivered' | 'failed';
  }): Promise<void>;
}

export const DELIVERY_OUTCOME = Symbol('DELIVERY_OUTCOME');
