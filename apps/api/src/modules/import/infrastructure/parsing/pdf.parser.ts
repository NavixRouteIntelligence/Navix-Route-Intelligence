import { Injectable, Logger } from '@nestjs/common';
import type { ImportFileType } from '@navix/contracts';
import pdfParse from 'pdf-parse';

import type { FileParser, ParsedRow } from '../../domain/ports/file-parser.port';

const PHONE_RE = /(\(?\d{2}\)?\s?)?\d{4,5}-?\d{4}/;

/**
 * Parser best-effort de PDF: extrai o texto e trata cada linha "com cara de
 * endereço" (contém número e é longa) como uma parada. Marca todas como
 * `lowConfidence` — sem OCR/IA, o resultado exige revisão. A porta está pronta
 * para uma implementação com OCR no futuro.
 */
@Injectable()
export class PdfParser implements FileParser {
  private readonly logger = new Logger(PdfParser.name);
  readonly type: ImportFileType = 'pdf';

  async parse(buffer: Buffer): Promise<ParsedRow[]> {
    let text = '';
    try {
      const data = await pdfParse(buffer);
      text = data.text ?? '';
    } catch (error) {
      this.logger.warn(`Falha ao ler PDF: ${error instanceof Error ? error.message : error}`);
      return [];
    }

    const rows: ParsedRow[] = [];
    for (const raw of text.split('\n')) {
      const line = raw.trim();
      if (line.length < 12 || !/\d/.test(line)) continue; // provavelmente não é endereço
      const phone = line.match(PHONE_RE)?.[0];
      rows.push({
        addressText: line,
        phone: phone ?? undefined,
        lowConfidence: true,
      });
    }
    return rows;
  }
}
