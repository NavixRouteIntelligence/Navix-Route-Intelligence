import type { Redis } from 'ioredis';

import { RedisHealthIndicator } from './redis.health';

function indicator(ping: () => Promise<string>): RedisHealthIndicator {
  return new RedisHealthIndicator({ ping } as unknown as Redis);
}

describe('RedisHealthIndicator', () => {
  it('reporta connection=up quando o ping responde PONG', async () => {
    const result = await indicator(async () => 'PONG').check('redis');
    expect(result).toEqual({ redis: { status: 'up', connection: 'up' } });
  });

  it('nunca derruba a prontidão: status=up com connection=degraded quando o Redis falha', async () => {
    const result = await indicator(async () => {
      throw new Error('ECONNREFUSED');
    }).check('redis');
    expect(result.redis.status).toBe('up');
    expect(result.redis.connection).toBe('degraded');
  });
});
