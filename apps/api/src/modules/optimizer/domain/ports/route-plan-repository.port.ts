import type { PagedResult, PageParams } from '../../../../shared/kernel/pagination';
import type { RoutePlan } from '../route-plan';

/** Port do repositório de route plans. Escopado por `tenantId`. */
export interface RoutePlanRepositoryPort {
  save(plan: RoutePlan): Promise<void>;
  findById(tenantId: string, id: string): Promise<RoutePlan | null>;
  findAll(tenantId: string, page: PageParams): Promise<PagedResult<RoutePlan>>;
}

export const ROUTE_PLAN_REPOSITORY = Symbol('ROUTE_PLAN_REPOSITORY');
