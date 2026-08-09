import { Inject, Injectable } from '@nestjs/common';

import { ValidationError } from '../../../shared/kernel/domain-error';
import type { FeedbackReason, FeedbackVerdict } from '../domain/kaizen-relevance';
import {
  KAIZEN_FEEDBACK_REPOSITORY,
  type KaizenFeedbackRepositoryPort,
  type KaizenHistoryRow,
} from '../domain/ports/kaizen-feedback-repository.port';

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const VERDICTS: readonly FeedbackVerdict[] = ['useful', 'not-applicable'];
const REASONS: readonly FeedbackReason[] = [
  'wrong-data',
  'already-done',
  'out-of-context',
  'other',
];

/** Teto do histórico. O resumo é do dia; o histórico é contexto, não arquivo. */
export const MAX_HISTORY = 30;

/**
 * Feedback do Kaizen (ADR-0121).
 *
 * O feedback é **opcional** e não tem consequência sobre número nenhum. A única
 * coisa que ele muda é qual sugestão a mesma pessoa recebe a seguir.
 */
@Injectable()
export class RecordKaizenFeedbackUseCase {
  constructor(
    @Inject(KAIZEN_FEEDBACK_REPOSITORY) private readonly repo: KaizenFeedbackRepositoryPort,
  ) {}

  async execute(input: {
    tenantId: string;
    userId: string;
    day: string;
    code: string;
    verdict: string;
    reason?: string | null;
  }): Promise<void> {
    if (!ISO_DAY.test(input.day)) throw new ValidationError('Dia inválido: use YYYY-MM-DD.');
    if (!VERDICTS.includes(input.verdict as FeedbackVerdict)) {
      throw new ValidationError('Resposta inválida.');
    }
    const reason = input.reason ?? null;
    // Motivo só existe para «não se aplica», e só nos quatro previstos. Um
    // motivo livre viraria desabafo num campo que a empresa lê — outra promessa.
    if (reason !== null && !REASONS.includes(reason as FeedbackReason)) {
      throw new ValidationError('Motivo inválido.');
    }
    if (!input.code.trim()) throw new ValidationError('Recomendação inválida.');

    await this.repo.record({
      tenantId: input.tenantId,
      userId: input.userId,
      day: input.day,
      code: input.code,
      verdict: input.verdict as FeedbackVerdict,
      reason: reason as FeedbackReason | null,
    });
  }
}

/** Últimos resumos com a resposta que a pessoa deu, quando deu (ADR-0121). */
@Injectable()
export class GetKaizenHistoryUseCase {
  constructor(
    @Inject(KAIZEN_FEEDBACK_REPOSITORY) private readonly repo: KaizenFeedbackRepositoryPort,
  ) {}

  execute(tenantId: string, userId: string, limit = MAX_HISTORY): Promise<KaizenHistoryRow[]> {
    return this.repo.history(tenantId, userId, Math.min(Math.max(limit, 1), MAX_HISTORY));
  }
}

/** `HH:MM` em 24 horas. Sem segundos: ninguém escolhe um lembrete às 07:03:12. */
const HORA = /^([01]\d|2[0-3]):([0-5]\d)$/;

export interface KaizenPreferences {
  hideRecommendations: boolean;
  /** `null` = **sem lembrete**. É o padrão, e desligar é voltar a `null`. */
  reminderAt: string | null;
}

/**
 * Preferências do resumo (ADR-0121/0122).
 *
 * Esconder as **sugestões** mantém os resultados: quem esconde continua a ver o
 * que fez. E o lembrete é opcional, desligado por omissão, com a mesma chamada
 * a ligar e a desligar — um caminho de saída mais caro do que o de entrada é a
 * definição de *dark pattern*.
 */
@Injectable()
export class SetKaizenPreferencesUseCase {
  constructor(
    @Inject(KAIZEN_FEEDBACK_REPOSITORY) private readonly repo: KaizenFeedbackRepositoryPort,
  ) {}

  async execute(tenantId: string, userId: string, prefs: KaizenPreferences): Promise<void> {
    if (prefs.reminderAt !== null && !HORA.test(prefs.reminderAt)) {
      throw new ValidationError('Hora do lembrete inválida: use HH:MM.');
    }
    await this.repo.setPreferences(tenantId, userId, prefs);
  }
}

/** Preferências atuais. Sem linha guardada, devolve o padrão. */
@Injectable()
export class GetKaizenPreferencesUseCase {
  constructor(
    @Inject(KAIZEN_FEEDBACK_REPOSITORY) private readonly repo: KaizenFeedbackRepositoryPort,
  ) {}

  execute(tenantId: string, userId: string): Promise<KaizenPreferences> {
    return this.repo.preferences(tenantId, userId);
  }
}
