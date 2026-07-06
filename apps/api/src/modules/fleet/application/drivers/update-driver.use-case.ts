import { Inject, Injectable } from '@nestjs/common';
import type { Driver as DriverView, UpdateDriverRequest } from '@navix/contracts';

import { AUDIT_LOG, type AuditLogPort } from '../../../../shared/audit/audit-log.port';
import { ConflictError, NotFoundError } from '../../../../shared/kernel/domain-error';
import { TenantContextStore } from '../../../../shared/tenancy/tenant-context';
import {
  DRIVER_REPOSITORY,
  type DriverRepositoryPort,
} from '../../domain/ports/driver-repository.port';
import { toDriverView } from '../mappers/driver.mapper';

export type UpdateDriverCommand = UpdateDriverRequest & { tenantId: string; id: string };

@Injectable()
export class UpdateDriverUseCase {
  constructor(
    @Inject(DRIVER_REPOSITORY) private readonly drivers: DriverRepositoryPort,
    @Inject(AUDIT_LOG) private readonly audit: AuditLogPort,
  ) {}

  async execute(command: UpdateDriverCommand): Promise<DriverView> {
    const driver = await this.drivers.findById(command.tenantId, command.id);
    if (!driver) {
      throw new NotFoundError('Motorista não encontrado.');
    }

    driver.update(command);

    if (
      command.licenseNumber !== undefined &&
      (await this.drivers.existsByLicense(command.tenantId, driver.licenseNumber, command.id))
    ) {
      throw new ConflictError('Já existe um motorista com esta habilitação.');
    }

    await this.drivers.save(driver);
    await this.audit.record({
      tenantId: command.tenantId,
      actorId: TenantContextStore.get()?.userId ?? null,
      action: 'fleet.driver.updated',
      resource: `driver:${command.id}`,
    });
    return toDriverView(driver);
  }
}
