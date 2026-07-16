import { Injectable } from '@nestjs/common';
import type { VoiceCommandView } from '@navix/contracts';

import { interpretVoiceCommand } from '../domain/voice-intent';
import type { VoiceCommandInterpreterPort } from '../domain/voice-command-interpreter.port';

/**
 * Adaptador heurístico de comandos de voz (ADR-0032): delega ao interpretador
 * por palavras-chave. Substituível por um modelo de NLU/LLM pela mesma port.
 */
@Injectable()
export class HeuristicVoiceInterpreter implements VoiceCommandInterpreterPort {
  interpret(input: { transcript: string; locale?: string }): VoiceCommandView {
    return interpretVoiceCommand(input.transcript, input.locale);
  }
}
