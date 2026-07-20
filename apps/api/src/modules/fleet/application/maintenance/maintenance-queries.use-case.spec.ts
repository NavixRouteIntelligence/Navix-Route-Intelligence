import type { AuditLogPort } from '../../../../shared/audit/audit-log.port';
import { NotFoundError } from '../../../../shared/kernel/domain-error';
import { MaintenanceRecord } from '../../domain/maintenance-record';
import type { MaintenanceRepositoryPort } from '../../domain/ports/maintenance-repository.port';
import type { VehicleRepositoryPort } from '../../domain/ports/vehicle-repository.port';
import { DeleteMaintenanceUseCase } from './delete-maintenance.use-case';
import { ListMaintenanceUseCase } from './list-maintenance.use-case';

const audit: AuditLogPort = { record: jest.fn().mockResolvedValue(undefined) };

function record(): MaintenanceRecord {
  return MaintenanceRecord.create({
    tenantId: 't1',
    vehicleId: 'v1',
    type: 'tires',
    performedAt: new Date('2026-07-01T00:00:00.000Z'),
    costCents: 12000,
  });
}

function records(overrides: Partial<MaintenanceRepositoryPort> = {}): MaintenanceRepositoryPort {
  return {
    save: jest.fn(),
    findById: jest.fn(),
    findByVehicle: jest.fn(),
    delete: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function vehicles(found: boolean): VehicleRepositoryPort {
  return {
    save: jest.fn(),
    findById: jest.fn().mockResolvedValue(found ? ({} as never) : null),
    findAll: jest.fn(),
    existsByPlate: jest.fn(),
    delete: jest.fn(),
  };
}

describe('ListMaintenanceUseCase', () => {
  it('lista os registros do veículo como view (cents → euros)', async () => {
    const repo = records({ findByVehicle: jest.fn().mockResolvedValue([record()]) });
    const useCase = new ListMaintenanceUseCase(repo, vehicles(true));

    const result = await useCase.execute('t1', 'v1');

    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('tires');
    expect(result[0].cost).toBe(120);
  });

  it('404 quando o veículo não é do tenant', async () => {
    const useCase = new ListMaintenanceUseCase(records(), vehicles(false));
    await expect(useCase.execute('t1', 'v1')).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('DeleteMaintenanceUseCase', () => {
  it('apaga um registro existente e audita', async () => {
    const repo = records({ findById: jest.fn().mockResolvedValue(record()) });
    const useCase = new DeleteMaintenanceUseCase(repo, audit);

    await useCase.execute('t1', 'm1');

    expect(repo.delete).toHaveBeenCalledWith('t1', 'm1');
  });

  it('404 quando o registro não existe', async () => {
    const repo = records({ findById: jest.fn().mockResolvedValue(null) });
    const useCase = new DeleteMaintenanceUseCase(repo, audit);

    await expect(useCase.execute('t1', 'm1')).rejects.toBeInstanceOf(NotFoundError);
    expect(repo.delete).not.toHaveBeenCalled();
  });
});
