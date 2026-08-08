import { TenantAccountTypeRepository } from './tenant-account-type.repository';
import type { DataSource } from 'typeorm';

function ds(query: jest.Mock): DataSource {
  return { query } as unknown as DataSource;
}

describe('TenantAccountTypeRepository', () => {
  it('lê o tipo de conta do tenant', async () => {
    const q = jest.fn().mockResolvedValue([{ account_type: 'driver' }]);

    await expect(new TenantAccountTypeRepository(ds(q)).findAccountType('t1')).resolves.toBe(
      'driver',
    );
  });

  it('cacheia: o tipo não muda depois do registo', async () => {
    const q = jest.fn().mockResolvedValue([{ account_type: 'driver' }]);
    const repo = new TenantAccountTypeRepository(ds(q));

    await repo.findAccountType('t1');
    await repo.findAccountType('t1');

    expect(q).toHaveBeenCalledTimes(1);
  });

  // Falhar para `driver` reabriria o vazamento: o rollup do tenant passaria por
  // desempenho pessoal sempre que o banco tossisse (ADR-0116).
  it('falha de infraestrutura devolve `company`, o valor que restringe', async () => {
    const q = jest.fn().mockRejectedValue(new Error('banco fora'));

    await expect(new TenantAccountTypeRepository(ds(q)).findAccountType('t1')).resolves.toBe(
      'company',
    );
  });

  it('não cacheia a falha — a próxima chamada pode recuperar', async () => {
    const q = jest
      .fn()
      .mockRejectedValueOnce(new Error('banco fora'))
      .mockResolvedValue([{ account_type: 'driver' }]);
    const repo = new TenantAccountTypeRepository(ds(q));

    await repo.findAccountType('t1');

    await expect(repo.findAccountType('t1')).resolves.toBe('driver');
  });

  it('tenant inexistente ou valor estranho vira `company`', async () => {
    const q = jest.fn().mockResolvedValue([]);

    await expect(new TenantAccountTypeRepository(ds(q)).findAccountType('t1')).resolves.toBe(
      'company',
    );
  });
});
