import { Inject, Injectable } from '@nestjs/common';
import type { DeliveryPriority } from '@navix/contracts';

import { AUDIT_LOG, type AuditLogPort } from '../../../shared/audit/audit-log.port';
import { NotFoundError } from '../../../shared/kernel/domain-error';
import {
  DELIVERY_REPOSITORY,
  type DeliveryRepositoryPort,
} from '../domain/ports/delivery-repository.port';
import { CreateDeliveryUseCase } from './create-delivery.use-case';

/** Rascunho de entrega vindo de outra origem (ex.: Import Center). */
export interface DeliveryDraft {
  tenantId: string;
  actorId: string;
  street: string;
  number: string;
  complement: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  latitude: number;
  longitude: number;
  priority: DeliveryPriority;
  notes: string | null;
  timeWindow?: { start: string; end: string };
}

/** Desfecho de uma entrega (usado pelo Proof of Delivery). */
export interface DeliveryOutcomeInput {
  tenantId: string;
  actorId: string;
  deliveryId: string;
  status: 'delivered' | 'failed';
}

/** API pública de escrita do contexto Delivery. */
export interface DeliveryWriterPort {
  create(draft: DeliveryDraft): Promise<string>;
  /** Registra o desfecho, respeitando a máquina de estados (passa por in_route). */
  markOutcome(input: DeliveryOutcomeInput): Promise<void>;
}

export const DELIVERY_WRITER = Symbol('DELIVERY_WRITER');

const DEFAULT_WINDOW_HOURS = 8;

@Injectable()
export class DeliveryWriterService implements DeliveryWriterPort {
  constructor(
    private readonly createDelivery: CreateDeliveryUseCase,
    @Inject(DELIVERY_REPOSITORY) private readonly deliveries: DeliveryRepositoryPort,
    @Inject(AUDIT_LOG) private readonly audit: AuditLogPort,
  ) {}

  async markOutcome(input: DeliveryOutcomeInput): Promise<void> {
    const delivery = await this.deliveries.findById(input.tenantId, input.deliveryId);
    if (!delivery) {
      throw new NotFoundError('Entrega não encontrada.');
    }
    const from = delivery.status;
    if (from === input.status) return;

    // Máquina de estados: o desfecho final vem de `in_route`.
    if (delivery.status === 'pending' || delivery.status === 'failed') {
      delivery.changeStatus('in_route');
    }
    delivery.changeStatus(input.status);
    await this.deliveries.save(delivery);

    await this.audit.record({
      tenantId: input.tenantId,
      actorId: input.actorId,
      action: 'delivery.outcome',
      resource: `delivery:${input.deliveryId}`,
      metadata: { from, to: input.status },
    });
  }

  async create(draft: DeliveryDraft): Promise<string> {
    const now = Date.now();
    const timeWindow =
      draft.timeWindow ?? {
        start: new Date(now).toISOString(),
        end: new Date(now + DEFAULT_WINDOW_HOURS * 3_600_000).toISOString(),
      };

    const view = await this.createDelivery.execute({
      tenantId: draft.tenantId,
      actorId: draft.actorId,
      address: {
        street: draft.street,
        number: draft.number,
        complement: draft.complement,
        city: draft.city,
        state: draft.state,
        postalCode: draft.postalCode,
        country: draft.country,
        latitude: draft.latitude,
        longitude: draft.longitude,
      },
      priority: draft.priority,
      timeWindow,
      notes: draft.notes,
    });
    return view.id;
  }
}
