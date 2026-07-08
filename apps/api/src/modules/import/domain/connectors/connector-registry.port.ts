import type { ConnectorId, ConnectorKind, ImportConnectorDescriptor } from '@navix/contracts';

import type { ImportConnector } from './import-connector.port';

/**
 * Fábrica/registro de conectores. Resolve conectores por id, lista o catálogo
 * (disponíveis + planejados) e filtra por família. É o ponto único de extensão:
 * registrar um novo conector no módulo o torna automaticamente disponível aqui.
 */
export interface ConnectorRegistryPort {
  /** Resolve um conector pronto para uso; lança se planejado/inexistente. */
  get(id: ConnectorId): ImportConnector;
  /** Catálogo completo (available + planned) para exibição/documentação. */
  all(): ImportConnectorDescriptor[];
  /** Apenas os conectores operacionais. */
  available(): ImportConnector[];
  /** Descritores de uma família específica. */
  byKind(kind: ConnectorKind): ImportConnectorDescriptor[];
}

export const CONNECTOR_REGISTRY = Symbol('CONNECTOR_REGISTRY');
