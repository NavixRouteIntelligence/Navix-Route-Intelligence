import { Inject, Injectable } from '@nestjs/common';
import { HealthIndicator, type HealthIndicatorResult } from '@nestjs/terminus';
import type { Redis } from 'ioredis';

import { REDIS_CLIENT } from '../../shared/redis/redis.constants';

/**
 * Indicador de saúde do Redis — **não fatal por design**. O Redis é uma
 * dependência degradável (rate limiting cai para memória, cache vira miss — ver
 * RedisModule), então sua indisponibilidade **não** deve tirar a instância de
 * rotação (`/ready` continua 200). Reportamos `up` sempre, com o detalhe
 * `connection: up|degraded` para dashboards/alertas enxergarem o modo degradado.
 */
@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {
    super();
  }

  async check(key = 'redis'): Promise<HealthIndicatorResult> {
    let connection = 'degraded';
    try {
      connection = (await this.redis.ping()) === 'PONG' ? 'up' : 'degraded';
    } catch {
      connection = 'degraded';
    }
    // Sempre "up": a aplicação serve mesmo com Redis fora (fallback).
    return this.getStatus(key, true, { connection });
  }
}
