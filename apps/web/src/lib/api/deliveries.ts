import type {
  CollectionResponse,
  CreateDeliveryRequest,
  Delivery,
  DeliveryPriority,
  DeliveryStatus,
  ResourceResponse,
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
};
