import type { AuditLogPort } from '../../../../shared/audit/audit-log.port';
import { ConflictError } from '../../../../shared/kernel/domain-error';
import type { DriverRepositoryPort } from '../../domain/ports/driver-repository.port';
import { CreateDriverUseCase } from './create-driver.use-case';

const audit: AuditLogPort = { record: jest.fn().mockResolvedValue(undefined) };

describe('CreateDriverUseCase', () => {
  function buildRepo(overrides: Partial<DriverRepositoryPort> = {}): DriverRepositoryPort {
    return {
      save: jest.fn().mockResolvedValue(undefined),
      findById: jest.fn(),
      findAll: jest.fn(),
      existsByLicense: jest.fn().mockResolvedValue(false),
      delete: jest.fn(),
      ...overrides,
    };
  }

  const command = {
    tenantId: 'tenant-1',
    name: 'Maria Souza',
    licenseNumber: 'cnh-12345',
    skills: ['Refrigerated', 'refrigerated', ' HAZMAT '],
  };

  it('cria o motorista, normaliza skills (únicas/minúsculas) e CNH', async () => {
    const repo = buildRepo();
    const useCase = new CreateDriverUseCase(repo, audit);

    const result = await useCase.execute(command);

    expect(result.licenseNumber).toBe('CNH-12345');
    expect(result.skills.sort()).toEqual(['hazmat', 'refrigerated']);
    expect(repo.save).toHaveBeenCalledTimes(1);
  });

  it('bloqueia CNH duplicada no tenant', async () => {
    const repo = buildRepo({ existsByLicense: jest.fn().mockResolvedValue(true) });
    const useCase = new CreateDriverUseCase(repo, audit);

    await expect(useCase.execute(command)).rejects.toBeInstanceOf(ConflictError);
    expect(repo.save).not.toHaveBeenCalled();
  });
});
