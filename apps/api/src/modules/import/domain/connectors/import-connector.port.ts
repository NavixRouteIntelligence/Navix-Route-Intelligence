import type { ImportConnectorDescriptor } from '@navix/contracts';

import type { ParsedRow } from '../ports/file-parser.port';

/**
 * Entrada de um conector. Discriminada para acomodar as três famílias:
 * - `file`: upload do usuário (CSV/Excel/PDF).
 * - `payload`: dado externo já recebido (e-mail, resposta de API, evento de
 *   webhook, export de ERP) — usado pelos conectores de integração futuros.
 */
export interface FileConnectorInput {
  kind: 'file';
  filename: string;
  buffer: Buffer;
}

export interface PayloadConnectorInput {
  kind: 'payload';
  payload: unknown;
}

export type ConnectorInput = FileConnectorInput | PayloadConnectorInput;

/**
 * Conector de importação: a fonte plugável de entregas. Cada conector expõe um
 * descritor (catálogo) e sabe transformar sua entrada em linhas brutas
 * (`ParsedRow[]`) para o pipeline comum de enriquecimento/validação.
 *
 * Novos módulos (Barcode, QR Code, OCR, E-mail, API, Webhooks, ERP) entram como
 * novas implementações desta porta — sem alterar casos de uso nem contrato.
 */
export interface ImportConnector {
  readonly descriptor: ImportConnectorDescriptor;
  read(input: ConnectorInput): Promise<ParsedRow[]>;
}

/** Multi-provider: todos os conectores registrados na aplicação. */
export const IMPORT_CONNECTORS = Symbol('IMPORT_CONNECTORS');
