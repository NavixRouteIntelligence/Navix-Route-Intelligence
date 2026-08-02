import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { AppConfigService } from '../../../shared/config/app-config.service';

@Injectable()
export class WebhookSecretCipher {
  private readonly key: Buffer;

  constructor(config: AppConfigService) {
    this.key = createHash('sha256').update(config.encryption.kek, 'utf8').digest();
  }

  encrypt(plain: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    return [
      'v1',
      iv.toString('base64url'),
      cipher.getAuthTag().toString('base64url'),
      ciphertext.toString('base64url'),
    ].join('.');
  }

  decrypt(encrypted: string): string {
    const [version, iv, tag, ciphertext] = encrypted.split('.');
    if (version !== 'v1' || !iv || !tag || !ciphertext)
      throw new Error('Segredo cifrado inválido.');
    const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertext, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  }
}
