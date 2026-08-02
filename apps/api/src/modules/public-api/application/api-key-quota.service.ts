import { Inject, Injectable, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';

import { REDIS_CLIENT } from '../../../shared/redis/redis.constants';

interface LocalWindow {
  hits: number;
  resetAt: number;
}

@Injectable()
export class ApiKeyQuotaService {
  private readonly logger = new Logger(ApiKeyQuotaService.name);
  private readonly fallback = new Map<string, LocalWindow>();
  private warned = false;

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async consume(
    keyId: string,
    limit: number,
  ): Promise<{ allowed: boolean; remaining: number; reset: number }> {
    const now = Date.now();
    const minute = Math.floor(now / 60_000);
    const reset = (minute + 1) * 60;
    if (this.redis.status === 'ready') {
      try {
        const key = `navix:public-api:${keyId}:${minute}`;
        const [hits] = (await this.redis.multi().incr(key).expire(key, 65).exec()) as [
          [Error | null, number],
          [Error | null, number],
        ];
        if (hits[0]) throw hits[0];
        this.warned = false;
        return { allowed: hits[1] <= limit, remaining: Math.max(0, limit - hits[1]), reset };
      } catch (error) {
        if (!this.warned) {
          this.logger.warn(
            `Quota distribuída indisponível; usando fallback local: ${String(error)}`,
          );
          this.warned = true;
        }
      }
    }
    const current = this.fallback.get(keyId);
    const window =
      !current || current.resetAt <= now ? { hits: 0, resetAt: (minute + 1) * 60_000 } : current;
    window.hits += 1;
    this.fallback.set(keyId, window);
    return { allowed: window.hits <= limit, remaining: Math.max(0, limit - window.hits), reset };
  }
}
