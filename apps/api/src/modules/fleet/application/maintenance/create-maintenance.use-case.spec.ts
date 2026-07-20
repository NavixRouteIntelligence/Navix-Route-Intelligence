import type { AuditLogPort } from '../../../../shared/audit/audit-log.port';
import { NotFoundError } from '../../../../shared/kernel/domain-error';
import type { MaintenanceRepositoryPort } from '../../domain/ports/maintenance-repository.port';
import type { VehicleRepositoryPort } from '../../domain/ports/vehicle-repository.port';
import { CreateMaintenanceUseCase } from './create-maintenance.use-case';

const audit: AuditLogPort = { record: jest.fn().mockResolvedValue(undefined) };

function buildRecords(overrides: Partial<MaintenanceRepositoryPort> = {}): MaintenanceRepositoryPort {
  return {
    save: jest.fn().mockResolvedValue(undefined),
    findById: jest.fn(),
    findByVehicle: jest.fn(),
    delete: jest.fn(),
    ...overrides,
  };
}

function buildVehicles(found: boolean): VehicleRepositoryPort {
  return {
    save: jest.fn(),
    findById: jest.fn().mockResolvedValue(found ? ({} as never) : null),
    findAll: jest.fn(),
    existsByPlate: jest.fn(),
    delete: jest.fn(),
  };
}

const command = {
  tenantId: 't1',
  vehicleId: 'v1',
  type: 'insurance' as const,
  performedAt: '2026-07-01',
  cost: 350.5,
  nextDueDate: '2027-07-01',
};

describe('CreateMaintenanceUseCase', () => {
  it('cria o registro, convertendo euros → cents e datas', async () => {
    const records = buildRecords();
    const useCase = new CreateMaintenanceUseCase(records, buildVehicles(true), audit);

    const view = await useCase.execute(command);

    expect(view.type).toBe('insurance');
    expect(view.cost).toBe(350.5); // volta a euros na view
    expect(view.performedAt).toBe('2026-07-01');
    expect(view.nextDueDate).toBe('2027-07-01');
    expect(records.save).toHaveBeenCalledTimes(1);
  });

  it('404 quando o veículo não é do tenant', async () => {
    const records = buildRecords();
    const useCase = new CreateMaintenanceUseCase(records, buildVehicles(false), audit);

    await expect(useCase.execute(command)).rejects.toBeInstanceOf(NotFoundError);
    expect(records.save).not.toHaveBeenCalled();
  });
});
