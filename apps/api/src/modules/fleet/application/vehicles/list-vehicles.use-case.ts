import { Inject, Injectable } from '@nestjs/common';
import type { Vehicle as VehicleView } from '@navix/contracts';

import { normalizePage, type PageParams } from '../../../../shared/kernel/pagination';
import {
  VEHICLE_REPOSITORY,
  type VehicleRepositoryPort,
} from '../../domain/ports/vehicle-repository.port';
import { toVehicleView } from '../mappers/vehicle.mapper';

export interface ListVehiclesResult {
  items: VehicleView[];
  total: number;
  page: PageParams;
}

@Injectable()
export class ListVehiclesUseCase {
  constructor(
    @Inject(VEHICLE_REPOSITORY) private readonly vehicles: VehicleRepositoryPort,
  ) {}

  async execute(tenantId: string, page?: number, pageSize?: number): Promise<ListVehiclesResult> {
    const params = normalizePage(page, pageSize);
    const { items, total } = await this.vehicles.findAll(tenantId, params);
    return { items: items.map(toVehicleView), total, page: params };
  }
}
