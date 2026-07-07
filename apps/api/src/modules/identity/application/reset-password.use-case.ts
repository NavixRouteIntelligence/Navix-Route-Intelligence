import { createHash } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';

import { AUDIT_LOG, type AuditLogPort } from '../../../shared/audit/audit-log.port';
import { UnauthorizedError, ValidationError } from '../../../shared/kernel/domain-error';
import {
  PASSWORD_RESET_TOKEN_REPOSITORY,
  type PasswordResetTokenRepositoryPort,
} from '../domain/ports/password-reset-token-repository.port';
import {
  USER_REPOSITORY,
  type UserRepositoryPort,
} from '../domain/ports/user-repository.port';
import { PASSWORD_HASHER, type PasswordHasherPort } from './ports/password-hasher.port';

export interface ResetPasswordCommand {
  token: string;
  newPassword: string;
}

@Injectable()
export class ResetPasswordUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
    @Inject(PASSWORD_RESET_TOKEN_REPOSITORY)
    private readonly tokens: PasswordResetTokenRepositoryPort,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasherPort,
    @Inject(AUDIT_LOG) private readonly audit: AuditLogPort,
  ) {}

  async execute(command: ResetPasswordCommand): Promise<void> {
    if (command.newPassword.length < 8) {
      throw new ValidationError('A nova senha deve ter ao menos 8 caracteres.');
    }
    const tokenHash = createHash('sha256').update(command.token).digest('hex');
    const stored = await this.tokens.findByHash(tokenHash);
    if (!stored || stored.usedAt || stored.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedError('Token de recuperação inválido ou expirado.');
    }

    const hash = await this.hasher.hash(command.newPassword);
    await this.users.updatePassword(stored.userId, hash);
    await this.tokens.markUsed(stored.id);

    await this.audit.record({
      tenantId: null,
      actorId: stored.userId,
      action: 'auth.password_reset.completed',
      resource: `user:${stored.userId}`,
    });
  }
}
