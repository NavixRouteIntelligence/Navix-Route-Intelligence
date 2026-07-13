import { Inject, Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';

import { REDIS_CLIENT } from '../redis/redis.constants';
import type { CachePort } from './cache.port';

/**
 * Implementação de `CachePort` sobre Redis, com **degradação graciosa**: qualquer
 * indisponibilidade do Redis é tratada como cache miss / no-op, de modo que ligar
 * o cache nunca altera o resultado de negócio (só a latência). Valores são
 * serializados em JSON e as chaves recebem um prefixo de namespace.
 */
@Injectable()
export class RedisCache implements CachePort {
  private readonly prefix = 'navix:cache:';

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  private key(key: string): string {
    return this.prefix + key;
  }

  private get ready(): boolean {
    return this.redis.status === 'ready';
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.ready) return null;
    try {
      const raw = await this.redis.get(this.key(key));
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    if (!this.ready) return;
    try {
      const payload = JSON.stringify(value);
      if (ttlSeconds && ttlSeconds > 0) {
        await this.redis.set(this.key(key), payload, 'EX', ttlSeconds);
      } else {
        await this.redis.set(this.key(key), payload);
      }
    } catch {
      // Best-effort: falha de escrita não quebra o fluxo.
    }
  }

  async del(key: string): Promise<void> {
    if (!this.ready) return;
    try {
      await this.redis.del(this.key(key));
    } catch {
      // Best-effort.
    }
  }

  async getOrSet<T>(key: string, ttlSeconds: number, factory: () => Promise<T>): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;
    const value = await factory();
    await this.set(key, value, ttlSeconds);
    return value;
  }
}
