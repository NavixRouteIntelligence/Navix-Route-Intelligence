import { Inject, Injectable } from '@nestjs/common';

import { AUDIT_LOG, type AuditLogPort } from '../../../shared/audit/audit-log.port';
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
    @Inject(AUDIT_LOG) private readonly audit: AuditLogPort,
  ) {}

  async execute(presentedToken: string): Promise<void> {
    const hash = this.tokens.hashRefreshToken(presentedToken);
    const stored = await this.refreshTokens.findByHash(hash);
    if (stored && !stored.revokedAt) {
      await this.refreshTokens.revoke(stored.id);
      await this.audit.record({
        tenantId: null,
        actorId: stored.userId,
        action: 'auth.logout',
        resource: `user:${stored.userId}`,
      });
    }
  }
}
