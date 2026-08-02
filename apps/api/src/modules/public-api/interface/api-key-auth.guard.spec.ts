import type { ExecutionContext } from '@nestjs/common';
import { HttpException } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';

import { ForbiddenError, UnauthorizedError } from '../../../shared/kernel/domain-error';
import type { ApiKeyQuotaService } from '../application/api-key-quota.service';
import type { ApiKeyService } from '../application/api-key.service';

import { ApiKeyAuthGuard } from './api-key-auth.guard';

function context(headers: Record<string, string> = {}) {
  const request: { user?: unknown; header(name: string): string | undefined } = {
    header: (name) => headers[name.toLowerCase()],
  };
  const response = { setHeader: jest.fn() };
  return {
    request,
    response,
    value: {
      switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as ExecutionContext,
  };
}

describe('ApiKeyAuthGuard', () => {
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(['deliveries:read']),
  } as unknown as Reflector;
  const quota = {
    consume: jest.fn().mockResolvedValue({ allowed: true, remaining: 9, reset: 100 }),
  } as unknown as ApiKeyQuotaService;

  it('autentica, exige escopo e cria principal de tenant para a RLS', async () => {
    const keys = {
      authenticate: jest.fn().mockResolvedValue({
        keyId: 'key-1',
        tenantId: 'tenant-1',
        scopes: ['deliveries:read'],
        quotaPerMinute: 10,
      }),
    } as unknown as ApiKeyService;
    const ctx = context({ 'x-api-key': 'nvx_live_secret' });
    await expect(new ApiKeyAuthGuard(reflector, keys, quota).canActivate(ctx.value)).resolves.toBe(
      true,
    );
    expect(ctx.request.user).toEqual(
      expect.objectContaining({ id: 'key-1', tenantId: 'tenant-1', roles: ['api'] }),
    );
    expect(ctx.response.setHeader).toHaveBeenCalledWith('RateLimit-Remaining', 9);
  });

  it('rejeita chave ausente', async () => {
    const guard = new ApiKeyAuthGuard(reflector, {} as ApiKeyService, quota);
    await expect(guard.canActivate(context().value)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('rejeita escopo insuficiente', async () => {
    const keys = {
      authenticate: jest.fn().mockResolvedValue({
        keyId: 'key-1',
        tenantId: 'tenant-1',
        scopes: [],
        quotaPerMinute: 10,
      }),
    } as unknown as ApiKeyService;
    await expect(
      new ApiKeyAuthGuard(reflector, keys, quota).canActivate(
        context({ 'x-api-key': 'nvx_live_secret' }).value,
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('responde 429 quando a quota termina', async () => {
    const keys = {
      authenticate: jest.fn().mockResolvedValue({
        keyId: 'key-1',
        tenantId: 'tenant-1',
        scopes: ['deliveries:read'],
        quotaPerMinute: 10,
      }),
    } as unknown as ApiKeyService;
    const denied = {
      consume: jest.fn().mockResolvedValue({ allowed: false, remaining: 0, reset: 100 }),
    } as unknown as ApiKeyQuotaService;
    await expect(
      new ApiKeyAuthGuard(reflector, keys, denied).canActivate(
        context({ 'x-api-key': 'nvx_live_secret' }).value,
      ),
    ).rejects.toBeInstanceOf(HttpException);
  });
});
