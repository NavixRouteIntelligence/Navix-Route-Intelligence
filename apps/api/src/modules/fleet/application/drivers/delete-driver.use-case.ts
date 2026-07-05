import { Inject, Injectable } from '@nestjs/common';

import { NotFoundError } from '../../../../shared/kernel/domain-error';
import {
  DRIVER_REPOSITORY,
  type DriverRepositoryPort,
} from '../../domain/ports/driver-repository.port';

@Injectable()
export class DeleteDriverUseCase {
  constructor(
    @Inject(DRIVER_REPOSITORY) private readonly drivers: DriverRepositoryPort,
  ) {}

  async execute(tenantId: string, id: string): Promise<void> {
    const driver = await this.drivers.findById(tenantId, id);
    if (!driver) {
      throw new NotFoundError('Motorista não encontrado.');
    }
    await this.drivers.delete(tenantId, id);
  }
}
