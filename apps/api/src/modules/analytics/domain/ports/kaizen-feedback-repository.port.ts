import type { FeedbackReason, FeedbackVerdict, KaizenFeedbackEntry } from '../kaizen-relevance';

export interface KaizenFeedbackInput {
  tenantId: string;
  userId: string;
  day: string;
  code: string;
  verdict: FeedbackVerdict;
  reason?: FeedbackReason | null;
}

/** Um dia do histórico, como o motorista o vê. */
export interface KaizenHistoryRow {
  day: string;
  delivered: number;
  failed: number;
  /** Código da recomendação daquele dia, quando houve. */
  code: string | null;
  verdict: FeedbackVerdict | null;
  reason: FeedbackReason | null;
}

/**
 * Feedback e preferências do Kaizen (ADR-0121). Escopado por tenant (RLS) e
 * sempre pelo **próprio** utilizador — não há método que aceite o id de outro.
 */
export interface KaizenFeedbackRepositoryPort {
  /** Grava ou substitui o feedback do dia. Mudar de ideias não soma. */
  record(input: KaizenFeedbackInput): Promise<void>;

  /** Feedback recente do próprio utilizador, do mais novo para o mais velho. */
  recent(tenantId: string, userId: string, days: number): Promise<KaizenFeedbackEntry[]>;

  /** Últimos resumos com a ação sugerida e o que a pessoa respondeu. */
  history(tenantId: string, userId: string, limit: number): Promise<KaizenHistoryRow[]>;

  hidden(tenantId: string, userId: string): Promise<boolean>;
  setHidden(tenantId: string, userId: string, hidden: boolean): Promise<void>;
}

export const KAIZEN_FEEDBACK_REPOSITORY = Symbol('KAIZEN_FEEDBACK_REPOSITORY');
