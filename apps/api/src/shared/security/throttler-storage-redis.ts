import { Logger } from '@nestjs/common';
import { ThrottlerStorage, ThrottlerStorageService } from '@nestjs/throttler';
// `ThrottlerStorageRecord` não é reexportado no index do pacote (v6).
import type { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface';
import { Redis } from 'ioredis';

/**
 * Contagem + bloqueio atômicos no Redis (contrato do @nestjs/throttler v6).
 * Assim o rate limiting funciona corretamente com **múltiplas instâncias**
 * compartilhando contador e bloqueio (o storage em memória não faz isso).
 *
 * KEYS[1] = chave de contagem · KEYS[2] = chave de bloqueio
 * ARGV[1] = janela (ms) · ARGV[2] = limite · ARGV[3] = duração do bloqueio (ms)
 * Retorna { totalHits, pttlMs, isBlocked(0|1), blockPttlMs }.
 */
const INCR_SCRIPT = `
local blockPttl = redis.call('PTTL', KEYS[2])
if blockPttl > 0 then
  local current = tonumber(redis.call('GET', KEYS[1]) or '0')
  return {current, blockPttl, 1, blockPttl}
end

local hits = redis.call('INCR', KEYS[1])
if hits == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
local pttl = redis.call('PTTL', KEYS[1])
if pttl < 0 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
  pttl = tonumber(ARGV[1])
end

if hits > tonumber(ARGV[2]) then
  local blockMs = tonumber(ARGV[3])
  redis.call('SET', KEYS[2], '1', 'PX', blockMs)
  return {hits, pttl, 1, blockMs}
end

return {hits, pttl, 0, 0}
`;

/** ms → s (arredondando para cima), como o storage padrão do throttler. */
const toSeconds = (ms: number): number => Math.ceil(ms / 1000);

/**
 * `ThrottlerStorage` sobre Redis com **fallback** para o storage em memória do
 * próprio @nestjs/throttler. Quando o Redis não está pronto ou falha, delega ao
 * fallback — então **o comportamento em ambientes sem Redis é idêntico ao atual**
 * (mesmos limites, contagem em memória). Com Redis disponível, contagem e
 * bloqueio passam a ser distribuídos entre instâncias (ADR-0002/0014).
 *
 * A partir do throttler v6 o storage também é responsável pelo **bloqueio**
 * (`isBlocked`/`timeToBlockExpire`) — implementado atomicamente no script Lua.
 */
export class ThrottlerStorageRedis implements ThrottlerStorage {
  private readonly logger = new Logger('ThrottlerStorageRedis');
  private readonly prefix = 'navix:throttle:';
  private fellBack = false;

  constructor(
    private readonly redis: Redis,
    private readonly fallback: ThrottlerStorage = new ThrottlerStorageService(),
  ) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    if (this.redis.status !== 'ready') {
      return this.fallback.increment(key, ttl, limit, blockDuration, throttlerName);
    }
    try {
      const hitsKey = `${this.prefix}${throttlerName}:${key}`;
      const blockKey = `${hitsKey}:blocked`;
      const [totalHits, pttlMs, blocked, blockPttlMs] = (await this.redis.eval(
        INCR_SCRIPT,
        2,
        hitsKey,
        blockKey,
        ttl,
        limit,
        blockDuration,
      )) as [number, number, number, number];

      this.fellBack = false;
      return {
        totalHits,
        timeToExpire: toSeconds(pttlMs),
        isBlocked: blocked === 1,
        timeToBlockExpire: toSeconds(blockPttlMs),
      };
    } catch (err) {
      if (!this.fellBack) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Falha no Redis (${message}). Rate limiting em memória (fallback).`);
        this.fellBack = true;
      }
      return this.fallback.increment(key, ttl, limit, blockDuration, throttlerName);
    }
  }
}
