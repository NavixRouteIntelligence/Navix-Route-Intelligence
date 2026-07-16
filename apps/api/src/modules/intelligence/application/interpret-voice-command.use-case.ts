import { Inject, Injectable } from '@nestjs/common';
import type { VoiceCommandRequest, VoiceCommandView } from '@navix/contracts';

import { ValidationError } from '../../../shared/kernel/domain-error';
import {
  VOICE_INTERPRETER,
  type VoiceCommandInterpreterPort,
} from '../domain/voice-command-interpreter.port';

export interface InterpretVoiceCommand extends VoiceCommandRequest {
  tenantId: string;
}

const MAX_TRANSCRIPT = 500;

/**
 * Assistente por voz (ADR-0032): valida a transcrição e delega a classificação
 * de intenção ao `VoiceCommandInterpreterPort` (heurística agora, NLU/LLM depois).
 */
@Injectable()
export class InterpretVoiceCommandUseCase {
  constructor(
    @Inject(VOICE_INTERPRETER) private readonly interpreter: VoiceCommandInterpreterPort,
  ) {}

  execute(command: InterpretVoiceCommand): VoiceCommandView {
    const transcript = command.transcript?.trim();
    if (!transcript) {
      throw new ValidationError('Transcrição vazia.');
    }
    if (transcript.length > MAX_TRANSCRIPT) {
      throw new ValidationError(`Transcrição excede ${MAX_TRANSCRIPT} caracteres.`);
    }
    return this.interpreter.interpret({
      transcript,
      ...(command.locale !== undefined ? { locale: command.locale } : {}),
    });
  }
}
