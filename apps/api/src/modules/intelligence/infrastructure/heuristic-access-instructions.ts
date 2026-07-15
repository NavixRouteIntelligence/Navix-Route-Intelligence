import { Injectable } from '@nestjs/common';
import type { AccessInstructionView } from '@navix/contracts';

import { classifyAccessNotes } from '../domain/access-instructions';
import type { AccessInstructionsPort } from '../domain/access-instructions.port';

/**
 * Adaptador heurístico das instruções de acesso (ADR-0028): classifica as
 * observações por palavras-chave. Substituível por NLP/LLM pela mesma port.
 */
@Injectable()
export class HeuristicAccessInstructions implements AccessInstructionsPort {
  instructionsFor(input: { accessNotes?: string }): AccessInstructionView[] {
    return classifyAccessNotes(input.accessNotes);
  }
}
