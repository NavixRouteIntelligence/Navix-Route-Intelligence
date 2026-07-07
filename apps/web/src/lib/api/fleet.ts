import type {
  CollectionResponse,
  CreateDriverRequest,
  CreateVehicleRequest,
  Driver,
  ResourceResponse,
  UpdateDriverRequest,
  UpdateVehicleRequest,
  Vehicle,
} from '@navix/contracts';

import { apiRequest, toQuery } from './client';

export interface PageParams {
  page?: number;
  pageSize?: number;
}

export const fleetApi = {
  listVehicles: (params: PageParams = {}) =>
    apiRequest<CollectionResponse<Vehicle>>(`/fleet/vehicles${toQuery({ ...params })}`),
  createVehicle: (body: CreateVehicleRequest) =>
    apiRequest<ResourceResponse<Vehicle>>('/fleet/vehicles', { method: 'POST', body }),
  updateVehicle: (id: string, body: UpdateVehicleRequest) =>
    apiRequest<ResourceResponse<Vehicle>>(`/fleet/vehicles/${id}`, { method: 'PATCH', body }),
  deleteVehicle: (id: string) =>
    apiRequest<void>(`/fleet/vehicles/${id}`, { method: 'DELETE' }),

  listDrivers: (params: PageParams = {}) =>
    apiRequest<CollectionResponse<Driver>>(`/fleet/drivers${toQuery({ ...params })}`),
  createDriver: (body: CreateDriverRequest) =>
    apiRequest<ResourceResponse<Driver>>('/fleet/drivers', { method: 'POST', body }),
  updateDriver: (id: string, body: UpdateDriverRequest) =>
    apiRequest<ResourceResponse<Driver>>(`/fleet/drivers/${id}`, { method: 'PATCH', body }),
  deleteDriver: (id: string) =>
    apiRequest<void>(`/fleet/drivers/${id}`, { method: 'DELETE' }),
};
