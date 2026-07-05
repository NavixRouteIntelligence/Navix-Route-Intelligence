import type { AccessTokenClaims } from '@navix/contracts';

export interface IssuedRefreshToken {
  /** Token opaco entregue ao cliente. */
  token: string;
  /** Hash persistido no banco. */
  tokenHash: string;
  familyId: string;
  expiresAt: Date;
}

/** Port do serviço de tokens (JWT access + refresh). */
export interface TokenServicePort {
  signAccessToken(claims: AccessTokenClaims): Promise<{ token: string; expiresIn: number }>;
  /** Gera um novo refresh token; `familyId` continua uma família existente na rotação. */
  issueRefreshToken(userId: string, familyId?: string): IssuedRefreshToken;
  hashRefreshToken(token: string): string;
}

export const TOKEN_SERVICE = Symbol('TOKEN_SERVICE');
