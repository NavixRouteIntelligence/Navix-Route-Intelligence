import { Inject, Injectable } from '@nestjs/common';
import type { UpdateProfileRequest, UserProfile } from '@navix/contracts';

import { AUDIT_LOG, type AuditLogPort } from '../../../shared/audit/audit-log.port';
import { UnauthorizedError, ValidationError } from '../../../shared/kernel/domain-error';
import { applyProfilePatch, defaultProfile } from '../domain/user-profile';
import {
  USER_PROFILE_REPOSITORY,
  type UserProfileRepositoryPort,
} from '../domain/ports/user-profile-repository.port';
import { USER_REPOSITORY, type UserRepositoryPort } from '../domain/ports/user-repository.port';

export interface UpdateUserProfileCommand {
  tenantId: string;
  userId: string;
  patch: UpdateProfileRequest;
}

/**
 * Aplica um patch parcial ao perfil (merge por campo, com validação de
 * domínio). Cria a linha na primeira escrita a partir do default derivado do
 * e-mail. Preserva o avatar existente (alterado por caso de uso próprio).
 */
@Injectable()
export class UpdateUserProfileUseCase {
  constructor(
    @Inject(USER_PROFILE_REPOSITORY)
    private readonly profiles: UserProfileRepositoryPort,
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
    @Inject(AUDIT_LOG) private readonly audit: AuditLogPort,
  ) {}

  async execute(command: UpdateUserProfileCommand): Promise<UserProfile> {
    const fields = Object.keys(command.patch ?? {});
    if (fields.length === 0) {
      throw new ValidationError('Nenhum campo informado.');
    }

    const current = await this.resolveCurrent(command.tenantId, command.userId);
    const next = applyProfilePatch(current, command.patch);

    await this.profiles.save({
      tenantId: command.tenantId,
      userId: command.userId,
      profile: next,
      updatedAt: new Date(),
    });

    await this.audit.record({
      tenantId: command.tenantId,
      actorId: command.userId,
      action: 'profile.updated',
      resource: `user:${command.userId}`,
      metadata: { fields },
    });

    return next;
  }

  private async resolveCurrent(tenantId: string, userId: string): Promise<UserProfile> {
    const record = await this.profiles.find(tenantId, userId);
    if (record) return record.profile;
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedError('Sessão inválida.');
    return defaultProfile(user.email);
  }
}
