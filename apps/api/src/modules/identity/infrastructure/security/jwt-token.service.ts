import { createHash, randomBytes, randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { AccessTokenClaims } from '@navix/contracts';

import { AppConfigService } from '../../../../shared/config/app-config.service';
import { KEY_RING, type KeyRingPort } from '../../../../shared/security/keys/key-ring.port';
import type {
  IssuedRefreshToken,
  TokenServicePort,
} from '../../application/ports/token-service.port';

/**
 * Serviço de tokens: access token JWT assinado com **RS256** (chave assimétrica
 * do KeyRing, com `kid` no cabeçalho para rotação) + refresh token opaco
 * persistido como hash. Ver docs/security.md §2 e o ADR de RS256.
 */
@Injectable()
export class JwtTokenService implements TokenServicePort {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: AppConfigService,
    @Inject(KEY_RING) private readonly keyRing: KeyRingPort,
  ) {}

  async signAccessToken(
    claims: AccessTokenClaims,
  ): Promise<{ token: string; expiresIn: number }> {
    const { kid, privateKey } = this.keyRing.getSigningKey();
    const expiresIn = this.config.jwt.accessTtl;
    const token = await this.jwt.signAsync(claims, {
      algorithm: 'RS256',
      privateKey,
      keyid: kid,
      expiresIn,
    });
    return { token, expiresIn };
  }

  issueRefreshToken(_userId: string, familyId?: string): IssuedRefreshToken {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + this.config.jwt.refreshTtl * 1000);
    return {
      token,
      tokenHash: this.hashRefreshToken(token),
      familyId: familyId ?? randomUUID(),
      expiresAt,
    };
  }

  hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
