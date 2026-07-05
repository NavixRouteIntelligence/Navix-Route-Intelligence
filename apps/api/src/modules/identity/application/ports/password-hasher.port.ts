/** Port para hashing/verificação de senhas (Argon2id — ver docs/security.md §2). */
export interface PasswordHasherPort {
  hash(plain: string): Promise<string>;
  verify(hash: string, plain: string): Promise<boolean>;
}

export const PASSWORD_HASHER = Symbol('PASSWORD_HASHER');
