import type { ThrottlerStorage } from '@nestjs/throttler';
import type { Redis } from 'ioredis';

import { ThrottlerStorageRedis } from './throttler-storage-redis';

const FALLBACK_RECORD = {
  totalHits: 42,
  timeToExpire: 7,
  isBlocked: false,
  timeToBlockExpire: 0,
};

function fakeFallback(): ThrottlerStorage & { increment: jest.Mock } {
  return { increment: jest.fn().mockResolvedValue(FALLBACK_RECORD) };
}

/** Argumentos do contrato v6: (key, ttl, limit, blockDuration, throttlerName). */
const args = ['ip:1', 60_000, 5, 30_000, 'default'] as const;

describe('ThrottlerStorageRedis (contrato v6)', () => {
  it('usa o Redis quando conectado e converte PTTL(ms) → segundos', async () => {
    const redis = {
      status: 'ready',
      eval: jest.fn().mockResolvedValue([3, 45_000, 0, 0]),
    } as unknown as Redis;
    const fallback = fakeFallback();

    const storage = new ThrottlerStorageRedis(redis, fallback);
    const record = await storage.increment(...args);

    expect(record).toEqual({
      totalHits: 3,
      timeToExpire: 45,
      isBlocked: false,
      timeToBlockExpire: 0,
    });
    expect(fallback.increment).not.toHaveBeenCalled();
    // 2 KEYS (contagem + bloqueio) e os ARGV (ttl, limit, blockDuration).
    expect((redis.eval as jest.Mock).mock.calls[0]).toEqual(
      expect.arrayContaining([
        2,
        'navix:throttle:default:ip:1',
        'navix:throttle:default:ip:1:blocked',
        60_000,
        5,
        30_000,
      ]),
    );
  });

  it('propaga o bloqueio devolvido pelo script (isBlocked + timeToBlockExpire)', async () => {
    const redis = {
      status: 'ready',
      eval: jest.fn().mockResolvedValue([6, 30_000, 1, 30_000]),
    } as unknown as Redis;

    const storage = new ThrottlerStorageRedis(redis, fakeFallback());
    const record = await storage.increment(...args);

    expect(record).toEqual({
      totalHits: 6,
      timeToExpire: 30,
      isBlocked: true,
      timeToBlockExpire: 30,
    });
  });

  it('cai para o fallback em memória quando o Redis não está pronto', async () => {
    const redis = { status: 'connecting', eval: jest.fn() } as unknown as Redis;
    const fallback = fakeFallback();

    const storage = new ThrottlerStorageRedis(redis, fallback);
    const record = await storage.increment(...args);

    expect(redis.eval).not.toHaveBeenCalled();
    expect(fallback.increment).toHaveBeenCalledWith(...args);
    expect(record).toEqual(FALLBACK_RECORD);
  });

  it('cai para o fallback quando o comando Redis falha', async () => {
    const redis = {
      status: 'ready',
      eval: jest.fn().mockRejectedValue(new Error('connection lost')),
    } as unknown as Redis;
    const fallback = fakeFallback();

    const storage = new ThrottlerStorageRedis(redis, fallback);
    const record = await storage.increment(...args);

    expect(fallback.increment).toHaveBeenCalledWith(...args);
    expect(record).toEqual(FALLBACK_RECORD);
  });
});
