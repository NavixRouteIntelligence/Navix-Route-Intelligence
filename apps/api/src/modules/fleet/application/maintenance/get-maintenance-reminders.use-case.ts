import { Inject, Injectable } from '@nestjs/common';
import type { MaintenanceReminder } from '@navix/contracts';

import { NotFoundError } from '../../../../shared/kernel/domain-error';
import { computeReminders } from '../../domain/maintenance-reminder';
import {
  MAINTENANCE_REPOSITORY,
  type MaintenanceRepositoryPort,
} from '../../domain/ports/maintenance-repository.port';
import {
  VEHICLE_REPOSITORY,
  type VehicleRepositoryPort,
} from '../../domain/ports/vehicle-repository.port';

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Lembretes de manutenção de um veículo (FASE 3, V2): cruza os registros com o
 * hodômetro atual do veículo e a data de hoje. Só devolve os tipos que têm
 * vencimento definido.
 */
@Injectable()
export class GetMaintenanceRemindersUseCase {
  constructor(
    @Inject(MAINTENANCE_REPOSITORY) private readonly records: MaintenanceRepositoryPort,
    @Inject(VEHICLE_REPOSITORY) private readonly vehicles: VehicleRepositoryPort,
  ) {}

  async execute(tenantId: string, vehicleId: string): Promise<MaintenanceReminder[]> {
    const vehicle = await this.vehicles.findById(tenantId, vehicleId);
    if (!vehicle) throw new NotFoundError('Veículo não encontrado.');

    const records = await this.records.findByVehicle(tenantId, vehicleId);
    const computed = computeReminders(
      records.map((r) => {
        const s = r.snapshot();
        return {
          type: s.type,
          performedAt: s.performedAt,
          createdAt: s.createdAt,
          nextDueDate: s.nextDueDate,
          nextDueOdometerKm: s.nextDueOdometerKm,
        };
      }),
      { now: new Date(), currentOdometerKm: vehicle.snapshot().odometerKm },
    );

    return computed.map((c) => ({
      vehicleId,
      type: c.type,
      dueDate: c.dueDate ? isoDate(c.dueDate) : null,
      dueOdometerKm: c.dueOdometerKm,
      remainingDays: c.remainingDays,
      remainingKm: c.remainingKm,
      status: c.status,
    }));
  }
}
