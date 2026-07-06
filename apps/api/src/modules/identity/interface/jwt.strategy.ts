import { Inject, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import type { AccessTokenClaims, AuthenticatedUser } from '@navix/contracts';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { KEY_RING, type KeyRingPort } from '../../../shared/security/keys/key-ring.port';

/** Extrai o `kid` do cabeçalho do JWT sem verificar a assinatura. */
function kidFromToken(token: string): string | null {
  const headerB64 = token.split('.')[0];
  if (!headerB64) return null;
  try {
    const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8')) as {
      kid?: string;
    };
    return header.kid ?? null;
  } catch {
    return null;
  }
}

/**
 * Estratégia JWT (RS256). A chave pública de verificação é selecionada pelo
 * `kid` do token via KeyRing — o que permite rotação de chaves sem invalidar
 * tokens em voo.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(@Inject(KEY_RING) keyRing: KeyRingPort) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      algorithms: ['RS256'],
      secretOrKeyProvider: (
        _request: unknown,
        rawJwtToken: string,
        done: (err: Error | null, secret?: string) => void,
      ) => {
        const kid = kidFromToken(rawJwtToken);
        const key = kid ? keyRing.getPublicKey(kid) : null;
        if (!key) {
          done(new Error('Chave de verificação desconhecida (kid).'));
          return;
        }
        done(null, key);
      },
    });
  }

  validate(payload: AccessTokenClaims): AuthenticatedUser {
    return {
      id: payload.sub,
      tenantId: payload.tenantId,
      email: '',
      roles: payload.roles ?? [],
    };
  }
}
