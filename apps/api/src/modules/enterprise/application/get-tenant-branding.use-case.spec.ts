import type { AppConfigService } from '../../../shared/config/app-config.service';
import { NotFoundError } from '../../../shared/kernel/domain-error';
import type { TenantBrandingRepositoryPort } from '../domain/ports/tenant-branding-repository.port';
import type { TenantBrandingRecord } from '../domain/tenant-branding';

import { GetTenantBrandingUseCase } from './get-tenant-branding.use-case';

const record: TenantBrandingRecord = {
  tenantId: 'tenant-1',
  tenantName: 'Acme',
  tenantSlug: 'acme-123456',
  displayName: 'Acme Express',
  logoUrl: null,
  primaryColor: '#112233',
  accentColor: '#445566',
  customDomain: 'go.acme.pt',
  customDomainVerifiedAt: null,
  updatedAt: new Date('2026-08-02T10:00:00.000Z'),
};

describe('GetTenantBrandingUseCase', () => {
  const config = {
    encryption: { kek: 'test-secret-enterprise' },
  } as AppConfigService;

  it('devolve instrução DNS derivada sem persistir o desafio', async () => {
    const repo = {
      findByTenant: jest.fn().mockResolvedValue(record),
    } as unknown as TenantBrandingRepositoryPort;
    const service = new GetTenantBrandingUseCase(config, repo);

    const result = await service.execute('tenant-1');

    expect(result.domainVerification).toEqual({
      name: '_navix-verification.go.acme.pt',
      value: expect.stringMatching(/^navix-verification=[A-Za-z0-9_-]{43}$/),
    });
  });

  it('não revela outro tenant quando a configuração não existe', async () => {
    const repo = {
      findByTenant: jest.fn().mockResolvedValue(null),
    } as unknown as TenantBrandingRepositoryPort;
    const service = new GetTenantBrandingUseCase(config, repo);

    await expect(service.execute('tenant-missing')).rejects.toBeInstanceOf(NotFoundError);
  });
});
