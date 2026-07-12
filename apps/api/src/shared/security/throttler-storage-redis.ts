import { Logger } from '@nestjs/common';
import { ThrottlerStorage, ThrottlerStorageService } from '@nestjs/throttler';
import { Redis } from 'ioredis';

/**
 * Contagem atômica no Redis: INCR + define expiração na primeira ocorrência e lê
 * o PTTL restante. Assim o rate limiting funciona corretamente com **múltiplas
 * instâncias** compartilhando o mesmo contador (o storage em memória não faz isso).
 *
 * KEYS[1] = chave · ARGV[1] = janela (ms). Retorna { totalHits, pttlMs }.
 */
const INCR_SCRIPT = `
local hits = redis.call('INCR', KEYS[1])
if hits == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
local pttl = redis.call('PTTL', KEYS[1])
if pttl < 0 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
  pttl = tonumber(ARGV[1])
end
return {hits, pttl}
`;

/**
 * `ThrottlerStorage` sobre Redis com **fallback** para o storage em memória do
 * próprio @nestjs/throttler. Quando o Redis não está pronto ou falha, delega ao
 * fallback — então **o comportamento em ambientes sem Redis é idêntico ao atual**
 * (mesmos limites, contagem em memória). Com Redis disponível, a contagem passa a
 * ser distribuída entre instâncias (ADR-0002/0014).
 *
 * `ttl` chega em **milissegundos** e o retorno usa `timeToExpire` em **segundos**,
 * exatamente como o `ThrottlerStorageService` padrão.
 */
export class ThrottlerStorageRedis implements ThrottlerStorage {
  private readonly logger = new Logger('ThrottlerStorageRedis');
  private readonly prefix = 'navix:throttle:';
  private fellBack = false;

  constructor(
    private readonly redis: Redis,
    private readonly fallback: ThrottlerStorage = new ThrottlerStorageService(),
  ) {}

  async increment(key: string, ttl: number): Promise<{ totalHits: number; timeToExpire: number }> {
    if (this.redis.status !== 'ready') {
      return this.fallback.increment(key, ttl);
    }
    try {
      const result = (await this.redis.eval(INCR_SCRIPT, 1, this.prefix + key, ttl)) as [
        number,
        number,
      ];
      const [totalHits, pttlMs] = result;
      this.fellBack = false;
      return { totalHits, timeToExpire: Math.ceil(pttlMs / 1000) };
    } catch (err) {
      if (!this.fellBack) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Falha no Redis (${message}). Rate limiting em memória (fallback).`);
        this.fellBack = true;
      }
      return this.fallback.increment(key, ttl);
    }
  }
}
