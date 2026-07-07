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
 * Strategy de parsing por tipo de arquivo. Novas fontes (Shopee, Amazon,
 * Shopify, Woo, OCR…) entram como novas implementações desta porta.
 */
export interface FileParser {
  readonly type: ImportFileType;
  parse(buffer: Buffer): Promise<ParsedRow[]>;
}

export const FILE_PARSERS = Symbol('FILE_PARSERS');
