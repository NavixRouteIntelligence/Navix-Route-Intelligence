import { Inject, Injectable } from '@nestjs/common';
import type { Driver as DriverView } from '@navix/contracts';

import { NotFoundError } from '../../../../shared/kernel/domain-error';
import {
  DRIVER_REPOSITORY,
  type DriverRepositoryPort,
} from '../../domain/ports/driver-repository.port';
import { toDriverView } from '../mappers/driver.mapper';

@Injectable()
export class GetDriverUseCase {
  constructor(
    @Inject(DRIVER_REPOSITORY) private readonly drivers: DriverRepositoryPort,
  ) {}

  async execute(tenantId: string, id: string): Promise<DriverView> {
    const driver = await this.drivers.findById(tenantId, id);
    if (!driver) {
      throw new NotFoundError('Motorista não encontrado.');
    }
    return toDriverView(driver);
  }
}
