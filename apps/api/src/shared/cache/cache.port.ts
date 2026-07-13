/** Token de injeção do cache da aplicação. */
export const CACHE = Symbol('CACHE');

/**
 * Abstração de cache (Dependency Inversion). Os módulos de negócio dependem
 * desta *port*, não do Redis diretamente — a implementação pode trocar (Redis,
 * memória, outro store) sem alterar os casos de uso. Ver ADR-0002 / docs/database.md §6.
 *
 * Contrato: toda operação é **best-effort** — falhas de infraestrutura não devem
 * quebrar o fluxo de negócio (leitura vira *miss*, escrita vira *no-op*).
 */
export interface CachePort {
  /** Retorna o valor ou `null` se ausente/indisponível. */
  get<T>(key: string): Promise<T | null>;
  /** Grava o valor com TTL opcional (segundos). */
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  /** Remove a chave. */
  del(key: string): Promise<void>;
  /**
   * Retorna o valor em cache; se ausente, executa `factory`, grava e retorna.
   * Em falha de cache, executa `factory` normalmente (sem quebrar o fluxo).
   */
  getOrSet<T>(key: string, ttlSeconds: number, factory: () => Promise<T>): Promise<T>;
}
