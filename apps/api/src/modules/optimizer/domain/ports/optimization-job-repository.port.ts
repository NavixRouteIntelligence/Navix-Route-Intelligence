import type {
  EconomyMode,
  OptimizationJobStatus,
  OptimizationStopInput,
  OptimizationStrategyName,
  OptimizationVehicleInput,
  OriginInput,
} from '@navix/contracts';

/** Requisição de otimização persistida no job (o comando, sem o `tenantId`). */
export interface OptimizationJobRequest {
  actorId: string;
  origin?: OriginInput | null;
  deliveryIds?: string[];
  stops?: OptimizationStopInput[];
  strategy?: OptimizationStrategyName;
  averageSpeedKmh?: number;
  serviceTimeMinutes?: number;
  economyMode?: EconomyMode;
  vehicle?: OptimizationVehicleInput;
  vehicles?: OptimizationVehicleInput[];
}

/** Registro de um job de otimização. */
export interface OptimizationJobRecord {
  id: string;
  tenantId: string;
  status: OptimizationJobStatus;
  request: OptimizationJobRequest;
  routePlanId: string | null;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface OptimizationJobUpdate {
  status: OptimizationJobStatus;
  routePlanId?: string | null;
  error?: string | null;
}

export interface OptimizationJobRepositoryPort {
  create(record: Omit<OptimizationJobRecord, 'createdAt' | 'updatedAt'>): Promise<void>;
  findById(tenantId: string, id: string): Promise<OptimizationJobRecord | null>;
  update(id: string, patch: OptimizationJobUpdate): Promise<void>;
}

export const OPTIMIZATION_JOB_REPOSITORY = Symbol('OPTIMIZATION_JOB_REPOSITORY');
