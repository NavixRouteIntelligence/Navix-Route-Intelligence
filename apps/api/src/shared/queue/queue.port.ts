/** Token de injeção do produtor de filas. */
export const QUEUE = Symbol('QUEUE');

/** Opções de enfileiramento (subconjunto compatível com BullMQ no futuro). */
export interface QueueJobOptions {
  /** Atraso antes do job ficar disponível para consumo (ms). */
  delayMs?: number;
  /** Número de tentativas em caso de falha do consumidor. */
  attempts?: number;
}

/**
 * Abstração de fila (Dependency Inversion) para trabalho assíncrono — otimização,
 * reotimização, notificações, relay do outbox (ADR-0006/0007, docs/architecture.md §8).
 *
 * Contrato **produtor**. A implementação atual (Redis) é um placeholder mínimo; a
 * evolução para **BullMQ** (com consumidores, retry/backoff e dead-letter) troca a
 * implementação atrás desta port, sem alterar quem enfileira.
 */
export interface QueuePort {
  /** Publica um job numa fila nomeada. */
  enqueue<T>(queue: string, payload: T, options?: QueueJobOptions): Promise<void>;
}
