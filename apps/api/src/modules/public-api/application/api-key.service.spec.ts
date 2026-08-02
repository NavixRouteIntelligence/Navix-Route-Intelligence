import type { DataSource, Repository } from 'typeorm';

import { ApiKeyOrmEntity } from '../infrastructure/persistence/api-key.orm-entity';

import { ApiKeyService } from './api-key.service';

describe('ApiKeyService', () => {
  const inserted: ApiKeyOrmEntity[] = [];
  const repo = {
    create: (value: ApiKeyOrmEntity) => value,
    insert: async (value: ApiKeyOrmEntity) => void inserted.push(value),
  } as unknown as Repository<ApiKeyOrmEntity>;
  const dataSource = {} as DataSource;
  const service = new ApiKeyService(repo, dataSource);

  beforeEach(() => inserted.splice(0));

  it('retorna o segredo uma vez e persiste somente SHA-256 + prefixo', async () => {
    const result = await service.create({
      tenantId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      name: 'ERP produção',
      scopes: ['deliveries:read'],
      quotaPerMinute: 120,
    });
    expect(result.apiKey).toMatch(/^nvx_live_/);
    expect(inserted[0].secretHash).toMatch(/^[a-f0-9]{64}$/);
    expect(inserted[0].secretHash).not.toContain(result.apiKey);
    expect(result.keyPrefix).toBe(result.apiKey.slice(0, 20));
  });

  it('rejeita expiração no passado', async () => {
    await expect(
      service.create({
        tenantId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        name: 'expirada',
        scopes: ['deliveries:read'],
        quotaPerMinute: 1,
        expiresAt: '2020-01-01T00:00:00.000Z',
      }),
    ).rejects.toThrow();
  });
});
