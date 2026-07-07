import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '@navix/contracts';

import { UnauthorizedError } from '../../../shared/kernel/domain-error';
import {
  USER_REPOSITORY,
  type UserRepositoryPort,
} from '../domain/ports/user-repository.port';

@Injectable()
export class GetProfileUseCase {
  constructor(@Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort) {}

  async execute(userId: string): Promise<AuthenticatedUser> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new UnauthorizedError('Sessão inválida.');
    }
    return { id: user.id, tenantId: user.tenantId, email: user.email, roles: user.roles };
  }
}
