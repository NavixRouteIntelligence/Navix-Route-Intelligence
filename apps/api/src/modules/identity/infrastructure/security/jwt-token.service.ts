import { createHash, randomBytes, randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { AccessTokenClaims } from '@navix/contracts';

import { AppConfigService } from '../../../../shared/config/app-config.service';
import type {
  IssuedRefreshToken,
  TokenServicePort,
} from '../../application/ports/token-service.port';

/**
 * Serviço de tokens: JWT de acesso (curta duração) + refresh token opaco
 * (persistido como hash). Ver docs/security.md §2.
 *
 * Nota: em produção, o access token deve ser assinado com chave assimétrica
 * (RS256/ES256) via KMS; aqui usamos segredo simétrico para desenvolvimento.
 */
@Injectable()
export class JwtTokenService implements TokenServicePort {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: AppConfigService,
  ) {}

  async signAccessToken(
    claims: AccessTokenClaims,
  ): Promise<{ token: string; expiresIn: number }> {
    const { accessSecret, accessTtl } = this.config.jwt;
    const token = await this.jwt.signAsync(claims, {
      secret: accessSecret,
      expiresIn: accessTtl,
    });
    return { token, expiresIn: accessTtl };
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
