import type {
  CollectionResponse,
  OptimizeRouteRequest,
  ResourceResponse,
  RoutePlan,
} from '@navix/contracts';

import { apiRequest, toQuery } from './client';

export const optimizerApi = {
  optimize: (body: OptimizeRouteRequest) =>
    apiRequest<ResourceResponse<RoutePlan>>('/route-plans', { method: 'POST', body }),
  /** Otimização com escopo de motorista (mesmo motor, papel `driver`). */
  optimizeMine: (body: OptimizeRouteRequest) =>
    apiRequest<ResourceResponse<RoutePlan>>('/route-plans/mine', { method: 'POST', body }),
  listPlans: (params: { page?: number; pageSize?: number } = {}) =>
    apiRequest<CollectionResponse<RoutePlan>>(`/route-plans${toQuery({ ...params })}`),
  getPlan: (id: string) => apiRequest<ResourceResponse<RoutePlan>>(`/route-plans/${id}`),
};
