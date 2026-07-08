import type {
  DriverPositionView,
  PositionHistoryResponse,
  PositionUpdateRequest,
} from '@navix/contracts';

import { apiRequest } from './client';

export const trackingApi = {
  /** Motorista envia a própria posição. */
  update: (body: PositionUpdateRequest) =>
    apiRequest<{ data: DriverPositionView }>('/tracking/positions', { method: 'POST', body }),

  /** Última posição do próprio motorista. */
  myLatest: () => apiRequest<{ data: DriverPositionView | null }>('/tracking/me/latest'),

  /** Visão de frota (empresa): última posição de cada motorista. */
  fleetLatest: () => apiRequest<{ data: DriverPositionView[] }>('/tracking/positions/latest'),

  /** Histórico de um motorista (empresa). */
  driverHistory: (driverId: string) =>
    apiRequest<PositionHistoryResponse>(`/tracking/drivers/${driverId}/history`),
};
