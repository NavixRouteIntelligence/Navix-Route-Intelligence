import type { AuditLogPort } from '../../../../shared/audit/audit-log.port';
import { ConflictError, ForbiddenError } from '../../../../shared/kernel/domain-error';
import type { DriverRepositoryPort } from '../../domain/ports/driver-repository.port';
import type { VehicleRepositoryPort } from '../../domain/ports/vehicle-repository.port';

import { CreateVehicleUseCase } from './create-vehicle.use-case';

const audit: AuditLogPort = { record: jest.fn().mockResolvedValue(undefined) };

describe('CreateVehicleUseCase', () => {
  function buildRepo(overrides: Partial<VehicleRepositoryPort> = {}): VehicleRepositoryPort {
    return {
      save: jest.fn().mockResolvedValue(undefined),
      findById: jest.fn(),
      findAll: jest.fn(),
      existsByPlate: jest.fn().mockResolvedValue(false),
      delete: jest.fn(),
      ...overrides,
    };
  }

  function buildDrivers(linked = false): DriverRepositoryPort {
    return {
      save: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn(),
      existsByLicense: jest.fn(),
      existsByUser: jest.fn().mockResolvedValue(linked),
      findUserIdById: jest.fn(),
      findIdsByUserIds: jest.fn(),
      delete: jest.fn(),
      findActive: jest.fn().mockResolvedValue([]),
    };
  }

  const command = {
    tenantId: 'tenant-1',
    actorId: 'user-1',
    actorRoles: ['admin'],
    plate: 'xyz9k88',
    type: 'truck' as const,
    capacity: 1200,
  };

  it('cria e persiste o veículo, retornando a view pública', async () => {
    const repo = buildRepo();
    const useCase = new CreateVehicleUseCase(repo, buildDrivers(), audit);

    const result = await useCase.execute(command);

    expect(result.plate).toBe('XYZ9K88');
    expect(result.tenantId).toBe('tenant-1');
    expect(typeof result.createdAt).toBe('string');
    expect(repo.save).toHaveBeenCalledTimes(1);
  });

  it('bloqueia placa duplicada no tenant', async () => {
    const repo = buildRepo({ existsByPlate: jest.fn().mockResolvedValue(true) });
    const useCase = new CreateVehicleUseCase(repo, buildDrivers(), audit);

    await expect(useCase.execute(command)).rejects.toBeInstanceOf(ConflictError);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('permite ao motorista autônomo cadastrar o próprio veículo', async () => {
    const repo = buildRepo();
    const drivers = buildDrivers(false);
    const useCase = new CreateVehicleUseCase(repo, drivers, audit);

    await expect(useCase.execute({ ...command, actorRoles: ['driver'] })).resolves.toMatchObject({
      plate: 'XYZ9K88',
    });
    expect(drivers.existsByUser).toHaveBeenCalledWith('tenant-1', 'user-1');
  });

  it('impede motorista de empresa de cadastrar veículo na frota', async () => {
    const repo = buildRepo();
    const useCase = new CreateVehicleUseCase(repo, buildDrivers(true), audit);

    await expect(useCase.execute({ ...command, actorRoles: ['driver'] })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    expect(repo.save).not.toHaveBeenCalled();
  });
});
