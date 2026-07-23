import type { AuditLogPort } from '../../../shared/audit/audit-log.port';
import { ConflictError, NotFoundError } from '../../../shared/kernel/domain-error';
import { ImportBatch } from '../domain/import-batch';
import type { StoredImportRow } from '../domain/import-row';
import type { DeliveryCreatorPort } from '../domain/ports/delivery-creator.port';
import type { ImportBatchRepositoryPort } from '../domain/ports/import-batch-repository.port';
import type { RouteEstimatorPort } from '../domain/ports/route-estimator.port';
import { ConfirmImportUseCase } from './confirm-import.use-case';

const row = (over: Partial<StoredImportRow> = {}): StoredImportRow =>
  ({
    index: 0,
    recipient: 'Cliente',
    addressText: 'Rua A, 100',
    phone: null,
    orderNumber: null,
    notes: null,
    priority: 'normal',
    latitude: -23.5,
    longitude: -46.6,
    status: 'valid',
    issues: [],
    addressCategory: 'residence',
    geocoded: true,
    dedupKey: `k${Math.random()}`,
    resolved: {
      street: 'Rua A',
      number: '100',
      complement: null,
      city: 'SP',
      state: 'SP',
      postalCode: '01000-000',
      country: 'BR',
    },
    ...over,
  }) as StoredImportRow;

function build(options: { rows: StoredImportRow[]; optimize?: RouteEstimatorPort['optimize'] }) {
  const batch = ImportBatch.create({
    tenantId: 't1',
    createdBy: 'u1',
    filename: 'x.csv',
    fileType: 'csv',
    summary: {
      total: options.rows.length,
      valid: options.rows.length,
      invalid: 0,
      duplicates: 0,
      estimatedSavingsKm: 0,
      estimatedSavingsPct: 0,
    },
    rows: options.rows,
  });

  const repo: ImportBatchRepositoryPort = {
    save: async () => undefined,
    findById: async () => batch,
    findAll: async () => ({ items: [], total: 0 }),
  };
  const created: string[] = [];
  const deliveries: DeliveryCreatorPort = {
    create: async () => {
      const id = `d${created.length + 1}`;
      created.push(id);
      return id;
    },
  };
  const estimator: RouteEstimatorPort = {
    estimate: async () => ({ savingsKm: 0, savingsPct: 0 }),
    optimize: options.optimize ?? (async () => 'plan-1'),
  };
  const audit: AuditLogPort = { record: async () => undefined };

  return { uc: new ConfirmImportUseCase(repo, deliveries, estimator, audit), batch, created };
}

const command = { tenantId: 't1', actorId: 'u1', batchId: 'b1' };

describe('ConfirmImportUseCase', () => {
  it('prepara a rota automaticamente, sem opt-in (ADR-0074)', async () => {
    const { uc } = build({ rows: [row(), row({ index: 1 })] });

    const result = await uc.execute(command);

    expect(result.createdDeliveries).toBe(2);
    expect(result.routePlanId).toBe('plan-1');
  });

  it('não tenta otimizar com uma única entrega (não há sequência)', async () => {
    const optimize = jest.fn(async () => 'plan-1');
    const { uc } = build({ rows: [row()], optimize });

    const result = await uc.execute(command);

    expect(result.createdDeliveries).toBe(1);
    expect(result.routePlanId).toBeNull();
    expect(optimize).not.toHaveBeenCalled();
  });

  it('se a preparação da rota falhar, a importação NÃO se perde', async () => {
    const { uc } = build({
      rows: [row(), row({ index: 1 })],
      optimize: async () => {
        throw new Error('otimizador fora do ar');
      },
    });

    const result = await uc.execute(command);

    // As entregas foram criadas; só o plano ficou pendente.
    expect(result.createdDeliveries).toBe(2);
    expect(result.routePlanId).toBeNull();
  });

  it('ignora linhas sem georreferência', async () => {
    const { uc } = build({
      rows: [row(), row({ index: 1, latitude: null, longitude: null })],
    });

    const result = await uc.execute(command);

    expect(result.createdDeliveries).toBe(1);
  });

  it('recusa confirmar duas vezes', async () => {
    const { uc, batch } = build({ rows: [row(), row({ index: 1 })] });
    batch.markImported(2, 'plan-1');

    await expect(uc.execute(command)).rejects.toThrow(ConflictError);
  });

  it('lote inexistente vira NotFound', async () => {
    const repo: ImportBatchRepositoryPort = {
      save: async () => undefined,
      findById: async () => null,
      findAll: async () => ({ items: [], total: 0 }),
    };
    const uc = new ConfirmImportUseCase(
      repo,
      { create: async () => 'd1' },
      { estimate: async () => ({ savingsKm: 0, savingsPct: 0 }), optimize: async () => 'plan-1' },
      { record: async () => undefined },
    );

    await expect(uc.execute(command)).rejects.toThrow(NotFoundError);
  });
});
