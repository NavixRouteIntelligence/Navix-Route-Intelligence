import { Injectable } from '@nestjs/common';
import type { ImportFileType } from '@navix/contracts';
import Papa from 'papaparse';

import type { FileParser, ParsedRow } from '../../domain/ports/file-parser.port';
import { detectColumns, rowFromCells } from './column-detection';

@Injectable()
export class CsvParser implements FileParser {
  readonly type: ImportFileType = 'csv';

  async parse(buffer: Buffer): Promise<ParsedRow[]> {
    const parsed = Papa.parse<string[]>(buffer.toString('utf8'), {
      skipEmptyLines: true,
    });
    const rows = parsed.data;
    if (rows.length < 2) return [];

    const map = detectColumns(rows[0]);
    return rows.slice(1).map((cells) => rowFromCells(cells, map));
  }
}
