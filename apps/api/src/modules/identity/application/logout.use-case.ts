import { Inject, Injectable } from '@nestjs/common';

import {
  REFRESH_TOKEN_REPOSITORY,
  type RefreshTokenRepositoryPort,
} from '../domain/ports/refresh-token-repository.port';
import { TOKEN_SERVICE, type TokenServicePort } from './ports/token-service.port';

/**
 * Logout: revoga o refresh token apresentado. Idempotente — não revela se o
 * token existia. O access token de curta duração expira naturalmente.
 */
@Injectable()
export class LogoutUseCase {
  constructor(
    @Inject(REFRESH_TOKEN_REPOSITORY)
    private readonly refreshTokens: RefreshTokenRepositoryPort,
    @Inject(TOKEN_SERVICE) private readonly tokens: TokenServicePort,
  ) {}

  async execute(presentedToken: string): Promise<void> {
    const hash = this.tokens.hashRefreshToken(presentedToken);
    const stored = await this.refreshTokens.findByHash(hash);
    if (stored && !stored.revokedAt) {
      await this.refreshTokens.revoke(stored.id);
    }
  }
}
