import type { AuditLogPort } from '../../../shared/audit/audit-log.port';
import type { AppConfigService } from '../../../shared/config/app-config.service';
import { ForbiddenError } from '../../../shared/kernel/domain-error';
import type { FeatureAccessService } from '../../../shared/tenancy/feature-access.service';
import type { TenantBrandingRepositoryPort } from '../domain/ports/tenant-branding-repository.port';
import type { TenantBrandingRecord } from '../domain/tenant-branding';

import { UpdateTenantBrandingUseCase } from './update-tenant-branding.use-case';

const record: TenantBrandingRecord = {
  tenantId: 'tenant-1',
  tenantName: 'Acme',
  tenantSlug: 'acme-123456',
  displayName: null,
  logoUrl: null,
  primaryColor: null,
  accentColor: null,
  customDomain: null,
  customDomainVerifiedAt: null,
  updatedAt: null,
};

function build() {
  const features = {
    require: jest.fn().mockResolvedValue(undefined),
  } as unknown as FeatureAccessService;
  const repo = {
    findByTenant: jest.fn().mockResolvedValue(record),
    save: jest.fn().mockResolvedValue(undefined),
  } as unknown as TenantBrandingRepositoryPort;
  const audit = { record: jest.fn().mockResolvedValue(undefined) } as unknown as AuditLogPort;
  const config = {
    enterprise: { tenantBaseDomain: 'navix.pt' },
    encryption: { kek: 'test-secret-enterprise' },
  } as AppConfigService;
  return {
    service: new UpdateTenantBrandingUseCase(config, features, repo, audit),
    features,
    repo,
    audit,
  };
}

describe('UpdateTenantBrandingUseCase', () => {
  it('exige plano white-label antes de ler ou gravar', async () => {
    const { service, features, repo } = build();
    jest.mocked(features.require).mockRejectedValue(new ForbiddenError());

    await expect(
      service.execute({
        tenantId: 'tenant-1',
        actorId: 'user-1',
        patch: { displayName: 'Acme X' },
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(repo.findByTenant).not.toHaveBeenCalled();
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('grava a marca no tenant autenticado e audita somente os campos', async () => {
    const { service, repo, audit } = build();

    const result = await service.execute({
      tenantId: 'tenant-1',
      actorId: 'user-1',
      patch: { displayName: 'Acme X', customDomain: 'go.acme.pt' },
    });

    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        displayName: 'Acme X',
        customDomain: 'go.acme.pt',
      }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        actorId: 'user-1',
        action: 'enterprise.branding.updated',
        metadata: { fields: ['displayName', 'customDomain'] },
      }),
    );
    expect(result.domainVerification?.name).toBe('_navix-verification.go.acme.pt');
  });
});
