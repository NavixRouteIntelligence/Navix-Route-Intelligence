import type { ImportFileType } from '@navix/contracts';

/** Linha bruta extraída de um arquivo, antes de enriquecimento/validação. */
export interface ParsedRow {
  recipient?: string;
  addressText?: string;
  phone?: string;
  orderNumber?: string;
  notes?: string;
  /** Valor de prioridade como veio no arquivo (normalizado depois). */
  priority?: string;
  latitude?: number;
  longitude?: number;
  /** Extraída com baixa confiança (ex.: PDF sem estrutura clara). */
  lowConfidence?: boolean;
}

/**
 * Strategy de parsing por tipo de arquivo. Cada parser é o detalhe interno de um
 * conector de arquivo (ver domain/connectors) — os conectores é que são o ponto
 * de extensão do módulo.
 */
export interface FileParser {
  readonly type: ImportFileType;
  parse(buffer: Buffer): Promise<ParsedRow[]>;
}
