import type { AuthenticatedUser } from '@navix/contracts';
import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';

import { UnauthorizedError, ForbiddenError } from '../../../shared/kernel/domain-error';
import { ApiKeyQuotaService } from '../application/api-key-quota.service';
import { ApiKeyService } from '../application/api-key.service';
import type { PublicApiScope } from '../domain/public-api';

import { API_SCOPES_KEY } from './api-scopes.decorator';

@Injectable()
export class ApiKeyAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly keys: ApiKeyService,
    private readonly quota: ApiKeyQuotaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const response = context.switchToHttp().getResponse<Response>();
    const raw = request.header('x-api-key') ?? this.bearer(request.header('authorization'));
    if (!raw?.startsWith('nvx_live_'))
      throw new UnauthorizedError('Chave de API ausente ou inválida.');

    const principal = await this.keys.authenticate(raw);
    if (!principal) throw new UnauthorizedError('Chave de API ausente, expirada ou revogada.');
    const required =
      this.reflector.getAllAndOverride<PublicApiScope[]>(API_SCOPES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];
    if (!required.every((scope) => principal.scopes.includes(scope))) {
      throw new ForbiddenError('A chave não possui o escopo exigido.');
    }

    const quota = await this.quota.consume(principal.keyId, principal.quotaPerMinute);
    response.setHeader('RateLimit-Limit', principal.quotaPerMinute);
    response.setHeader('RateLimit-Remaining', quota.remaining);
    response.setHeader('RateLimit-Reset', quota.reset);
    if (!quota.allowed)
      throw new HttpException('Quota da chave excedida.', HttpStatus.TOO_MANY_REQUESTS);

    request.user = {
      id: principal.keyId,
      tenantId: principal.tenantId,
      email: `api-key:${principal.keyId}`,
      roles: ['api'],
    };
    return true;
  }

  private bearer(value: string | undefined): string | undefined {
    if (!value?.startsWith('Bearer ')) return undefined;
    return value.slice(7).trim();
  }
}
