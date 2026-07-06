import { AsyncLocalStorage } from 'node:async_hooks';

import type { EntityManager, ObjectLiteral, Repository } from 'typeorm';

/**
 * Contexto de transação por request. Guarda o EntityManager da transação aberta
 * pelo TenantTransactionInterceptor, na qual `app.current_tenant` já foi definido
 * (RLS). Repositórios resolvem o manager daqui para que a RLS seja aplicada.
 */
export const transactionContext = new AsyncLocalStorage<EntityManager>();

/**
 * Retorna o repositório ligado à transação do request (com tenant definido)
 * quando há uma; caso contrário, o repositório padrão do pool (ex.: migrações,
 * seed, fluxos públicos de auth).
 */
export function scopedRepository<E extends ObjectLiteral>(base: Repository<E>): Repository<E> {
  const manager = transactionContext.getStore();
  return manager ? manager.getRepository<E>(base.target) : base;
}
