import type { TenantBrandingAdmin } from '@navix/contracts';
import { Inject, Injectable } from '@nestjs/common';

import { AUDIT_LOG, type AuditLogPort } from '../../../shared/audit/audit-log.port';
import { AppConfigService } from '../../../shared/config/app-config.service';
import { ConflictError, NotFoundError } from '../../../shared/kernel/domain-error';
import { FeatureAccessService } from '../../../shared/tenancy/feature-access.service';
import {
  TENANT_BRANDING_REPOSITORY,
  type TenantBrandingRepositoryPort,
} from '../domain/ports/tenant-branding-repository.port';
import { domainVerificationToken, toTenantBrandingAdmin } from '../domain/tenant-branding';

import {
  DOMAIN_OWNERSHIP_VERIFIER,
  type DomainOwnershipVerifierPort,
} from './ports/domain-ownership-verifier.port';

@Injectable()
export class VerifyCustomDomainUseCase {
  constructor(
    private readonly config: AppConfigService,
    private readonly features: FeatureAccessService,
    @Inject(TENANT_BRANDING_REPOSITORY)
    private readonly branding: TenantBrandingRepositoryPort,
    @Inject(DOMAIN_OWNERSHIP_VERIFIER)
    private readonly ownership: DomainOwnershipVerifierPort,
    @Inject(AUDIT_LOG) private readonly audit: AuditLogPort,
  ) {}

  async execute(tenantId: string, actorId: string): Promise<TenantBrandingAdmin> {
    await this.features.require(tenantId, 'white_label');
    const current = await this.branding.findByTenant(tenantId);
    if (!current?.customDomain) {
      throw new NotFoundError('Não há domínio pendente de verificação.');
    }
    if (current.customDomainVerifiedAt) return toTenantBrandingAdmin(current);

    const token = domainVerificationToken(
      current.tenantId,
      current.customDomain,
      this.config.encryption.kek,
    );

    const valid = await this.ownership.hasVerificationRecord(current.customDomain, token);
    if (!valid) throw new ConflictError('Registro DNS de verificação ainda não encontrado.');

    const verifiedAt = new Date();
    const updated = await this.branding.markDomainVerified(
      tenantId,
      current.customDomain,
      verifiedAt,
    );
    if (!updated) {
      throw new ConflictError('O domínio foi alterado durante a verificação. Tente novamente.');
    }
    const verified = { ...current, customDomainVerifiedAt: verifiedAt, updatedAt: verifiedAt };
    await this.audit.record({
      tenantId,
      actorId,
      action: 'enterprise.domain.verified',
      resource: `domain:${current.customDomain}`,
    });
    return toTenantBrandingAdmin(verified);
  }
}
