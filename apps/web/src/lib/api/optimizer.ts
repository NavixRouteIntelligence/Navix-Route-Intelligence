import type {
  CollectionResponse,
  DeliveryDistribution,
  FleetDistribution,
  ResourceResponse,
  RoutePlan,
} from '@navix/contracts';

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

  /**
   * Rota vigente do **próprio** motorista (ADR-0098).
   *
   * Substitui o `listPlans({ pageSize: 1 })` que a tela do motorista usava: o
   * mais recente do tenant não é "a minha rota" quando o tenant tem frota.
   */
  myActivePlan: () =>
    apiRequest<ResourceResponse<RoutePlan | null>>('/route-plans/mine/active'),

  /**
   * Distribui as entregas sem motorista entre a frota e prepara a rota de cada
   * um (ADR-0101). Idempotente: só toca no que está sem dono, então repetir a
   * chamada não redistribui nem desfaz ajuste manual.
   */
  distribute: () =>
    apiRequest<ResourceResponse<DeliveryDistribution>>('/route-plans/distribute', {
      method: 'POST',
    }),

  /**
   * Retrato da distribuição atual da frota (ADR-0101): uma linha por motorista
   * ativo — inclusive quem está sem nada — mais o que ainda não tem dono. Vem
   * agregado do servidor, e não de somar listas paginadas aqui (ADR-0092).
   */
  fleetDistribution: () =>
    apiRequest<ResourceResponse<FleetDistribution>>('/route-plans/distribution'),
};
