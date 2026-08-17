import type { TenantBranding } from '@navix/contracts';
import { Inject, Injectable } from '@nestjs/common';

import { AppConfigService } from '../../../shared/config/app-config.service';
import {
  TENANT_BRANDING_REPOSITORY,
  type TenantBrandingRepositoryPort,
} from '../domain/ports/tenant-branding-repository.port';
import { tenantSlugFromHost, toTenantBranding, tryNormalizeHost } from '../domain/tenant-branding';

@Injectable()
export class ResolveTenantBrandingUseCase {
  constructor(
    private readonly config: AppConfigService,
    @Inject(TENANT_BRANDING_REPOSITORY)
    private readonly branding: TenantBrandingRepositoryPort,
  ) {}

  async execute(host: string): Promise<TenantBranding | null> {
    // Host sem marca possível (`localhost`, IP, host de proxy) é ausência de
    // marca, não erro do cliente: cair no tema padrão em vez de devolver 400.
    const normalized = tryNormalizeHost(host);
    if (!normalized) return null;

    const custom = await this.branding.findByVerifiedDomain(normalized);
    if (custom) return toTenantBranding(custom);

    const slug = tenantSlugFromHost(normalized, this.config.enterprise.tenantBaseDomain);
    if (!slug) return null;
    const record = await this.branding.findBySlug(slug);
    return record ? toTenantBranding(record) : null;
  }
}
