import type { AccessInstructionView } from '@navix/contracts';

/**
 * Fonte de instruções de acesso ao destino (ADR-0028). Port desacoplada: hoje um
 * classificador heurístico por palavras-chave; amanhã NLP/LLM sobre as
 * observações — sem tocar o caso de uso.
 */
export interface AccessInstructionsPort {
  instructionsFor(input: { accessNotes?: string }): AccessInstructionView[];
}

export const ACCESS_INSTRUCTIONS = Symbol('ACCESS_INSTRUCTIONS');
