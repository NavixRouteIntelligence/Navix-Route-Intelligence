import type { CallHandler, ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { firstValueFrom, of } from 'rxjs';
import type { EntityManager } from 'typeorm';

import { transactionContext } from '../database/transaction-context';
import { ValidationError } from '../kernel/domain-error';
import { IdempotencyInterceptor } from './idempotency.interceptor';

function makeContext(headers: Record<string, string>, setHeader = jest.fn()) {
  const req = {
    method: 'POST',
    route: { path: '/api/v1/pod' },
    path: '/api/v1/pod',
    headers,
    user: { tenantId: 'tenant-1' },
  };
  const res = { setHeader };
  return {
    getType: () => 'http',
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
  } as unknown as ExecutionContext;
}

function makeReflector(enabled: boolean, httpCode = 201): Reflector {
  return {
    getAllAndOverride: jest.fn().mockReturnValue(enabled),
    get: jest.fn().mockReturnValue(httpCode),
  } as unknown as Reflector;
}

const KEY = 'idem-key-123456';

describe('IdempotencyInterceptor', () => {
  it('passa direto quando o handler não é @Idempotent', async () => {
    const interceptor = new IdempotencyInterceptor(makeReflector(false));
    const next: CallHandler = { handle: jest.fn().mockReturnValue(of({ data: 'x' })) };
    const out = interceptor.intercept(makeContext({ 'idempotency-key': KEY }), next);
    await expect(firstValueFrom(out)).resolves.toEqual({ data: 'x' });
    expect(next.handle).toHaveBeenCalled();
  });

  it('passa direto quando não há Idempotency-Key', async () => {
    const interceptor = new IdempotencyInterceptor(makeReflector(true));
    const next: CallHandler = { handle: jest.fn().mockReturnValue(of({ data: 'x' })) };
    const out = interceptor.intercept(makeContext({}), next);
    await expect(firstValueFrom(out)).resolves.toEqual({ data: 'x' });
  });

  it('rejeita Idempotency-Key muito curta', () => {
    const interceptor = new IdempotencyInterceptor(makeReflector(true));
    const next: CallHandler = { handle: jest.fn() };
    expect(() => interceptor.intercept(makeContext({ 'idempotency-key': 'short' }), next)).toThrow(
      ValidationError,
    );
  });

  it('executa e grava a resposta quando a chave é nova', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([]) // SELECT: nada
      .mockResolvedValueOnce([]); // INSERT
    const manager = { query } as unknown as EntityManager;
    const interceptor = new IdempotencyInterceptor(makeReflector(true));
    const next: CallHandler = { handle: jest.fn().mockReturnValue(of({ data: 'created' })) };

    const result = await transactionContext.run(manager, async () => {
      const out = interceptor.intercept(makeContext({ 'idempotency-key': KEY }), next);
      return firstValueFrom(out);
    });

    expect(result).toEqual({ data: 'created' });
    expect(next.handle).toHaveBeenCalled();
    const insert = query.mock.calls.find((c) => String(c[0]).includes('INSERT INTO idempotency_keys'));
    expect(insert).toBeDefined();
    expect(insert?.[1]).toEqual(
      expect.arrayContaining(['tenant-1', KEY, 'POST', '/api/v1/pod', 201]),
    );
  });

  it('replica a resposta armazenada e NÃO executa o handler (reenvio)', async () => {
    const stored = { data: 'original' };
    const query = jest
      .fn()
      .mockResolvedValueOnce([{ response_status: 201, response_body: stored }]);
    const manager = { query } as unknown as EntityManager;
    const setHeader = jest.fn();
    const interceptor = new IdempotencyInterceptor(makeReflector(true));
    const next: CallHandler = { handle: jest.fn() };

    const result = await transactionContext.run(manager, async () => {
      const out = interceptor.intercept(makeContext({ 'idempotency-key': KEY }, setHeader), next);
      return firstValueFrom(out);
    });

    expect(result).toEqual(stored);
    expect(next.handle).not.toHaveBeenCalled();
    expect(setHeader).toHaveBeenCalledWith('Idempotency-Replayed', 'true');
  });
});
