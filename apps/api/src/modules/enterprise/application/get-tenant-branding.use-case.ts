import type { TenantBrandingAdmin } from '@navix/contracts';
import { Inject, Injectable } from '@nestjs/common';

import { AppConfigService } from '../../../shared/config/app-config.service';
import { NotFoundError } from '../../../shared/kernel/domain-error';
import {
  TENANT_BRANDING_REPOSITORY,
  type TenantBrandingRepositoryPort,
} from '../domain/ports/tenant-branding-repository.port';
import { domainVerificationToken, toTenantBrandingAdmin } from '../domain/tenant-branding';

@Injectable()
export class GetTenantBrandingUseCase {
  constructor(
    private readonly config: AppConfigService,
    @Inject(TENANT_BRANDING_REPOSITORY)
    private readonly branding: TenantBrandingRepositoryPort,
  ) {}

  async execute(tenantId: string): Promise<TenantBrandingAdmin> {
    const record = await this.branding.findByTenant(tenantId);
    if (!record) throw new NotFoundError('Organização não encontrada.');
    const token = record.customDomain
      ? domainVerificationToken(record.tenantId, record.customDomain, this.config.encryption.kek)
      : undefined;
    return toTenantBrandingAdmin(record, token);
  }
}
