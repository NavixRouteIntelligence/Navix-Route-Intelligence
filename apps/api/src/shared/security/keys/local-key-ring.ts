import { generateKeyPairSync, randomUUID } from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';

import { AppConfigService } from '../../config/app-config.service';
import type { KeyRingPort, SigningKey } from './key-ring.port';

/**
 * Key ring local (RS256). Prioridade:
 *  1. Chaves fornecidas por env (JWT_PRIVATE_KEY/JWT_PUBLIC_KEY/JWT_KEY_ID) —
 *     recomendado em produção (montadas de um secret manager);
 *  2. Se ausentes, gera um par RSA efêmero no boot (apenas desenvolvimento).
 *
 * Suporta uma chave pública ANTERIOR (para rotação): tokens assinados com a
 * chave antiga continuam válidos até expirarem, selecionados pelo `kid`.
 */
@Injectable()
export class LocalKeyRing implements KeyRingPort {
  private readonly logger = new Logger(LocalKeyRing.name);
  private readonly signing: SigningKey;
  private readonly publicKeys = new Map<string, string>();

  constructor(config: AppConfigService) {
    const jwt = config.jwt;

    if (jwt.privateKey && jwt.publicKey && jwt.keyId) {
      this.signing = { kid: jwt.keyId, privateKey: jwt.privateKey };
      this.publicKeys.set(jwt.keyId, jwt.publicKey);
    } else {
      const { privateKey, publicKey } = generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      });
      const kid = randomUUID();
      this.signing = { kid, privateKey };
      this.publicKeys.set(kid, publicKey);
      if (config.isProduction) {
        this.logger.error('JWT keys ausentes em produção — usando par efêmero. Configure JWT_PRIVATE_KEY/JWT_PUBLIC_KEY.');
      } else {
        this.logger.warn('JWT keys não configuradas — par RSA efêmero gerado (dev).');
      }
    }

    // Chave anterior (rotação): apenas verificação.
    if (jwt.previousPublicKey && jwt.previousKeyId) {
      this.publicKeys.set(jwt.previousKeyId, jwt.previousPublicKey);
    }
  }

  getSigningKey(): SigningKey {
    return this.signing;
  }

  getPublicKey(kid: string): string | null {
    return this.publicKeys.get(kid) ?? null;
  }
}
