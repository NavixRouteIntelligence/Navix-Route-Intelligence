import type {
  CollectionResponse,
  CreateDeliveryRequest,
  Delivery,
  DeliveryPriority,
  DeliveryStatus,
  ResourceResponse,
  SyncParams,
  SyncResponse,
  TrackingLinkResponse,
  UpdateDeliveryRequest,
} from '@navix/contracts';

import { apiRequest, toQuery } from './client';

export interface DeliveryListParams {
  page?: number;
  pageSize?: number;
  status?: DeliveryStatus;
  priority?: DeliveryPriority;
  sort?: string;
}

export const deliveriesApi = {
  list: (params: DeliveryListParams = {}) =>
    apiRequest<CollectionResponse<Delivery>>(`/deliveries${toQuery({ ...params })}`),
  /**
   * Sincronização incremental (offline-first, ADR-0020). Devolve só o que mudou
   * desde `updatedSince` (mais tombstones via `deletedAt`), paginado por `cursor`.
   */
  sync: (params: SyncParams = {}) =>
    apiRequest<SyncResponse<Delivery>>(`/deliveries/sync${toQuery({ ...params })}`),
  get: (id: string) => apiRequest<ResourceResponse<Delivery>>(`/deliveries/${id}`),
  create: (body: CreateDeliveryRequest) =>
    apiRequest<ResourceResponse<Delivery>>('/deliveries', { method: 'POST', body }),
  update: (id: string, body: UpdateDeliveryRequest) =>
    apiRequest<ResourceResponse<Delivery>>(`/deliveries/${id}`, { method: 'PATCH', body }),
  changeStatus: (id: string, status: DeliveryStatus) =>
    apiRequest<ResourceResponse<Delivery>>(`/deliveries/${id}/status`, {
      method: 'PATCH',
      body: { status },
    }),
  remove: (id: string) => apiRequest<void>(`/deliveries/${id}`, { method: 'DELETE' }),
  /**
   * Emite (ou recupera) o link público de rastreamento do destinatário
   * (ADR-0082). É idempotente no backend: chamar de novo devolve o link
   * vigente, então reenviar o link a quem já o recebeu não o invalida.
   */
  trackingLink: (id: string) =>
    apiRequest<ResourceResponse<TrackingLinkResponse>>(`/deliveries/${id}/tracking-link`, {
      method: 'POST',
    }),
};
