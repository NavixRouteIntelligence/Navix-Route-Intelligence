import { ValidationError } from '../../../shared/kernel/domain-error';
import { HeuristicVoiceInterpreter } from '../infrastructure/heuristic-voice-interpreter';
import { InterpretVoiceCommandUseCase } from './interpret-voice-command.use-case';

function build() {
  return new InterpretVoiceCommandUseCase(new HeuristicVoiceInterpreter());
}

describe('InterpretVoiceCommandUseCase', () => {
  it('classifica a intenção da transcrição', () => {
    const view = build().execute({ tenantId: 't1', transcript: 'próxima parada' });
    expect(view.intent).toBe('next_stop');
  });

  it('rejeita transcrição vazia', () => {
    expect(() => build().execute({ tenantId: 't1', transcript: '   ' })).toThrow(ValidationError);
  });

  it('rejeita transcrição muito longa', () => {
    expect(() =>
      build().execute({ tenantId: 't1', transcript: 'a'.repeat(501) }),
    ).toThrow(ValidationError);
  });
});
