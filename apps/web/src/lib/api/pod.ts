import type {
  CollectionResponse,
  CreatePodRequest,
  PodSummary,
  ProofOfDeliveryView,
} from '@navix/contracts';

import { apiRequest, toQuery } from './client';

export const podApi = {
  /** Registra o comprovante e aplica o desfecho na entrega. */
  submit: (body: CreatePodRequest) =>
    apiRequest<ProofOfDeliveryView>('/pod', { method: 'POST', body }),

  /** Comprovante de uma entrega (ou null). */
  byDelivery: (deliveryId: string) =>
    apiRequest<{ data: ProofOfDeliveryView | null }>(`/pod/${deliveryId}`),

  /** Histórico de comprovantes. */
  list: (params: { page?: number; pageSize?: number } = {}) =>
    apiRequest<CollectionResponse<ProofOfDeliveryView>>(`/pod${toQuery({ ...params })}`),

  /** Resumo por status (Dashboard). */
  summary: () => apiRequest<PodSummary>('/pod/summary'),
};
