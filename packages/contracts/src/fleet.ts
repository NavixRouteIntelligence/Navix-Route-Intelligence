/**
 * Contratos do contexto Fleet (veículos e motoristas).
 * Ver docs/architecture.md §4 e docs/database.md §4.
 */

// ---------- Vehicle ----------

export type VehicleType = 'car' | 'van' | 'truck' | 'motorcycle' | 'bicycle';
export type VehicleStatus = 'active' | 'inactive' | 'maintenance';

export const VEHICLE_TYPES: readonly VehicleType[] = [
  'car',
  'van',
  'truck',
  'motorcycle',
  'bicycle',
];
export const VEHICLE_STATUSES: readonly VehicleStatus[] = [
  'active',
  'inactive',
  'maintenance',
];

/** Representação pública de um veículo. */
export interface Vehicle {
  id: string;
  tenantId: string;
  plate: string;
  type: VehicleType;
  /** Capacidade de carga em unidades definidas pelo tenant (ex.: kg ou volumes). */
  capacity: number;
  status: VehicleStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateVehicleRequest {
  plate: string;
  type: VehicleType;
  capacity: number;
  status?: VehicleStatus;
}

export interface UpdateVehicleRequest {
  plate?: string;
  type?: VehicleType;
  capacity?: number;
  status?: VehicleStatus;
}

// ---------- Driver ----------

export type DriverStatus = 'active' | 'inactive';

export const DRIVER_STATUSES: readonly DriverStatus[] = ['active', 'inactive'];

/** Representação pública de um motorista. */
export interface Driver {
  id: string;
  tenantId: string;
  name: string;
  licenseNumber: string;
  /** Habilidades/atributos usados na otimização (ex.: 'refrigerated', 'hazmat'). */
  skills: string[];
  status: DriverStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDriverRequest {
  name: string;
  licenseNumber: string;
  skills?: string[];
  status?: DriverStatus;
}

export interface UpdateDriverRequest {
  name?: string;
  licenseNumber?: string;
  skills?: string[];
  status?: DriverStatus;
}
