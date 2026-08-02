import { Module } from '@nestjs/common';

import { GetTenantBrandingUseCase } from './application/get-tenant-branding.use-case';
import { DOMAIN_OWNERSHIP_VERIFIER } from './application/ports/domain-ownership-verifier.port';
import { ENTERPRISE_SSO } from './application/ports/enterprise-sso.port';
import { ResolveTenantBrandingUseCase } from './application/resolve-tenant-branding.use-case';
import { UpdateTenantBrandingUseCase } from './application/update-tenant-branding.use-case';
import { VerifyCustomDomainUseCase } from './application/verify-custom-domain.use-case';
import { TENANT_BRANDING_REPOSITORY } from './domain/ports/tenant-branding-repository.port';
import { DnsDomainOwnershipVerifier } from './infrastructure/domain/dns-domain-ownership-verifier';
import { TenantBrandingRepository } from './infrastructure/persistence/tenant-branding.repository';
import { UnconfiguredEnterpriseSsoAdapter } from './infrastructure/sso/unconfigured-enterprise-sso.adapter';
import { PublicTenantBrandingController } from './interface/public-tenant-branding.controller';
import { TenantBrandingController } from './interface/tenant-branding.controller';

@Module({
  controllers: [PublicTenantBrandingController, TenantBrandingController],
  providers: [
    GetTenantBrandingUseCase,
    ResolveTenantBrandingUseCase,
    UpdateTenantBrandingUseCase,
    VerifyCustomDomainUseCase,
    { provide: TENANT_BRANDING_REPOSITORY, useClass: TenantBrandingRepository },
    { provide: DOMAIN_OWNERSHIP_VERIFIER, useClass: DnsDomainOwnershipVerifier },
    { provide: ENTERPRISE_SSO, useClass: UnconfiguredEnterpriseSsoAdapter },
  ],
  exports: [ENTERPRISE_SSO],
})
export class EnterpriseModule {}
