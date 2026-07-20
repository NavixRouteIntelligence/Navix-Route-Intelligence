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
/**
 * Capacidade física de referência por tipo de veículo (kg, m³). **Fonte única**
 * (ADR-0042): consumida pelo `VehicleProfile` do otimizador e pelo `LoadPlanner`
 * da Intelligence, eliminando a duplicação entre módulos. Vive em `contracts`
 * (dependência comum), sem acoplar os módulos de negócio um ao outro.
 */
export const VEHICLE_CAPACITY_DEFAULTS: Record<VehicleType, { weightKg: number; volumeM3: number }> = {
  bicycle: { weightKg: 15, volumeM3: 0.1 },
  motorcycle: { weightKg: 30, volumeM3: 0.2 },
  car: { weightKg: 400, volumeM3: 1.5 },
  van: { weightKg: 1200, volumeM3: 8 },
  truck: { weightKg: 12000, volumeM3: 40 },
};

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
  /** Hodômetro atual (km). Base dos lembretes por quilometragem (FASE 3). */
  odometerKm: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateVehicleRequest {
  plate: string;
  type: VehicleType;
  capacity: number;
  status?: VehicleStatus;
  odometerKm?: number;
}

export interface UpdateVehicleRequest {
  plate?: string;
  type?: VehicleType;
  capacity?: number;
  status?: VehicleStatus;
  odometerKm?: number;
}

// ---------- Manutenção do veículo (FASE 3, V1) ----------

/**
 * Tipo de manutenção/registro do veículo. Cobre os itens de gestão do motorista
 * autônomo: troca de óleo, revisões, pneus, seguro, IPO (inspeção obrigatória),
 * outras inspeções. `other` para itens fora da lista.
 */
export type MaintenanceType =
  | 'oil_change'
  | 'revision'
  | 'tires'
  | 'insurance'
  | 'inspection'
  | 'ipo'
  | 'other';

export const MAINTENANCE_TYPES: readonly MaintenanceType[] = [
  'oil_change',
  'revision',
  'tires',
  'insurance',
  'inspection',
  'ipo',
  'other',
];

/**
 * Registro de manutenção de um veículo. O próximo vencimento pode ser por
 * **data** (seguro, IPO) e/ou por **quilometragem** (óleo, pneus). Valores
 * monetários em euros (2 casas). Datas em ISO (YYYY-MM-DD).
 */
export interface MaintenanceRecord {
  id: string;
  tenantId: string;
  vehicleId: string;
  type: MaintenanceType;
  /** Data em que a manutenção foi feita (ISO date). */
  performedAt: string;
  /** Hodômetro no momento do serviço (km). */
  odometerKm: number | null;
  /** Custo do serviço (€). */
  cost: number | null;
  notes: string | null;
  /** Próximo vencimento por data (ISO date). */
  nextDueDate: string | null;
  /** Próximo vencimento por quilometragem (km). */
  nextDueOdometerKm: number | null;
  createdAt: string;
}

export interface CreateMaintenanceRecordRequest {
  type: MaintenanceType;
  performedAt: string;
  odometerKm?: number | null;
  cost?: number | null;
  notes?: string | null;
  nextDueDate?: string | null;
  nextDueOdometerKm?: number | null;
}

/** Situação de um lembrete de manutenção (FASE 3, V2). */
export type ReminderStatus = 'overdue' | 'due_soon' | 'ok';

/**
 * Lembrete de manutenção derivado do registro mais recente de cada tipo com
 * vencimento definido. `remainingDays`/`remainingKm` são positivos quando ainda
 * falta, negativos quando venceu; `null` quando aquela dimensão não se aplica.
 */
export interface MaintenanceReminder {
  vehicleId: string;
  type: MaintenanceType;
  dueDate: string | null;
  dueOdometerKm: number | null;
  remainingDays: number | null;
  remainingKm: number | null;
  status: ReminderStatus;
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
