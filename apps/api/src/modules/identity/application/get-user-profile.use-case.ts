import { Inject, Injectable } from '@nestjs/common';
import type { UserProfile } from '@navix/contracts';

import { UnauthorizedError } from '../../../shared/kernel/domain-error';
import { defaultProfile } from '../domain/user-profile';
import {
  USER_PROFILE_REPOSITORY,
  type UserProfileRepositoryPort,
} from '../domain/ports/user-profile-repository.port';
import { USER_REPOSITORY, type UserRepositoryPort } from '../domain/ports/user-repository.port';

/**
 * Lê o perfil do usuário. Quando nunca configurado, retorna um perfil default
 * derivado do e-mail (sem materializar linha) — leitura sempre bem-sucedida.
 */
@Injectable()
export class GetUserProfileUseCase {
  constructor(
    @Inject(USER_PROFILE_REPOSITORY)
    private readonly profiles: UserProfileRepositoryPort,
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
  ) {}

  async execute(tenantId: string, userId: string): Promise<UserProfile> {
    const record = await this.profiles.find(tenantId, userId);
    if (record) return record.profile;

    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedError('Sessão inválida.');
    return defaultProfile(user.email);
  }
}
