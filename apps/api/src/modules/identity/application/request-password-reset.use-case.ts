import { createHash, randomBytes } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import type { ForgotPasswordResponse } from '@navix/contracts';

import { AUDIT_LOG, type AuditLogPort } from '../../../shared/audit/audit-log.port';
import { newId } from '../../../shared/kernel/id';
import {
  PASSWORD_RESET_TOKEN_REPOSITORY,
  type PasswordResetTokenRepositoryPort,
} from '../domain/ports/password-reset-token-repository.port';
import {
  USER_REPOSITORY,
  type UserRepositoryPort,
} from '../domain/ports/user-repository.port';

const TTL_MINUTES = 30;
const GENERIC_MESSAGE = 'Se o e-mail existir, enviaremos instruções de recuperação.';

export interface RequestPasswordResetCommand {
  email: string;
  /** Slug da empresa — opcional; senão resolve o tenant pelo e-mail (ADR-0016). */
  organization?: string;
}

/**
 * Solicita recuperação de senha. Nunca revela se o e-mail existe (resposta
 * genérica). Em DEV, retorna o token para permitir concluir o fluxo sem e-mail;
 * em produção, o token seria enviado por e-mail (nunca no corpo da resposta).
 */
@Injectable()
export class RequestPasswordResetUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
    @Inject(PASSWORD_RESET_TOKEN_REPOSITORY)
    private readonly tokens: PasswordResetTokenRepositoryPort,
    @Inject(AUDIT_LOG) private readonly audit: AuditLogPort,
  ) {}

  async execute(command: RequestPasswordResetCommand): Promise<ForgotPasswordResponse> {
    const email = command.email.trim().toLowerCase();
    const organization = command.organization?.trim();
    const user = organization
      ? await this.users.findByEmailAndOrganization(email, organization)
      : await this.users.findByEmail(email);
    if (!user) {
      return { message: GENERIC_MESSAGE };
    }

    const token = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    await this.tokens.save({
      id: newId(),
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + TTL_MINUTES * 60_000),
      usedAt: null,
    });

    await this.audit.record({
      tenantId: user.tenantId,
      actorId: user.id,
      action: 'auth.password_reset.requested',
      resource: `user:${user.id}`,
    });

    const isProduction = process.env.NODE_ENV === 'production';
    return { message: GENERIC_MESSAGE, resetToken: isProduction ? undefined : token };
  }
}
