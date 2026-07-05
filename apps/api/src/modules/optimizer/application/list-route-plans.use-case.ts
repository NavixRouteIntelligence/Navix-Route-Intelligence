import { Inject, Injectable } from '@nestjs/common';
import type { RoutePlan as RoutePlanView } from '@navix/contracts';

import { normalizePage, type PageParams } from '../../../shared/kernel/pagination';
import {
  ROUTE_PLAN_REPOSITORY,
  type RoutePlanRepositoryPort,
} from '../domain/ports/route-plan-repository.port';
import { toRoutePlanView } from './route-plan.mapper';

export interface ListRoutePlansResult {
  items: RoutePlanView[];
  total: number;
  page: PageParams;
}

@Injectable()
export class ListRoutePlansUseCase {
  constructor(
    @Inject(ROUTE_PLAN_REPOSITORY) private readonly plans: RoutePlanRepositoryPort,
  ) {}

  async execute(tenantId: string, page?: number, pageSize?: number): Promise<ListRoutePlansResult> {
    const params = normalizePage(page, pageSize);
    const { items, total } = await this.plans.findAll(tenantId, params);
    return { items: items.map(toRoutePlanView), total, page: params };
  }
}
