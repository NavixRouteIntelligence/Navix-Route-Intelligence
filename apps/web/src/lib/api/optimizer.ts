import type {
  CollectionResponse,
  OptimizationJob,
  OptimizationJobAccepted,
  OptimizeRouteRequest,
  ResourceResponse,
  RoutePlan,
} from '@navix/contracts';

import { apiRequest, ApiError, toQuery } from './client';

const POLL_INTERVAL_MS = 1000;
const POLL_TIMEOUT_MS = 90_000;

export const optimizerApi = {
  /** Enfileira a otimização (assíncrono): responde 202 + jobId (ADR-0007). */
  optimize: (body: OptimizeRouteRequest) =>
    apiRequest<ResourceResponse<OptimizationJobAccepted>>('/route-plans', { method: 'POST', body }),
  /** Idem, com escopo de motorista (papel `driver`). */
  optimizeMine: (body: OptimizeRouteRequest) =>
    apiRequest<ResourceResponse<OptimizationJobAccepted>>('/route-plans/mine', {
      method: 'POST',
      body,
    }),
  /** Consulta o status de um job de otimização (polling). */
  getJob: (jobId: string) =>
    apiRequest<ResourceResponse<OptimizationJob>>(`/route-plans/jobs/${jobId}`),
  listPlans: (params: { page?: number; pageSize?: number } = {}) =>
    apiRequest<CollectionResponse<RoutePlan>>(`/route-plans${toQuery({ ...params })}`),
  getPlan: (id: string) => apiRequest<ResourceResponse<RoutePlan>>(`/route-plans/${id}`),

  /**
   * Compatibilidade: enfileira e **aguarda** (polling) o job concluir, devolvendo
   * o Route Plan pronto — mesmo shape do fluxo síncrono anterior. Quando houver
   * WebSocket, troca-se o polling por push sem mudar os chamadores.
   */
  async optimizeAndWait(
    body: OptimizeRouteRequest,
    opts: { mine?: boolean } = {},
  ): Promise<ResourceResponse<RoutePlan>> {
    const { data: accepted } = opts.mine
      ? await optimizerApi.optimizeMine(body)
      : await optimizerApi.optimize(body);

    const deadline = Date.now() + POLL_TIMEOUT_MS;
    for (;;) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      const { data: job } = await optimizerApi.getJob(accepted.jobId);
      if (job.status === 'succeeded' && job.routePlanId) {
        return optimizerApi.getPlan(job.routePlanId);
      }
      if (job.status === 'failed') {
        throw new ApiError(job.error ?? 'Falha na otimização.', 422, 'UNPROCESSABLE');
      }
      if (Date.now() > deadline) {
        throw new ApiError('Tempo de otimização excedido.', 504);
      }
    }
  },
};
