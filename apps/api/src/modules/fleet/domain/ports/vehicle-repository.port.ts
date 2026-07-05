import type { PageParams } from '../../../../shared/kernel/pagination';
import type { Vehicle } from '../vehicle';

export interface PagedResult<T> {
  items: T[];
  total: number;
}

/** Port do repositório de veículos. Toda operação é escopada por `tenantId`. */
export interface VehicleRepositoryPort {
  save(vehicle: Vehicle): Promise<void>;
  findById(tenantId: string, id: string): Promise<Vehicle | null>;
  findAll(tenantId: string, page: PageParams): Promise<PagedResult<Vehicle>>;
  /** Verifica duplicidade de placa no tenant, opcionalmente excluindo um id. */
  existsByPlate(tenantId: string, plate: string, excludeId?: string): Promise<boolean>;
  delete(tenantId: string, id: string): Promise<void>;
}

export const VEHICLE_REPOSITORY = Symbol('VEHICLE_REPOSITORY');
