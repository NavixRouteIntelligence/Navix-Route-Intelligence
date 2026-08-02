import { ForbiddenError } from '../../../../shared/kernel/domain-error';

import { UnconfiguredEnterpriseSsoAdapter } from './unconfigured-enterprise-sso.adapter';

describe('UnconfiguredEnterpriseSsoAdapter', () => {
  const adapter = new UnconfiguredEnterpriseSsoAdapter();

  it('falha fechado ao iniciar OIDC', async () => {
    await expect(
      adapter.start({
        tenantId: 'tenant-1',
        protocol: 'oidc',
        returnUrl: 'https://app.navix.pt/callback',
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('falha fechado ao concluir SAML', async () => {
    await expect(
      adapter.complete({
        tenantId: 'tenant-1',
        protocol: 'saml',
        payload: {},
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});
