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

/**
 * Esconder as **sugestões**, mantendo os resultados (ADR-0121).
 *
 * Não é «desativar o Kaizen»: quem esconde continua a ver o que fez. A opção
 * existe porque conselho diário não pedido é ruído, e ruído que não se pode
 * desligar é pressão.
 */
@Injectable()
export class SetKaizenPreferencesUseCase {
  constructor(
    @Inject(KAIZEN_FEEDBACK_REPOSITORY) private readonly repo: KaizenFeedbackRepositoryPort,
  ) {}

  async execute(tenantId: string, userId: string, hideRecommendations: boolean): Promise<void> {
    await this.repo.setHidden(tenantId, userId, hideRecommendations);
  }
}
