import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthenticatedUser } from '@navix/contracts';

/**
 * Injeta o usuário autenticado (populado pela estratégia JWT em `req.user`)
 * nos handlers dos controllers. Uso: `@CurrentUser() user: AuthenticatedUser`.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest<{ user: AuthenticatedUser }>();
    return request.user;
  },
);
