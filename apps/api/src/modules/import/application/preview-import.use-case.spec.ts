import type { AuditLogPort } from '../../../shared/audit/audit-log.port';
import type { ConnectorRegistryPort } from '../domain/connectors/connector-registry.port';
import type { ImportConnector } from '../domain/connectors/import-connector.port';
import type { AddressClassifierPort } from '../domain/ports/address-classifier.port';
import type { ParsedRow } from '../domain/ports/file-parser.port';
import type { GeocoderPort } from '../domain/ports/geocoder.port';
import type { ImportBatchRepositoryPort } from '../domain/ports/import-batch-repository.port';
import type { RouteEstimatorPort } from '../domain/ports/route-estimator.port';
import { PreviewImportUseCase } from './preview-import.use-case';

function buildUseCase(parsedRows: ParsedRow[], zone = 'America/Sao_Paulo') {
  const connector = {
    descriptor: {
      id: 'csv',
      kind: 'file',
      status: 'available',
      label: 'CSV',
      description: '',
      capabilities: { fileUpload: true, pull: false, push: false, requiresConfig: false },
    },
    read: async () => parsedRows,
  } satisfies ImportConnector;
  const registry: ConnectorRegistryPort = {
    get: () => connector,
    all: () => [connector.descriptor],
    available: () => [connector],
    byKind: () => [connector.descriptor],
  };
  const paises: (string | undefined)[] = [];
  const geocoder: GeocoderPort = {
    geocode: async (text: string, options) => {
      paises.push(options?.country);
      if (text.includes('sem-geo')) return null;
      if (text.includes('duvidoso')) {
        return {
          latitude: -23.5,
          longitude: -46.6,
          city: 'SP',
          confidence: 'medium' as const,
          accuracy: 'interpolated' as const,
          needsReview: true,
          reviewReason: 'A morada foi encontrada com baixa confiança; confirme antes de importar.',
        };
      }
      return {
            latitude: -23.5,
            longitude: -46.6,
            city: 'SP',
            state: 'SP',
            country: 'BR',
            // Uma morada resolvida com confiança: é o caminho normal, e o que
            // os cenários deste ficheiro exercitam.
            confidence: 'exact' as const,
            accuracy: 'rooftop' as const,
            needsReview: false,
            reviewReason: null,
          };
    },
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

  // Fuso do tenant: decide o país enviado ao geocodificador (ADR-0133).
  const zones = { findTimeZone: async () => zone };

  const uc = new PreviewImportUseCase(
    registry,
    geocoder,
    classifier,
    estimator,
    repo,
    audit,
    zones,
  );
  return { uc, saved, paises };
}

const row = (over: Partial<ParsedRow> = {}): ParsedRow => ({
  recipient: 'Cliente',
  addressText: 'Rua A, 100',
  phone: undefined,
  orderNumber: undefined,
  notes: undefined,
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

  it('morada duvidosa vai para revisão em vez de virar parada', async () => {
    // Critério de aceite: resultado de baixa confiança não vira parada
    // silenciosamente. `importableRows` só aceita `valid`, então esta linha
    // não chega a `confirm-import`.
    const { uc } = buildUseCase([row({ addressText: 'Rua duvidoso, 100' })]);

    const res = await uc.execute({ ...cmd });

    expect(res.rows[0].status).toBe('review');
    expect(res.rows[0].errors[0]).toMatch(/confirme antes de importar/i);
    expect(res.batch.summary.review).toBe(1);
    // E não é contada como inválida: a entrega existe, falta confirmar a morada.
    expect(res.batch.summary.invalid).toBe(0);
  });

  it('a revisão não se confunde com o endereço que não existe', async () => {
    const { uc } = buildUseCase([
      row({ addressText: 'Rua sem-geo' }),
      row({ addressText: 'Rua duvidoso, 100', orderNumber: 'B' }),
    ]);

    const res = await uc.execute({ ...cmd });

    expect(res.rows[0].status).toBe('invalid');
    expect(res.rows[1].status).toBe('review');
  });

  it('os totais do sumário continuam a fechar com as linhas', async () => {
    const { uc } = buildUseCase([
      row({ addressText: 'Rua A, 1', orderNumber: 'A' }),
      row({ addressText: 'Rua duvidoso, 2', orderNumber: 'B' }),
      row({ addressText: 'Rua sem-geo', orderNumber: 'C' }),
      row({ addressText: 'Rua A, 1', orderNumber: 'A' }),
    ]);

    const { summary } = (await uc.execute({ ...cmd })).batch;

    expect(
      summary.valid + summary.invalid + summary.duplicates + (summary.review ?? 0),
    ).toBe(summary.total);
  });

  it('o país enviado ao geocodificador vem do fuso do tenant', async () => {
    const { uc, paises } = buildUseCase([row({ addressText: 'Rua A, 1' })], 'Europe/Lisbon');

    await uc.execute({ ...cmd });

    expect(paises[0]).toBe('pt');
  });

  it('tenant sem fuso configurado não recebe país nenhum', async () => {
    // Um palpite resolveria a morada portuguesa no Brasil.
    const { uc, paises } = buildUseCase([row({ addressText: 'Rua A, 1' })], 'UTC');

    await uc.execute({ ...cmd });

    expect(paises[0]).toBeUndefined();
  });

  it('respeita lat/lng já presentes sem chamar geocoder', async () => {
    const { uc } = buildUseCase([row({ latitude: -1, longitude: -2 })]);
    const res = await uc.execute({ ...cmd });
    expect(res.rows[0].geocoded).toBe(false);
    expect(res.rows[0].status).toBe('valid');
  });
});
