import type { RedisOptions } from 'ioredis';

import type { AppConfigService } from '../../../../shared/config/app-config.service';

/** Nome da fila BullMQ dos jobs de otimização (ADR-0055). Sem `:` — o BullMQ o
 * usa como separador interno; o namespace vai no `prefix`. */
export const OPTIMIZATION_QUEUE_NAME = 'optimization';
/** Prefixo das chaves BullMQ no Redis (isola de outras chaves `navix:*`). */
export const BULL_PREFIX = 'navix:bull';

/**
 * Opções de conexão para o BullMQ. **Não** reusa o `REDIS_CLIENT` compartilhado
 * porque o BullMQ exige `maxRetriesPerRequest: null` (bloqueios longos com
 * `BRPOPLPUSH`) — incompatível com o cliente de cache/rate-limit, que falha
 * rápido (`maxRetriesPerRequest: 1`) para permitir fallback. Queue e Worker
 * criam suas próprias conexões a partir destas opções.
 */
export function bullConnection(config: AppConfigService): RedisOptions {
  const { host, port, password } = config.redis;
  return {
    host,
    port,
    password: password || undefined,
    maxRetriesPerRequest: null,
  };
}
