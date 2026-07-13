import type { ThrottlerStorage } from '@nestjs/throttler';
import type { Redis } from 'ioredis';

import { ThrottlerStorageRedis } from './throttler-storage-redis';

function fakeFallback(): ThrottlerStorage & { increment: jest.Mock } {
  return {
    increment: jest.fn().mockResolvedValue({ totalHits: 42, timeToExpire: 7 }),
  };
}

describe('ThrottlerStorageRedis', () => {
  it('usa o Redis quando conectado e converte PTTL(ms) → timeToExpire(s)', async () => {
    const redis = {
      status: 'ready',
      eval: jest.fn().mockResolvedValue([3, 45_000]),
    } as unknown as Redis;
    const fallback = fakeFallback();

    const storage = new ThrottlerStorageRedis(redis, fallback);
    const record = await storage.increment('ip:1', 60_000);

    expect(record).toEqual({ totalHits: 3, timeToExpire: 45 });
    expect(fallback.increment).not.toHaveBeenCalled();
    // ttl (ms) é repassado ao script como ARGV.
    expect((redis.eval as jest.Mock).mock.calls[0]).toEqual(
      expect.arrayContaining([1, 'navix:throttle:ip:1', 60_000]),
    );
  });

  it('cai para o fallback em memória quando o Redis não está pronto', async () => {
    const redis = { status: 'connecting', eval: jest.fn() } as unknown as Redis;
    const fallback = fakeFallback();

    const storage = new ThrottlerStorageRedis(redis, fallback);
    const record = await storage.increment('ip:2', 60_000);

    expect(redis.eval).not.toHaveBeenCalled();
    expect(fallback.increment).toHaveBeenCalledWith('ip:2', 60_000);
    expect(record).toEqual({ totalHits: 42, timeToExpire: 7 });
  });

  it('cai para o fallback quando o comando Redis falha', async () => {
    const redis = {
      status: 'ready',
      eval: jest.fn().mockRejectedValue(new Error('connection lost')),
    } as unknown as Redis;
    const fallback = fakeFallback();

    const storage = new ThrottlerStorageRedis(redis, fallback);
    const record = await storage.increment('ip:3', 60_000);

    expect(fallback.increment).toHaveBeenCalledWith('ip:3', 60_000);
    expect(record).toEqual({ totalHits: 42, timeToExpire: 7 });
  });
});
