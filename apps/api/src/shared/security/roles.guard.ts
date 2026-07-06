import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedUser } from '@navix/contracts';

import { AUDIT_LOG, type AuditLogPort } from '../audit/audit-log.port';
import { ForbiddenError } from '../kernel/domain-error';
import { ROLES_KEY } from './roles.decorator';

/** Verifica se o usuário autenticado possui pelo menos um dos papéis exigidos. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(AUDIT_LOG) private readonly audit: AuditLogPort,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<{ user?: AuthenticatedUser; method?: string; url?: string }>();
    const user = request.user;
    if (!user || !required.some((role) => user.roles.includes(role))) {
      // Auditoria de negação de autorização (fire-and-forget — não bloqueia).
      void this.audit.record({
        tenantId: user?.tenantId ?? null,
        actorId: user?.id ?? null,
        action: 'authz.denied',
        resource: request.url,
        metadata: { requiredRoles: required, method: request.method },
      });
      throw new ForbiddenError('Permissão insuficiente.');
    }
    return true;
  }
}
