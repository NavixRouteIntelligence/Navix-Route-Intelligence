import type { TenantBrandingAdmin, UpdateTenantBrandingRequest } from '@navix/contracts';
import { Inject, Injectable } from '@nestjs/common';

import { AUDIT_LOG, type AuditLogPort } from '../../../shared/audit/audit-log.port';
import { AppConfigService } from '../../../shared/config/app-config.service';
import { isUniqueViolation } from '../../../shared/database/unique-violation';
import { ConflictError, NotFoundError, ValidationError } from '../../../shared/kernel/domain-error';
import { FeatureAccessService } from '../../../shared/tenancy/feature-access.service';
import {
  TENANT_BRANDING_REPOSITORY,
  type TenantBrandingRepositoryPort,
} from '../domain/ports/tenant-branding-repository.port';
import {
  applyBrandingPatch,
  domainVerificationToken,
  toTenantBrandingAdmin,
} from '../domain/tenant-branding';

export interface UpdateTenantBrandingCommand {
  tenantId: string;
  actorId: string;
  patch: UpdateTenantBrandingRequest;
}

@Injectable()
export class UpdateTenantBrandingUseCase {
  constructor(
    private readonly config: AppConfigService,
    private readonly features: FeatureAccessService,
    @Inject(TENANT_BRANDING_REPOSITORY)
    private readonly branding: TenantBrandingRepositoryPort,
    @Inject(AUDIT_LOG) private readonly audit: AuditLogPort,
  ) {}

  async execute(command: UpdateTenantBrandingCommand): Promise<TenantBrandingAdmin> {
    if (Object.keys(command.patch).length === 0) {
      throw new ValidationError('Nenhuma configuração informada.');
    }
    await this.features.require(command.tenantId, 'white_label');
    const current = await this.branding.findByTenant(command.tenantId);
    if (!current) throw new NotFoundError('Organização não encontrada.');

    const next = applyBrandingPatch(
      current,
      command.patch,
      this.config.enterprise.tenantBaseDomain,
    );
    try {
      await this.branding.save(next);
    } catch (error) {
      if (isUniqueViolation(error, 'uq_tenant_branding_custom_domain')) {
        throw new ConflictError('Este domínio já está associado a outra organização.');
      }
      throw error;
    }

    await this.audit.record({
      tenantId: command.tenantId,
      actorId: command.actorId,
      action: 'enterprise.branding.updated',
      resource: `tenant:${command.tenantId}`,
      metadata: { fields: Object.keys(command.patch) },
    });
    const token = next.customDomain
      ? domainVerificationToken(next.tenantId, next.customDomain, this.config.encryption.kek)
      : undefined;
    return toTenantBrandingAdmin(next, token);
  }
}
