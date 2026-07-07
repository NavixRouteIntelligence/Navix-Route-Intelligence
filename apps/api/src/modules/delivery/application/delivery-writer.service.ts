import { Injectable } from '@nestjs/common';
import type { DeliveryPriority } from '@navix/contracts';

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

/** API pública de escrita do contexto Delivery. */
export interface DeliveryWriterPort {
  create(draft: DeliveryDraft): Promise<string>;
}

export const DELIVERY_WRITER = Symbol('DELIVERY_WRITER');

const DEFAULT_WINDOW_HOURS = 8;

@Injectable()
export class DeliveryWriterService implements DeliveryWriterPort {
  constructor(private readonly createDelivery: CreateDeliveryUseCase) {}

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
