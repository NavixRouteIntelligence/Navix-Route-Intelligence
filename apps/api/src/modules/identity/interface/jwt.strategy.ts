import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import type { AccessTokenClaims, AuthenticatedUser } from '@navix/contracts';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { AppConfigService } from '../../../shared/config/app-config.service';

/**
 * Estratégia JWT. Valida o access token e projeta as claims no request.
 * O `TenantContext` é populado a partir daqui por um interceptor (próxima etapa).
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: AppConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.jwt.accessSecret,
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
