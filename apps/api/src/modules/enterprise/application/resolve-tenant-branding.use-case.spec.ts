import type { AppConfigService } from '../../../shared/config/app-config.service';
import type { TenantBrandingRepositoryPort } from '../domain/ports/tenant-branding-repository.port';
import type { TenantBrandingRecord } from '../domain/tenant-branding';

import { ResolveTenantBrandingUseCase } from './resolve-tenant-branding.use-case';

const record = {
  tenantId: 'tenant-1',
  tenantName: 'Acme',
  tenantSlug: 'acme-123456',
  displayName: 'Acme Express',
  logoUrl: null,
  primaryColor: '#112233',
  accentColor: null,
  customDomain: 'entregas.acme.pt',
  customDomainVerifiedAt: new Date(),
  updatedAt: new Date(),
} satisfies TenantBrandingRecord;

function build() {
  const repo = {
    findByVerifiedDomain: jest.fn().mockResolvedValue(null),
    findBySlug: jest.fn().mockResolvedValue(record),
  } as unknown as TenantBrandingRepositoryPort;
  const config = { enterprise: { tenantBaseDomain: 'navix.pt' } } as AppConfigService;
  return { service: new ResolveTenantBrandingUseCase(config, repo), repo };
}

describe('ResolveTenantBrandingUseCase', () => {
  it('resolve slug da plataforma e aplica defaults seguros', async () => {
    const { service, repo } = build();

    await expect(service.execute('acme-123456.navix.pt')).resolves.toMatchObject({
      displayName: 'Acme Express',
      primaryColor: '#112233',
      accentColor: '#20BFA9',
    });
    expect(repo.findBySlug).toHaveBeenCalledWith('acme-123456');
  });

  it('prefere domínio próprio verificado', async () => {
    const { service, repo } = build();
    jest.mocked(repo.findByVerifiedDomain).mockResolvedValue(record);

    await expect(service.execute('entregas.acme.pt')).resolves.toMatchObject({
      tenantSlug: 'acme-123456',
      customDomainStatus: 'verified',
    });
    expect(repo.findBySlug).not.toHaveBeenCalled();
  });

  it('host genérico não enumera tenants', async () => {
    const { service } = build();
    await expect(service.execute('app.navix.pt')).resolves.toBeNull();
  });
});
