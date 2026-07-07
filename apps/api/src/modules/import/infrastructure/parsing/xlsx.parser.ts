import { Injectable } from '@nestjs/common';
import type { ImportFileType } from '@navix/contracts';
import * as XLSX from 'xlsx';

import type { FileParser, ParsedRow } from '../../domain/ports/file-parser.port';
import { detectColumns, rowFromCells } from './column-detection';

@Injectable()
export class XlsxParser implements FileParser {
  readonly type: ImportFileType = 'xlsx';

  async parse(buffer: Buffer): Promise<ParsedRow[]> {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) return [];

    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false });
    if (rows.length < 2) return [];

    const headers = rows[0].map((h) => String(h ?? ''));
    const map = detectColumns(headers);
    return rows.slice(1).map((cells) => rowFromCells(cells, map));
  }
}
