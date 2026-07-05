import { Inject, Injectable } from '@nestjs/common';
import type { AuthTokens } from '@navix/contracts';

import { UnauthorizedError } from '../../../shared/kernel/domain-error';
import { newId } from '../../../shared/kernel/id';
import {
  USER_REPOSITORY,
  type UserRepositoryPort,
} from '../domain/ports/user-repository.port';
import {
  REFRESH_TOKEN_REPOSITORY,
  type RefreshTokenRepositoryPort,
} from '../domain/ports/refresh-token-repository.port';
import { TOKEN_SERVICE, type TokenServicePort } from './ports/token-service.port';

/**
 * Caso de uso de refresh com ROTAÇÃO de token (ver docs/security.md §2):
 *  - valida o refresh token recebido;
 *  - se já foi revogado -> reuso detectado -> revoga a família inteira;
 *  - caso contrário, revoga o atual e emite um novo par de tokens.
 */
@Injectable()
export class RefreshTokenUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
    @Inject(REFRESH_TOKEN_REPOSITORY)
    private readonly refreshTokens: RefreshTokenRepositoryPort,
    @Inject(TOKEN_SERVICE) private readonly tokens: TokenServicePort,
  ) {}

  async execute(presentedToken: string): Promise<AuthTokens> {
    const hash = this.tokens.hashRefreshToken(presentedToken);
    const stored = await this.refreshTokens.findByHash(hash);

    if (!stored || stored.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedError('Sessão inválida.');
    }

    // Reuso de token já revogado: comprometido -> derruba a família toda.
    if (stored.revokedAt) {
      await this.refreshTokens.revokeFamily(stored.familyId);
      throw new UnauthorizedError('Sessão inválida.');
    }

    const user = await this.users.findById(stored.userId);
    if (!user || user.status !== 'active') {
      throw new UnauthorizedError('Sessão inválida.');
    }

    // Rotação: revoga o atual e emite um novo na mesma família.
    await this.refreshTokens.revoke(stored.id);
    const next = this.tokens.issueRefreshToken(user.id, stored.familyId);
    await this.refreshTokens.save({
      id: newId(),
      userId: user.id,
      tokenHash: next.tokenHash,
      familyId: next.familyId,
      expiresAt: next.expiresAt,
      revokedAt: null,
    });

    const access = await this.tokens.signAccessToken({
      sub: user.id,
      tenantId: user.tenantId,
      roles: user.roles,
    });

    return {
      accessToken: access.token,
      expiresIn: access.expiresIn,
      refreshToken: next.token,
    };
  }
}
