import { ConflictError } from '../../../../shared/kernel/domain-error';
import type { VehicleRepositoryPort } from '../../domain/ports/vehicle-repository.port';
import { CreateVehicleUseCase } from './create-vehicle.use-case';

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

  const command = {
    tenantId: 'tenant-1',
    plate: 'xyz9k88',
    type: 'truck' as const,
    capacity: 1200,
  };

  it('cria e persiste o veículo, retornando a view pública', async () => {
    const repo = buildRepo();
    const useCase = new CreateVehicleUseCase(repo);

    const result = await useCase.execute(command);

    expect(result.plate).toBe('XYZ9K88');
    expect(result.tenantId).toBe('tenant-1');
    expect(typeof result.createdAt).toBe('string');
    expect(repo.save).toHaveBeenCalledTimes(1);
  });

  it('bloqueia placa duplicada no tenant', async () => {
    const repo = buildRepo({ existsByPlate: jest.fn().mockResolvedValue(true) });
    const useCase = new CreateVehicleUseCase(repo);

    await expect(useCase.execute(command)).rejects.toBeInstanceOf(ConflictError);
    expect(repo.save).not.toHaveBeenCalled();
  });
});
