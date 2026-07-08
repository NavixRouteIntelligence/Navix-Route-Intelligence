import { ValidationError } from '../../../shared/kernel/domain-error';
import type { ImportConnector } from '../domain/connectors/import-connector.port';
import { ConnectorRegistry } from './connector-registry';

const fileConnector: ImportConnector = {
  descriptor: {
    id: 'csv',
    kind: 'file',
    status: 'available',
    label: 'CSV',
    description: '',
    capabilities: { fileUpload: true, pull: false, push: false, requiresConfig: false },
  },
  read: async () => [],
};

const plannedConnector: ImportConnector = {
  descriptor: {
    id: 'ocr',
    kind: 'capture',
    status: 'planned',
    label: 'OCR',
    description: '',
    capabilities: { fileUpload: true, pull: false, push: false, requiresConfig: false },
  },
  read: async () => {
    throw new ValidationError('planejado');
  },
};

describe('ConnectorRegistry', () => {
  const registry = new ConnectorRegistry([fileConnector, plannedConnector]);

  it('resolve um conector disponível', () => {
    expect(registry.get('csv')).toBe(fileConnector);
  });

  it('recusa um conector planejado', () => {
    expect(() => registry.get('ocr')).toThrow(ValidationError);
  });

  it('recusa um conector inexistente', () => {
    expect(() => registry.get('erp')).toThrow(ValidationError);
  });

  it('lista o catálogo completo (available + planned)', () => {
    expect(registry.all().map((d) => d.id)).toEqual(['csv', 'ocr']);
  });

  it('available() retorna só os operacionais', () => {
    expect(registry.available()).toEqual([fileConnector]);
  });

  it('byKind filtra por família', () => {
    expect(registry.byKind('capture').map((d) => d.id)).toEqual(['ocr']);
    expect(registry.byKind('integration')).toEqual([]);
  });
});
