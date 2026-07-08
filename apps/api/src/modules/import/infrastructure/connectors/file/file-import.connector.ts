import type { ImportConnectorDescriptor } from '@navix/contracts';

import { ValidationError } from '../../../../../shared/kernel/domain-error';
import type {
  ConnectorInput,
  ImportConnector,
} from '../../../domain/connectors/import-connector.port';
import type { FileParser, ParsedRow } from '../../../domain/ports/file-parser.port';

/**
 * Conector de arquivo: adapta um `FileParser` (CSV/Excel/PDF) à porta genérica
 * `ImportConnector`. Mantém os parsers atuais como detalhe de implementação —
 * a lógica de parsing não muda, só passa a ser exposta via conector.
 */
export class FileImportConnector implements ImportConnector {
  constructor(
    readonly descriptor: ImportConnectorDescriptor,
    private readonly parser: FileParser,
  ) {}

  async read(input: ConnectorInput): Promise<ParsedRow[]> {
    if (input.kind !== 'file') {
      throw new ValidationError(`O conector "${this.descriptor.id}" requer upload de arquivo.`);
    }
    return this.parser.parse(input.buffer);
  }
}
