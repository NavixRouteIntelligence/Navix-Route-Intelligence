import { Inject, Injectable } from '@nestjs/common';
import type { CreateDriverRequest, Driver as DriverView } from '@navix/contracts';

import { ConflictError } from '../../../../shared/kernel/domain-error';
import {
  DRIVER_REPOSITORY,
  type DriverRepositoryPort,
} from '../../domain/ports/driver-repository.port';
import { Driver } from '../../domain/driver';
import { toDriverView } from '../mappers/driver.mapper';

export type CreateDriverCommand = CreateDriverRequest & { tenantId: string };

@Injectable()
export class CreateDriverUseCase {
  constructor(
    @Inject(DRIVER_REPOSITORY) private readonly drivers: DriverRepositoryPort,
  ) {}

  async execute(command: CreateDriverCommand): Promise<DriverView> {
    const driver = Driver.create(command);

    if (await this.drivers.existsByLicense(command.tenantId, driver.licenseNumber)) {
      throw new ConflictError('Já existe um motorista com esta habilitação.');
    }

    await this.drivers.save(driver);
    return toDriverView(driver);
  }
}
