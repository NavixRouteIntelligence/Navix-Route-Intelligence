import { Inject, Injectable } from '@nestjs/common';
import type { AuthResult } from '@navix/contracts';

import { AUDIT_LOG, type AuditLogPort } from '../../../shared/audit/audit-log.port';
import { UnauthorizedError } from '../../../shared/kernel/domain-error';
import {
  USER_REPOSITORY,
  type UserRepositoryPort,
} from '../domain/ports/user-repository.port';
import {
  REFRESH_TOKEN_REPOSITORY,
  type RefreshTokenRepositoryPort,
} from '../domain/ports/refresh-token-repository.port';
import { newId } from '../../../shared/kernel/id';
import { PASSWORD_HASHER, type PasswordHasherPort } from './ports/password-hasher.port';
import { TOKEN_SERVICE, type TokenServicePort } from './ports/token-service.port';

export interface LoginCommand {
  tenantId: string;
  email: string;
  password: string;
}

/**
 * Caso de uso de login. Valida credenciais e emite access + refresh tokens.
 * Mensagem de erro é genérica para não revelar existência de e-mail.
 */
@Injectable()
export class LoginUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
    @Inject(REFRESH_TOKEN_REPOSITORY)
    private readonly refreshTokens: RefreshTokenRepositoryPort,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasherPort,
    @Inject(TOKEN_SERVICE) private readonly tokens: TokenServicePort,
    @Inject(AUDIT_LOG) private readonly audit: AuditLogPort,
  ) {}

  async execute(command: LoginCommand): Promise<AuthResult> {
    const user = await this.users.findByEmail(command.tenantId, command.email);
    if (!user || user.status !== 'active') {
      await this.auditFailure(command, 'user_not_found_or_inactive');
      throw new UnauthorizedError('Credenciais inválidas.');
    }

    const valid = await this.hasher.verify(user.passwordHash, command.password);
    if (!valid) {
      await this.auditFailure(command, 'invalid_password');
      throw new UnauthorizedError('Credenciais inválidas.');
    }

    const access = await this.tokens.signAccessToken({
      sub: user.id,
      tenantId: user.tenantId,
      roles: user.roles,
    });

    const refresh = this.tokens.issueRefreshToken(user.id);
    await this.refreshTokens.save({
      id: newId(),
      userId: user.id,
      tokenHash: refresh.tokenHash,
      familyId: refresh.familyId,
      expiresAt: refresh.expiresAt,
      revokedAt: null,
    });

    await this.audit.record({
      tenantId: user.tenantId,
      actorId: user.id,
      action: 'auth.login.succeeded',
      resource: `user:${user.id}`,
    });

    return {
      user: {
        id: user.id,
        tenantId: user.tenantId,
        email: user.email,
        roles: user.roles,
      },
      tokens: {
        accessToken: access.token,
        expiresIn: access.expiresIn,
        refreshToken: refresh.token,
      },
    };
  }

  private auditFailure(command: LoginCommand, reason: string): Promise<void> {
    return this.audit.record({
      tenantId: command.tenantId,
      actorId: null,
      action: 'auth.login.failed',
      metadata: { email: command.email, reason },
    });
  }
}
