import { Inject, Injectable } from '@nestjs/common';
import type { CreateMaintenanceRecordRequest, MaintenanceRecord as MaintenanceView } from '@navix/contracts';

import { AUDIT_LOG, type AuditLogPort } from '../../../../shared/audit/audit-log.port';
import { NotFoundError, ValidationError } from '../../../../shared/kernel/domain-error';
import { TenantContextStore } from '../../../../shared/tenancy/tenant-context';
import { MaintenanceRecord } from '../../domain/maintenance-record';
import {
  MAINTENANCE_REPOSITORY,
  type MaintenanceRepositoryPort,
} from '../../domain/ports/maintenance-repository.port';
import {
  VEHICLE_REPOSITORY,
  type VehicleRepositoryPort,
} from '../../domain/ports/vehicle-repository.port';
import { toMaintenanceView } from '../mappers/maintenance.mapper';

export type CreateMaintenanceCommand = CreateMaintenanceRecordRequest & {
  tenantId: string;
  vehicleId: string;
};

/** Interpreta 'YYYY-MM-DD' (ou ISO) como data em UTC. Lança se inválida. */
function parseDate(value: string, label: string): Date {
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00.000Z` : value;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) throw new ValidationError(`${label} inválida.`);
  return d;
}

@Injectable()
export class CreateMaintenanceUseCase {
  constructor(
    @Inject(MAINTENANCE_REPOSITORY) private readonly records: MaintenanceRepositoryPort,
    @Inject(VEHICLE_REPOSITORY) private readonly vehicles: VehicleRepositoryPort,
    @Inject(AUDIT_LOG) private readonly audit: AuditLogPort,
  ) {}

  async execute(command: CreateMaintenanceCommand): Promise<MaintenanceView> {
    const vehicle = await this.vehicles.findById(command.tenantId, command.vehicleId);
    if (!vehicle) throw new NotFoundError('Veículo não encontrado.');

    const record = MaintenanceRecord.create({
      tenantId: command.tenantId,
      vehicleId: command.vehicleId,
      type: command.type,
      performedAt: parseDate(command.performedAt, 'Data da manutenção'),
      odometerKm: command.odometerKm ?? null,
      costCents: command.cost == null ? null : Math.round(command.cost * 100),
      notes: command.notes ?? null,
      nextDueDate: command.nextDueDate ? parseDate(command.nextDueDate, 'Próximo vencimento') : null,
      nextDueOdometerKm: command.nextDueOdometerKm ?? null,
    });

    await this.records.save(record);
    const view = toMaintenanceView(record);
    await this.audit.record({
      tenantId: command.tenantId,
      actorId: TenantContextStore.get()?.userId ?? null,
      action: 'fleet.maintenance.created',
      resource: `maintenance:${view.id}`,
      metadata: { vehicleId: command.vehicleId, type: command.type },
    });
    return view;
  }
}
