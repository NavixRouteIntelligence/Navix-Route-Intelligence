export interface StoredResetToken {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
}

/** Port do repositório de tokens de recuperação de senha. */
export interface PasswordResetTokenRepositoryPort {
  save(token: StoredResetToken): Promise<void>;
  findByHash(tokenHash: string): Promise<StoredResetToken | null>;
  markUsed(id: string): Promise<void>;
}

export const PASSWORD_RESET_TOKEN_REPOSITORY = Symbol('PASSWORD_RESET_TOKEN_REPOSITORY');
