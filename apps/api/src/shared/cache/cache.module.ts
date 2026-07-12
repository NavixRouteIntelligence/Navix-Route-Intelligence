import { Global, Module } from '@nestjs/common';

import { RedisModule } from '../redis/redis.module';
import { CACHE } from './cache.port';
import { RedisCache } from './redis-cache';

/**
 * Disponibiliza o `CachePort` (implementação Redis) para toda a aplicação.
 * Ainda **não é consumido** por nenhum módulo — infraestrutura preparada para os
 * casos previstos (matriz de distância, geocodificação — docs/database.md §6),
 * sem alterar o comportamento atual.
 */
@Global()
@Module({
  imports: [RedisModule],
  providers: [{ provide: CACHE, useClass: RedisCache }],
  exports: [CACHE],
})
export class CacheModule {}
