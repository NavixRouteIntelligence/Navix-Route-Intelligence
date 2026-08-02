import { Injectable } from '@nestjs/common';

import { ForbiddenError } from '../../../../shared/kernel/domain-error';
import type {
  EnterpriseSsoCallbackInput,
  EnterpriseSsoIdentity,
  EnterpriseSsoPort,
  EnterpriseSsoStartInput,
} from '../../application/ports/enterprise-sso.port';

/** Adaptador seguro por padrão: não inicia um fluxo sem configuração validada. */
@Injectable()
export class UnconfiguredEnterpriseSsoAdapter implements EnterpriseSsoPort {
  start(_input: EnterpriseSsoStartInput): Promise<{ redirectUrl: string; state: string }> {
    return Promise.reject(new ForbiddenError('SSO corporativo ainda não configurado.'));
  }

  complete(_input: EnterpriseSsoCallbackInput): Promise<EnterpriseSsoIdentity> {
    return Promise.reject(new ForbiddenError('SSO corporativo ainda não configurado.'));
  }
}
