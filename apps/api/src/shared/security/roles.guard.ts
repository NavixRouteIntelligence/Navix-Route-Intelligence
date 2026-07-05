import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedUser } from '@navix/contracts';

import { ForbiddenError } from '../kernel/domain-error';
import { ROLES_KEY } from './roles.decorator';

/** Verifica se o usuário autenticado possui pelo menos um dos papéis exigidos. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;
    if (!user || !required.some((role) => user.roles.includes(role))) {
      throw new ForbiddenError('Permissão insuficiente.');
    }
    return true;
  }
}
