import { Inject, Injectable } from '@nestjs/common';
import type { Delivery as DeliveryView } from '@navix/contracts';

import { NotFoundError } from '../../../shared/kernel/domain-error';
import {
  DELIVERY_REPOSITORY,
  type DeliveryRepositoryPort,
} from '../domain/ports/delivery-repository.port';
import { toDeliveryView } from './mappers/delivery.mapper';

@Injectable()
export class GetDeliveryUseCase {
  constructor(
    @Inject(DELIVERY_REPOSITORY) private readonly deliveries: DeliveryRepositoryPort,
  ) {}

  async execute(tenantId: string, id: string): Promise<DeliveryView> {
    const delivery = await this.deliveries.findById(tenantId, id);
    if (!delivery) {
      throw new NotFoundError('Entrega não encontrada.');
    }
    return toDeliveryView(delivery);
  }
}
