/** Registro persistido de um refresh token (armazenado como hash). */
export interface StoredRefreshToken {
  id: string;
  userId: string;
  tokenHash: string;
  /** Família para detecção de reuso (rotação de tokens — ver docs/security.md §2). */
  familyId: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

/** Port do repositório de refresh tokens. */
export interface RefreshTokenRepositoryPort {
  save(token: StoredRefreshToken): Promise<void>;
  findByHash(tokenHash: string): Promise<StoredRefreshToken | null>;
  revoke(id: string): Promise<void>;
  /** Revoga toda a família (usado ao detectar reuso). */
  revokeFamily(familyId: string): Promise<void>;
}

export const REFRESH_TOKEN_REPOSITORY = Symbol('REFRESH_TOKEN_REPOSITORY');
