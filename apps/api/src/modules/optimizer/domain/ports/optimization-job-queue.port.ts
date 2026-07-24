/**
 * Fila de processamento de jobs de otimização. A implementação atual é
 * **in-process** (mesmo processo, assíncrono); o contrato permite trocar por
 * BullMQ/worker dedicado (ADR-0007) sem alterar os casos de uso.
 */
export interface OptimizationJobQueuePort {
  /**
   * Agenda o processamento assíncrono de um job já persistido.
   *
   * **Rejeita se não conseguiu agendar.** Quem chama enfileira dentro da
   * transação do request, então uma rejeição desfaz a criação do job — melhor
   * um erro imediato para o cliente do que uma linha `queued` que ninguém vai
   * processar (ver ADR-0081).
   */
  enqueue(jobId: string, tenantId: string): Promise<void>;
}

export const OPTIMIZATION_JOB_QUEUE = Symbol('OPTIMIZATION_JOB_QUEUE');
