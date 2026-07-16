import type { VoiceCommandView } from '@navix/contracts';

/**
 * Interpretação de comandos de voz (ADR-0032). Port desacoplada: hoje uma
 * heurística por palavras-chave (PT/EN/ES); amanhã um modelo de NLU/LLM — sem
 * tocar o caso de uso. O STT/TTS ficam no navegador.
 */
export interface VoiceCommandInterpreterPort {
  interpret(input: { transcript: string; locale?: string }): VoiceCommandView;
}

export const VOICE_INTERPRETER = Symbol('VOICE_INTERPRETER');
