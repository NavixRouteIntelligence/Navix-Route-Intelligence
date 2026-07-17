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
  /**
   * Reivindica um job para processamento de forma **atômica**: transiciona
   * `queued` → `running` só se ainda estiver `queued`. Retorna `true` para quem
   * venceu a corrida (deve processar) e `false` se outro consumidor já assumiu.
   * Base para processamento **seguro sob concorrência** / múltiplas instâncias
   * (ADR-0041).
   */
  claim(id: string): Promise<boolean>;
  /**
   * Devolve um job **preso em `running`** para `queued`, para reprocessamento.
   * Usado quando o worker que o reivindicou morreu e o BullMQ redelivera o job
   * (o `claim` sozinho barraria o retry, pois o status já saiu de `queued`).
   * Transiciona só `running` → `queued`; retorna `true` se algo foi resetado.
   * Escopo de tenant preservado (a operação corre dentro do contexto do job).
   */
  resetForRetry(id: string): Promise<boolean>;
}

export const OPTIMIZATION_JOB_REPOSITORY = Symbol('OPTIMIZATION_JOB_REPOSITORY');
