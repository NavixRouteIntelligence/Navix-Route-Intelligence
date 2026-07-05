import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Contexto de tenant resolvido por requisição a partir do JWT.
 * Propagado via AsyncLocalStorage para que qualquer camada (repositórios,
 * serviços) acesse o tenant atual sem passá-lo manualmente em cada chamada.
 *
 * Regra inegociável: nenhum caso de uso acessa dados sem um tenantId válido
 * (ver docs/architecture.md §6 e docs/security.md §3).
 */
export interface TenantContext {
  tenantId: string;
  userId: string;
  roles: string[];
}

const storage = new AsyncLocalStorage<TenantContext>();

export const TenantContextStore = {
  run<T>(context: TenantContext, callback: () => T): T {
    return storage.run(context, callback);
  },

  get(): TenantContext | undefined {
    return storage.getStore();
  },

  /** Retorna o tenant atual ou lança se ausente (uso interno de guardas). */
  require(): TenantContext {
    const ctx = storage.getStore();
    if (!ctx) {
      throw new Error('TenantContext ausente: requisição fora de escopo de tenant.');
    }
    return ctx;
  },
};
