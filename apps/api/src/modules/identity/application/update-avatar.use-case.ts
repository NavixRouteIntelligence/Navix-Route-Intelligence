import { Inject, Injectable } from '@nestjs/common';
import type { UserProfile } from '@navix/contracts';

import { AUDIT_LOG, type AuditLogPort } from '../../../shared/audit/audit-log.port';
import { UnauthorizedError } from '../../../shared/kernel/domain-error';
import { assertValidAvatar, defaultProfile } from '../domain/user-profile';
import {
  USER_PROFILE_REPOSITORY,
  type UserProfileRepositoryPort,
} from '../domain/ports/user-profile-repository.port';
import { USER_REPOSITORY, type UserRepositoryPort } from '../domain/ports/user-repository.port';

/**
 * Define ou remove o avatar do usuário. Validação de tipo/tamanho no domínio.
 * Preserva os demais campos do perfil.
 */
@Injectable()
export class UpdateAvatarUseCase {
  constructor(
    @Inject(USER_PROFILE_REPOSITORY)
    private readonly profiles: UserProfileRepositoryPort,
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
    @Inject(AUDIT_LOG) private readonly audit: AuditLogPort,
  ) {}

  /** `avatar = null` remove; caso contrário, valida e define. */
  async execute(tenantId: string, userId: string, avatar: string | null): Promise<UserProfile> {
    if (avatar !== null) assertValidAvatar(avatar);

    const current = await this.resolveCurrent(tenantId, userId);
    const next: UserProfile = { ...current, avatarUrl: avatar };

    await this.profiles.save({ tenantId, userId, profile: next, updatedAt: new Date() });

    await this.audit.record({
      tenantId,
      actorId: userId,
      action: avatar ? 'profile.avatar.updated' : 'profile.avatar.removed',
      resource: `user:${userId}`,
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
