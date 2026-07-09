import { Inject, Injectable } from '@nestjs/common';

import {
  DELIVERY_WRITER,
  type DeliveryWriterPort,
} from '../../../delivery/application/delivery-writer.service';
import type { DeliveryOutcomePort } from '../../domain/ports/pod-repository.port';

/** Adapta a API pública do Delivery (DELIVERY_WRITER) à porta do POD. */
@Injectable()
export class DeliveryOutcomeGateway implements DeliveryOutcomePort {
  constructor(@Inject(DELIVERY_WRITER) private readonly delivery: DeliveryWriterPort) {}

  markOutcome(input: {
    tenantId: string;
    actorId: string;
    deliveryId: string;
    status: 'delivered' | 'failed';
  }): Promise<void> {
    return this.delivery.markOutcome(input);
  }
}
