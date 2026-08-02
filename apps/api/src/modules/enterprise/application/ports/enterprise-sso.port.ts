import type { EnterpriseSsoProtocol } from '@navix/contracts';

export interface EnterpriseSsoStartInput {
  tenantId: string;
  protocol: EnterpriseSsoProtocol;
  returnUrl: string;
}

export interface EnterpriseSsoCallbackInput {
  tenantId: string;
  protocol: EnterpriseSsoProtocol;
  payload: Readonly<Record<string, string>>;
}

export interface EnterpriseSsoIdentity {
  externalId: string;
  email: string;
  displayName: string | null;
  groups: string[];
}

/**
 * Seam de SSO: adaptadores futuros encapsulam assinatura SAML ou OIDC
 * Authorization Code + PKCE. Identity não depende de SDK de fornecedor.
 */
export interface EnterpriseSsoPort {
  start(input: EnterpriseSsoStartInput): Promise<{ redirectUrl: string; state: string }>;
  complete(input: EnterpriseSsoCallbackInput): Promise<EnterpriseSsoIdentity>;
}

export const ENTERPRISE_SSO = Symbol('ENTERPRISE_SSO');
