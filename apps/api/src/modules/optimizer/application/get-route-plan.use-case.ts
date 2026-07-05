import { Inject, Injectable } from '@nestjs/common';
import type { RoutePlan as RoutePlanView } from '@navix/contracts';

import { NotFoundError } from '../../../shared/kernel/domain-error';
import {
  ROUTE_PLAN_REPOSITORY,
  type RoutePlanRepositoryPort,
} from '../domain/ports/route-plan-repository.port';
import { toRoutePlanView } from './route-plan.mapper';

@Injectable()
export class GetRoutePlanUseCase {
  constructor(
    @Inject(ROUTE_PLAN_REPOSITORY) private readonly plans: RoutePlanRepositoryPort,
  ) {}

  async execute(tenantId: string, id: string): Promise<RoutePlanView> {
    const plan = await this.plans.findById(tenantId, id);
    if (!plan) {
      throw new NotFoundError('Route plan não encontrado.');
    }
    return toRoutePlanView(plan);
  }
}
