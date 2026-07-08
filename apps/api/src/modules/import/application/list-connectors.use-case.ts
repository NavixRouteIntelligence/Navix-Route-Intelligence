import { Inject, Injectable } from '@nestjs/common';
import type { ImportConnectorDescriptor } from '@navix/contracts';

import {
  CONNECTOR_REGISTRY,
  type ConnectorRegistryPort,
} from '../domain/connectors/connector-registry.port';

/** Catálogo de conectores (disponíveis + planejados) para UI e documentação. */
@Injectable()
export class ListConnectorsUseCase {
  constructor(
    @Inject(CONNECTOR_REGISTRY) private readonly connectors: ConnectorRegistryPort,
  ) {}

  execute(): ImportConnectorDescriptor[] {
    return this.connectors.all();
  }
}
