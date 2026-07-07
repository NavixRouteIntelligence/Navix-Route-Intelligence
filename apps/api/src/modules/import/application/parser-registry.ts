import { Inject, Injectable } from '@nestjs/common';
import type { ImportFileType } from '@navix/contracts';

import { ValidationError } from '../../../shared/kernel/domain-error';
import { FILE_PARSERS, type FileParser } from '../domain/ports/file-parser.port';

@Injectable()
export class ParserRegistry {
  private readonly byType = new Map<ImportFileType, FileParser>();

  constructor(@Inject(FILE_PARSERS) parsers: FileParser[]) {
    for (const parser of parsers) this.byType.set(parser.type, parser);
  }

  get(type: ImportFileType): FileParser {
    const parser = this.byType.get(type);
    if (!parser) throw new ValidationError(`Tipo de arquivo não suportado: ${type}.`);
    return parser;
  }
}
