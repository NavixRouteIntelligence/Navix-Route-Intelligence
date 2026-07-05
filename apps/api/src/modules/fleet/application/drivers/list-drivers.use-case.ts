import { Inject, Injectable } from '@nestjs/common';
import type { Driver as DriverView } from '@navix/contracts';

import { normalizePage, type PageParams } from '../../../../shared/kernel/pagination';
import {
  DRIVER_REPOSITORY,
  type DriverRepositoryPort,
} from '../../domain/ports/driver-repository.port';
import { toDriverView } from '../mappers/driver.mapper';

export interface ListDriversResult {
  items: DriverView[];
  total: number;
  page: PageParams;
}

@Injectable()
export class ListDriversUseCase {
  constructor(
    @Inject(DRIVER_REPOSITORY) private readonly drivers: DriverRepositoryPort,
  ) {}

  async execute(tenantId: string, page?: number, pageSize?: number): Promise<ListDriversResult> {
    const params = normalizePage(page, pageSize);
    const { items, total } = await this.drivers.findAll(tenantId, params);
    return { items: items.map(toDriverView), total, page: params };
  }
}
