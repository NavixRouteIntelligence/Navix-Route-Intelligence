import { Global, Module } from '@nestjs/common';

import { RedisModule } from '../redis/redis.module';
import { CACHE } from './cache.port';
import { RedisCache } from './redis-cache';

/**
 * Disponibiliza o `CachePort` (implementação Redis) para toda a aplicação.
 * Consumido pelo cache de matriz de roteamento; falhas continuam degradando para
 * a chamada do provedor sem alterar o resultado de negócio.
 */
@Global()
@Module({
  imports: [RedisModule],
  providers: [{ provide: CACHE, useClass: RedisCache }],
  exports: [CACHE],
})
export class CacheModule {}
