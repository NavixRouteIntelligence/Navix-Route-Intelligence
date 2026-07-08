import { Inject, Injectable } from '@nestjs/common';
import type { ConnectorId, ConnectorKind, ImportConnectorDescriptor } from '@navix/contracts';

import { ValidationError } from '../../../shared/kernel/domain-error';
import type { ConnectorRegistryPort } from '../domain/connectors/connector-registry.port';
import {
  IMPORT_CONNECTORS,
  type ImportConnector,
} from '../domain/connectors/import-connector.port';

/**
 * Implementação da fábrica de conectores. Indexa todos os conectores registrados
 * (arquivo + planejados) e é o único ponto de resolução do módulo. Registrar um
 * novo conector como provider `IMPORT_CONNECTORS` o expõe automaticamente aqui.
 */
@Injectable()
export class ConnectorRegistry implements ConnectorRegistryPort {
  private readonly byId = new Map<ConnectorId, ImportConnector>();

  constructor(@Inject(IMPORT_CONNECTORS) connectors: ImportConnector[]) {
    for (const connector of connectors) {
      this.byId.set(connector.descriptor.id, connector);
    }
  }

  get(id: ConnectorId): ImportConnector {
    const connector = this.byId.get(id);
    if (!connector) {
      throw new ValidationError(`Conector não suportado: ${id}.`);
    }
    if (connector.descriptor.status !== 'available') {
      throw new ValidationError(
        `O conector "${connector.descriptor.label}" está planejado e ainda não está disponível.`,
      );
    }
    return connector;
  }

  all(): ImportConnectorDescriptor[] {
    return [...this.byId.values()].map((c) => c.descriptor);
  }

  available(): ImportConnector[] {
    return [...this.byId.values()].filter((c) => c.descriptor.status === 'available');
  }

  byKind(kind: ConnectorKind): ImportConnectorDescriptor[] {
    return this.all().filter((d) => d.kind === kind);
  }
}
