import { Injectable } from '@nestjs/common';
import type { ImportFileType } from '@navix/contracts';
import { Workbook } from 'exceljs';

import type { FileParser, ParsedRow } from '../../domain/ports/file-parser.port';
import { detectColumns, rowFromCells } from './column-detection';

/**
 * Normaliza os tipos ricos do ExcelJS (rich text, fórmula, hyperlink, data) para
 * primitivos — é o que `rowFromCells` espera.
 */
function cellValue(value: unknown): unknown {
  if (value === null || value === undefined) return undefined;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    const o = value as Record<string, unknown>;
    if (Array.isArray(o.richText)) {
      return (o.richText as { text?: string }[]).map((t) => t.text ?? '').join('');
    }
    if ('result' in o) return o.result; // célula de fórmula
    if ('text' in o) return o.text; // hyperlink
    return undefined;
  }
  return value;
}

/**
 * Parser de planilhas via **ExcelJS** (ADR-0047). Substitui o `xlsx` (SheetJS do
 * npm, abandonado em 0.18.5), que tinha **Prototype Pollution + ReDoS sem
 * correção disponível** — alcançáveis por planilha enviada pelo usuário.
 */
@Injectable()
export class XlsxParser implements FileParser {
  readonly type: ImportFileType = 'xlsx';

  async parse(buffer: Buffer): Promise<ParsedRow[]> {
    const workbook = new Workbook();
    // Cast: o `Buffer` do @types/node (20) e o tipado pelo ExcelJS divergem.
    await workbook.xlsx.load(buffer as unknown as Parameters<Workbook['xlsx']['load']>[0]);
    const sheet = workbook.worksheets[0];
    if (!sheet) return [];

    const rows: unknown[][] = [];
    sheet.eachRow({ includeEmpty: false }, (row) => {
      // `row.values` do ExcelJS é 1-based (o índice 0 não é usado).
      const values = Array.isArray(row.values) ? row.values.slice(1) : [];
      rows.push(values.map(cellValue));
    });
    if (rows.length < 2) return [];

    const headers = rows[0].map((h) => String(h ?? ''));
    const map = detectColumns(headers);
    return rows.slice(1).map((cells) => rowFromCells(cells, map));
  }
}
