import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule, ThrottlerStorageService } from '@nestjs/throttler';
import { Redis } from 'ioredis';

import { REDIS_CLIENT } from '../redis/redis.constants';
import { RedisModule } from '../redis/redis.module';
import { ThrottlerStorageRedis } from './throttler-storage-redis';

/**
 * Rate limiting global (ver docs/security.md §7). Limite padrão amplo aplicado
 * a toda a API; endpoints sensíveis (login/refresh) recebem limites estritos via
 * @Throttle no controller.
 *
 * Armazenamento em **Redis** (contagem compartilhada entre instâncias — ADR-0014),
 * com **fallback** transparente para memória quando o Redis está indisponível.
 * Os limites são os mesmos de antes — só o backend de contagem mudou.
 */
@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      imports: [RedisModule],
      inject: [REDIS_CLIENT],
      useFactory: (redis: Redis) => ({
        throttlers: [
          {
            name: 'default',
            ttl: 60_000, // 1 min
            limit: 120,
          },
        ],
        storage: new ThrottlerStorageRedis(redis, new ThrottlerStorageService()),
      }),
    }),
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class ThrottlingModule {}
