import { ValidationError } from '../../../shared/kernel/domain-error';
import type { KaizenFeedbackRepositoryPort } from '../domain/ports/kaizen-feedback-repository.port';

import {
  GetKaizenHistoryUseCase,
  GetKaizenPreferencesUseCase,
  MAX_HISTORY,
  RecordKaizenFeedbackUseCase,
  SetKaizenPreferencesUseCase,
} from './kaizen-feedback.use-cases';

const TENANT = 'tenant-1';
const LOGIN = 'user-1';

function repo() {
  return {
    record: jest.fn().mockResolvedValue(undefined),
    recent: jest.fn().mockResolvedValue([]),
    history: jest.fn().mockResolvedValue([]),
    hidden: jest.fn().mockResolvedValue(false),
    preferences: jest.fn().mockResolvedValue({ hideRecommendations: false, reminderAt: null }),
    setPreferences: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<KaizenFeedbackRepositoryPort>;
}

const base = { tenantId: TENANT, userId: LOGIN, day: '2026-08-08', code: 'rest.long-day' };

describe('RecordKaizenFeedbackUseCase', () => {
  it('grava «foi útil»', async () => {
    const r = repo();

    await new RecordKaizenFeedbackUseCase(r).execute({ ...base, verdict: 'useful' });

    expect(r.record).toHaveBeenCalledWith(expect.objectContaining({ verdict: 'useful' }));
  });

  it('grava «não se aplica» com motivo', async () => {
    const r = repo();

    await new RecordKaizenFeedbackUseCase(r).execute({
      ...base,
      verdict: 'not-applicable',
      reason: 'already-done',
    });

    expect(r.record).toHaveBeenCalledWith(
      expect.objectContaining({ verdict: 'not-applicable', reason: 'already-done' }),
    );
  });

  it('recusa um veredito que não existe', async () => {
    await expect(
      new RecordKaizenFeedbackUseCase(repo()).execute({ ...base, verdict: 'ótimo' }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  // Texto livre viraria desabafo num campo que a empresa lê — outra promessa.
  it('recusa um motivo fora dos quatro previstos', async () => {
    await expect(
      new RecordKaizenFeedbackUseCase(repo()).execute({
        ...base,
        verdict: 'not-applicable',
        reason: 'porque hoje choveu muito e o trânsito estava impossível',
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('recusa um dia malformado', async () => {
    await expect(
      new RecordKaizenFeedbackUseCase(repo()).execute({
        ...base,
        day: '08/08/2026',
        verdict: 'useful',
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('o feedback é sempre do próprio: o id vem de quem chama, não do corpo', async () => {
    const r = repo();

    await new RecordKaizenFeedbackUseCase(r).execute({ ...base, verdict: 'useful' });

    expect(r.record).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT, userId: LOGIN }),
    );
  });
});

describe('GetKaizenHistoryUseCase', () => {
  it('limita o histórico ao teto', async () => {
    const r = repo();

    await new GetKaizenHistoryUseCase(r).execute(TENANT, LOGIN, 500);

    expect(r.history).toHaveBeenCalledWith(TENANT, LOGIN, MAX_HISTORY);
  });

  it('um limite absurdo para baixo vira 1', async () => {
    const r = repo();

    await new GetKaizenHistoryUseCase(r).execute(TENANT, LOGIN, 0);

    expect(r.history).toHaveBeenCalledWith(TENANT, LOGIN, 1);
  });
});

describe('SetKaizenPreferencesUseCase', () => {
  // Um caminho de saída mais caro do que o de entrada é a definição de dark
  // pattern: ligar e desligar são a mesma chamada.
  it('esconde e volta a mostrar com o mesmo custo', async () => {
    const r = repo();
    const uc = new SetKaizenPreferencesUseCase(r);

    await uc.execute(TENANT, LOGIN, { hideRecommendations: true, reminderAt: null });
    await uc.execute(TENANT, LOGIN, { hideRecommendations: false, reminderAt: null });

    expect(r.setPreferences).toHaveBeenNthCalledWith(1, TENANT, LOGIN, {
      hideRecommendations: true,
      reminderAt: null,
    });
    expect(r.setPreferences).toHaveBeenNthCalledWith(2, TENANT, LOGIN, {
      hideRecommendations: false,
      reminderAt: null,
    });
  });

  it('aceita uma hora de lembrete', async () => {
    const r = repo();

    await new SetKaizenPreferencesUseCase(r).execute(TENANT, LOGIN, {
      hideRecommendations: false,
      reminderAt: '07:30',
    });

    expect(r.setPreferences).toHaveBeenCalledWith(TENANT, LOGIN, {
      hideRecommendations: false,
      reminderAt: '07:30',
    });
  });

  it('desligar o lembrete é `null`, pelo mesmo caminho', async () => {
    const r = repo();

    await new SetKaizenPreferencesUseCase(r).execute(TENANT, LOGIN, {
      hideRecommendations: false,
      reminderAt: null,
    });

    expect(r.setPreferences).toHaveBeenCalledWith(TENANT, LOGIN, {
      hideRecommendations: false,
      reminderAt: null,
    });
  });

  it('recusa uma hora inválida', async () => {
    for (const hora of ['7:30', '25:00', '07:60', 'manhã']) {
      await expect(
        new SetKaizenPreferencesUseCase(repo()).execute(TENANT, LOGIN, {
          hideRecommendations: false,
          reminderAt: hora,
        }),
      ).rejects.toBeInstanceOf(ValidationError);
    }
  });
});

describe('GetKaizenPreferencesUseCase', () => {
  // Sem linha guardada, o padrão é: sugestões visíveis e **sem** lembrete.
  it('o padrão não liga nada', async () => {
    const r = repo();

    await expect(new GetKaizenPreferencesUseCase(r).execute(TENANT, LOGIN)).resolves.toEqual({
      hideRecommendations: false,
      reminderAt: null,
    });
  });
});
