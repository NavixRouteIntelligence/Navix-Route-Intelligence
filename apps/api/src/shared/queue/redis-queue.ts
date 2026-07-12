import { Inject, Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';

import { REDIS_CLIENT } from '../redis/redis.constants';
import type { QueueJobOptions, QueuePort } from './queue.port';

/**
 * Produtor de filas mínimo sobre Redis (`LPUSH` numa lista por fila). É um
 * **placeholder** para viabilizar o padrão desde já; a implementação definitiva
 * será **BullMQ** (ADR-0006/0007). Diferente do cache, o enfileiramento **não**
 * degrada em silêncio: perder um job seria pior que falhar — o erro do Redis
 * propaga para quem chama decidir (retry, outbox, etc.).
 *
 * Ainda não há produtores nem consumidores reais ligados a esta port.
 */
@Injectable()
export class RedisQueue implements QueuePort {
  private readonly prefix = 'navix:queue:';

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async enqueue<T>(queue: string, payload: T, options?: QueueJobOptions): Promise<void> {
    const job = JSON.stringify({
      payload,
      options: options ?? {},
      enqueuedAt: new Date().toISOString(),
    });
    await this.redis.lpush(this.prefix + queue, job);
  }
}
