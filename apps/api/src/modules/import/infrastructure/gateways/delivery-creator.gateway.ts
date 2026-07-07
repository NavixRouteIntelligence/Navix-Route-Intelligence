import { Inject, Injectable } from '@nestjs/common';

import {
  DELIVERY_WRITER,
  type DeliveryWriterPort,
} from '../../../delivery/application/delivery-writer.service';
import type {
  CreateDeliveryData,
  DeliveryCreatorPort,
} from '../../domain/ports/delivery-creator.port';

/** Adaptador anti-corrupção: cria entregas via API pública do Delivery. */
@Injectable()
export class DeliveryCreatorGateway implements DeliveryCreatorPort {
  constructor(@Inject(DELIVERY_WRITER) private readonly writer: DeliveryWriterPort) {}

  create(data: CreateDeliveryData): Promise<string> {
    return this.writer.create(data);
  }
}
