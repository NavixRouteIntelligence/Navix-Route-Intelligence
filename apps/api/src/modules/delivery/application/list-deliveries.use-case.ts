import { Inject, Injectable } from '@nestjs/common';
import type { Delivery as DeliveryView } from '@navix/contracts';

import type { PageParams } from '../../../shared/kernel/pagination';
import {
  DELIVERY_REPOSITORY,
  type DeliveryRepositoryPort,
} from '../domain/ports/delivery-repository.port';
import { toDeliveryView } from './mappers/delivery.mapper';
import type { ListDeliveriesQuery } from './queries/list-deliveries.query';

export interface ListDeliveriesResult {
  items: DeliveryView[];
  total: number;
  page: PageParams;
}

@Injectable()
export class ListDeliveriesUseCase {
  constructor(
    @Inject(DELIVERY_REPOSITORY) private readonly deliveries: DeliveryRepositoryPort,
  ) {}

  async execute(tenantId: string, query: ListDeliveriesQuery): Promise<ListDeliveriesResult> {
    const { items, total } = await this.deliveries.findAll(tenantId, query);
    return { items: items.map(toDeliveryView), total, page: query.page };
  }
}
