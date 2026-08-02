import type { TenantBranding } from '@navix/contracts';
import { Inject, Injectable } from '@nestjs/common';

import { AppConfigService } from '../../../shared/config/app-config.service';
import {
  TENANT_BRANDING_REPOSITORY,
  type TenantBrandingRepositoryPort,
} from '../domain/ports/tenant-branding-repository.port';
import { normalizeHost, tenantSlugFromHost, toTenantBranding } from '../domain/tenant-branding';

@Injectable()
export class ResolveTenantBrandingUseCase {
  constructor(
    private readonly config: AppConfigService,
    @Inject(TENANT_BRANDING_REPOSITORY)
    private readonly branding: TenantBrandingRepositoryPort,
  ) {}

  async execute(host: string): Promise<TenantBranding | null> {
    const normalized = normalizeHost(host);
    const custom = await this.branding.findByVerifiedDomain(normalized);
    if (custom) return toTenantBranding(custom);

    const slug = tenantSlugFromHost(normalized, this.config.enterprise.tenantBaseDomain);
    if (!slug) return null;
    const record = await this.branding.findBySlug(slug);
    return record ? toTenantBranding(record) : null;
  }
}
