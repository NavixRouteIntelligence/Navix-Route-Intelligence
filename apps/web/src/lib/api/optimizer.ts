import type { CollectionResponse, ResourceResponse, RoutePlan } from '@navix/contracts';

import { apiRequest, toQuery } from './client';

/**
 * Leitura dos planos de rota preparados pela IA. O gatilho manual de otimização
 * foi removido (ADR-0074/0077): a IA prepara as rotas na importação, então aqui
 * só se **consultam** os resultados — não há mais `optimize`/`optimizeAndWait`.
 */
export const optimizerApi = {
  listPlans: (params: { page?: number; pageSize?: number } = {}) =>
    apiRequest<CollectionResponse<RoutePlan>>(`/route-plans${toQuery({ ...params })}`),
  getPlan: (id: string) => apiRequest<ResourceResponse<RoutePlan>>(`/route-plans/${id}`),
};
