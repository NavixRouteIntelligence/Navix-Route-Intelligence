import type { Redis } from 'ioredis';

import { RedisCache } from './redis-cache';

describe('RedisCache', () => {
  it('get: retorna o valor desserializado quando presente', async () => {
    const redis = {
      status: 'ready',
      get: jest.fn().mockResolvedValue(JSON.stringify({ a: 1 })),
    } as unknown as Redis;

    const cache = new RedisCache(redis);
    await expect(cache.get<{ a: number }>('k')).resolves.toEqual({ a: 1 });
    expect(redis.get).toHaveBeenCalledWith('navix:cache:k');
  });

  it('get: degrada para null quando o Redis não está pronto', async () => {
    const redis = { status: 'connecting', get: jest.fn() } as unknown as Redis;
    const cache = new RedisCache(redis);
    await expect(cache.get('k')).resolves.toBeNull();
    expect(redis.get).not.toHaveBeenCalled();
  });

  it('get: trata erro do Redis como miss (null)', async () => {
    const redis = {
      status: 'ready',
      get: jest.fn().mockRejectedValue(new Error('boom')),
    } as unknown as Redis;
    const cache = new RedisCache(redis);
    await expect(cache.get('k')).resolves.toBeNull();
  });

  it('set: aplica TTL em segundos quando informado', async () => {
    const set = jest.fn().mockResolvedValue('OK');
    const redis = { status: 'ready', set } as unknown as Redis;
    const cache = new RedisCache(redis);
    await cache.set('k', { v: 2 }, 30);
    expect(set).toHaveBeenCalledWith('navix:cache:k', JSON.stringify({ v: 2 }), 'EX', 30);
  });

  it('getOrSet: em miss executa a factory, grava e retorna o valor', async () => {
    const set = jest.fn().mockResolvedValue('OK');
    const redis = {
      status: 'ready',
      get: jest.fn().mockResolvedValue(null),
      set,
    } as unknown as Redis;
    const cache = new RedisCache(redis);
    const factory = jest.fn().mockResolvedValue({ v: 9 });

    const result = await cache.getOrSet('k', 60, factory);

    expect(result).toEqual({ v: 9 });
    expect(factory).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalled();
  });

  it('getOrSet: em hit não executa a factory', async () => {
    const redis = {
      status: 'ready',
      get: jest.fn().mockResolvedValue(JSON.stringify({ v: 'cached' })),
      set: jest.fn(),
    } as unknown as Redis;
    const cache = new RedisCache(redis);
    const factory = jest.fn();

    const result = await cache.getOrSet('k', 60, factory);

    expect(result).toEqual({ v: 'cached' });
    expect(factory).not.toHaveBeenCalled();
  });
});
