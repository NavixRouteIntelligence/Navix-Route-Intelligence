/**
 * Fila de processamento de jobs de otimização. A implementação atual é
 * **in-process** (mesmo processo, assíncrono); o contrato permite trocar por
 * BullMQ/worker dedicado (ADR-0007) sem alterar os casos de uso.
 */
export interface OptimizationJobQueuePort {
  /** Agenda o processamento assíncrono de um job já persistido. */
  enqueue(jobId: string, tenantId: string): void;
}

export const OPTIMIZATION_JOB_QUEUE = Symbol('OPTIMIZATION_JOB_QUEUE');
