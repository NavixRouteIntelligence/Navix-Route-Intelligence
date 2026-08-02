import type { AuditLogPort } from '../../../shared/audit/audit-log.port';
import type { AppConfigService } from '../../../shared/config/app-config.service';
import { ConflictError } from '../../../shared/kernel/domain-error';
import type { FeatureAccessService } from '../../../shared/tenancy/feature-access.service';
import type { TenantBrandingRepositoryPort } from '../domain/ports/tenant-branding-repository.port';
import type { TenantBrandingRecord } from '../domain/tenant-branding';

import type { DomainOwnershipVerifierPort } from './ports/domain-ownership-verifier.port';
import { VerifyCustomDomainUseCase } from './verify-custom-domain.use-case';

const pending = {
  tenantId: 'tenant-1',
  tenantName: 'Acme',
  tenantSlug: 'acme-123456',
  displayName: null,
  logoUrl: null,
  primaryColor: null,
  accentColor: null,
  customDomain: 'go.acme.pt',
  customDomainVerifiedAt: null,
  updatedAt: new Date(),
} satisfies TenantBrandingRecord;

function build(verified: boolean) {
  const features = {
    require: jest.fn().mockResolvedValue(undefined),
  } as unknown as FeatureAccessService;
  const repo = {
    findByTenant: jest.fn().mockResolvedValue(pending),
    markDomainVerified: jest.fn().mockResolvedValue(true),
  } as unknown as TenantBrandingRepositoryPort;
  const ownership = {
    hasVerificationRecord: jest.fn().mockResolvedValue(verified),
  } as unknown as DomainOwnershipVerifierPort;
  const audit = { record: jest.fn().mockResolvedValue(undefined) } as unknown as AuditLogPort;
  const config = { encryption: { kek: 'test-secret-enterprise' } } as AppConfigService;
  return {
    service: new VerifyCustomDomainUseCase(config, features, repo, ownership, audit),
    repo,
    ownership,
  };
}

describe('VerifyCustomDomainUseCase', () => {
  it('não ativa o domínio sem prova DNS', async () => {
    const { service, repo } = build(false);
    await expect(service.execute('tenant-1', 'user-1')).rejects.toBeInstanceOf(ConflictError);
    expect(repo.markDomainVerified).not.toHaveBeenCalled();
  });

  it('ativa exatamente o domínio pendente após prova DNS', async () => {
    const { service, repo, ownership } = build(true);

    await expect(service.execute('tenant-1', 'user-1')).resolves.toMatchObject({
      customDomain: 'go.acme.pt',
      customDomainStatus: 'verified',
      domainVerification: null,
    });
    expect(ownership.hasVerificationRecord).toHaveBeenCalledWith(
      'go.acme.pt',
      expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
    );
    expect(repo.markDomainVerified).toHaveBeenCalledWith(
      'tenant-1',
      'go.acme.pt',
      expect.any(Date),
    );
  });

  it('não declara o domínio verificado se ele mudou durante a consulta DNS', async () => {
    const { service, repo } = build(true);
    jest.mocked(repo.markDomainVerified).mockResolvedValue(false);

    await expect(service.execute('tenant-1', 'user-1')).rejects.toBeInstanceOf(ConflictError);
  });
});
