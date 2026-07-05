import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard de autenticação por JWT de acesso. Primitivo de segurança transversal
 * (shared) para que qualquer módulo proteja rotas sem depender do módulo Identity.
 * Depende da estratégia 'jwt' registrada pelo IdentityModule.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
