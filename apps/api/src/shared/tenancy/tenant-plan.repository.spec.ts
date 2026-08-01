import { Logger } from '@nestjs/common';
import type { DataSource } from 'typeorm';

import { TenantPlanRepository } from './tenant-plan.repository';

function repositoryReturning(rows: unknown[]) {
  const query = jest.fn().mockResolvedValue(rows);
  const dataSource = { query } as unknown as DataSource;
  return { repository: new TenantPlanRepository(dataSource), query };
}

describe('TenantPlanRepository', () => {
  it('normaliza e mantém o plano em cache por tenant', async () => {
    const { repository, query } = repositoryReturning([{ plan: ' Fleet ' }]);

    await expect(repository.findPlan('tenant-1')).resolves.toBe('fleet');
    await expect(repository.findPlan('tenant-1')).resolves.toBe('fleet');

    expect(query).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith('SELECT plan FROM tenants WHERE id = $1', ['tenant-1']);
  });

  it('tenant inexistente não recebe plano implícito', async () => {
    await expect(repositoryReturning([]).repository.findPlan('missing')).resolves.toBeNull();
  });

  it('falha de banco nega e não é cacheada', async () => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const query = jest.fn().mockRejectedValue(new Error('offline'));
    const repository = new TenantPlanRepository({ query } as unknown as DataSource);

    await expect(repository.findPlan('tenant-1')).resolves.toBeNull();
    await expect(repository.findPlan('tenant-1')).resolves.toBeNull();

    expect(query).toHaveBeenCalledTimes(2);
    jest.restoreAllMocks();
  });
});
