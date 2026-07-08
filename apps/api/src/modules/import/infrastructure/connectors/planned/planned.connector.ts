import type { ImportConnectorDescriptor } from '@navix/contracts';

import { ValidationError } from '../../../../../shared/kernel/domain-error';
import type {
  ConnectorInput,
  ImportConnector,
} from '../../../domain/connectors/import-connector.port';
import type { ParsedRow } from '../../../domain/ports/file-parser.port';

/**
 * Conector planejado (ponto de extensão preparado, ainda sem lógica). Aparece no
 * catálogo com status `planned` e recusa execução até ser implementado. Substituir
 * por um conector real é só trocar o registro no módulo — nada mais muda.
 */
export class PlannedConnector implements ImportConnector {
  constructor(readonly descriptor: ImportConnectorDescriptor) {}

  read(_input: ConnectorInput): Promise<ParsedRow[]> {
    void _input;
    throw new ValidationError(
      `O conector "${this.descriptor.label}" está planejado e ainda não está disponível.`,
    );
  }
}
