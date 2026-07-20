import type { MaintenanceRecord } from '../maintenance-record';

/** Port do repositório de manutenção. Toda operação é escopada por `tenantId`. */
export interface MaintenanceRepositoryPort {
  save(record: MaintenanceRecord): Promise<void>;
  findById(tenantId: string, id: string): Promise<MaintenanceRecord | null>;
  /** Registros de um veículo, mais recentes primeiro. */
  findByVehicle(tenantId: string, vehicleId: string): Promise<MaintenanceRecord[]>;
  delete(tenantId: string, id: string): Promise<void>;
}

export const MAINTENANCE_REPOSITORY = Symbol('MAINTENANCE_REPOSITORY');
