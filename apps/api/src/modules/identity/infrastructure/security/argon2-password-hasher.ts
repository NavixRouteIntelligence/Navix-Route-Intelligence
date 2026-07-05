import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

import type { PasswordHasherPort } from '../../application/ports/password-hasher.port';

/** Implementação Argon2id do hashing de senhas (ver docs/security.md §2). */
@Injectable()
export class Argon2PasswordHasher implements PasswordHasherPort {
  async hash(plain: string): Promise<string> {
    return argon2.hash(plain, { type: argon2.argon2id });
  }

  async verify(hash: string, plain: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plain);
    } catch {
      return false;
    }
  }
}
