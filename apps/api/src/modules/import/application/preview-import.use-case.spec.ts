import type { AuditLogPort } from '../../../shared/audit/audit-log.port';
import type { AddressClassifierPort } from '../domain/ports/address-classifier.port';
import type { FileParser, ParsedRow } from '../domain/ports/file-parser.port';
import type { GeocoderPort } from '../domain/ports/geocoder.port';
import type { ImportBatchRepositoryPort } from '../domain/ports/import-batch-repository.port';
import type { RouteEstimatorPort } from '../domain/ports/route-estimator.port';
import type { ParserRegistry } from './parser-registry';
import { PreviewImportUseCase } from './preview-import.use-case';

function buildUseCase(parsedRows: ParsedRow[]) {
  const parser: FileParser = { type: 'csv', parse: async () => parsedRows };
  const registry = { get: () => parser } as unknown as ParserRegistry;
  const geocoder: GeocoderPort = {
    geocode: async (text: string) =>
      text.includes('sem-geo')
        ? null
        : { latitude: -23.5, longitude: -46.6, city: 'SP', state: 'SP', country: 'BR' },
  };
  const classifier: AddressClassifierPort = { classify: () => 'residence' };
  const estimator: RouteEstimatorPort = {
    estimate: async () => ({ savingsKm: 10, savingsPct: 25 }),
    optimize: async () => 'plan-1',
  };
  const saved: unknown[] = [];
  const repo: ImportBatchRepositoryPort = {
    save: async (b) => void saved.push(b),
    findById: async () => null,
    findAll: async () => ({ items: [], total: 0 }),
  };
  const audit: AuditLogPort = { record: async () => undefined };

  const uc = new PreviewImportUseCase(registry, geocoder, classifier, estimator, repo, audit);
  return { uc, saved };
}

const row = (over: Partial<ParsedRow> = {}): ParsedRow => ({
  recipient: 'Cliente',
  addressText: 'Rua A, 100',
  phone: null,
  orderNumber: null,
  notes: null,
  priority: 'normal',
  latitude: undefined,
  longitude: undefined,
  ...over,
});

const cmd = { tenantId: 't1', actorId: 'u1', filename: 'f.csv', fileType: 'csv' as const, buffer: Buffer.from('') };

describe('PreviewImportUseCase', () => {
  it('marca linha sem endereço como inválida', async () => {
    const { uc } = buildUseCase([row({ addressText: undefined })]);
    const res = await uc.execute({ ...cmd });
    expect(res.rows[0].status).toBe('invalid');
    expect(res.rows[0].errors).toContain('Endereço ausente.');
    expect(res.batch.summary.invalid).toBe(1);
  });

  it('marca inválida quando não há coordenadas (geocode falha)', async () => {
    const { uc } = buildUseCase([row({ addressText: 'sem-geo' })]);
    const res = await uc.execute({ ...cmd });
    expect(res.rows[0].status).toBe('invalid');
    expect(res.batch.summary.valid).toBe(0);
  });

  it('detecta duplicados pelo número da encomenda', async () => {
    const { uc } = buildUseCase([
      row({ orderNumber: 'ABC' }),
      row({ orderNumber: 'ABC' }),
      row({ orderNumber: 'XYZ' }),
    ]);
    const res = await uc.execute({ ...cmd });
    expect(res.batch.summary.valid).toBe(2);
    expect(res.batch.summary.duplicates).toBe(1);
    expect(res.rows[1].status).toBe('duplicate');
  });

  it('geocodifica e calcula economia com ≥ 2 válidas', async () => {
    const { uc } = buildUseCase([row({ orderNumber: '1' }), row({ orderNumber: '2' })]);
    const res = await uc.execute({ ...cmd });
    expect(res.rows[0].geocoded).toBe(true);
    expect(res.batch.summary.estimatedSavingsKm).toBe(10);
    expect(res.batch.summary.estimatedSavingsPct).toBe(25);
  });

  it('respeita lat/lng já presentes sem chamar geocoder', async () => {
    const { uc } = buildUseCase([row({ latitude: -1, longitude: -2 })]);
    const res = await uc.execute({ ...cmd });
    expect(res.rows[0].geocoded).toBe(false);
    expect(res.rows[0].status).toBe('valid');
  });
});
