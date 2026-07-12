import { Global, Module } from '@nestjs/common';

import { RedisModule } from '../redis/redis.module';
import { QUEUE } from './queue.port';
import { RedisQueue } from './redis-queue';

/**
 * Disponibiliza o `QueuePort` (produtor Redis) para toda a aplicação. Ainda
 * **não é consumido** — infraestrutura preparada para o trabalho assíncrono das
 * próximas fases (docs/architecture.md §8), sem alterar o comportamento atual.
 */
@Global()
@Module({
  imports: [RedisModule],
  providers: [{ provide: QUEUE, useClass: RedisQueue }],
  exports: [QUEUE],
})
export class QueueModule {}
