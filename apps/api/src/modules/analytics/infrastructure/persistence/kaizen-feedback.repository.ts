import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';

import { transactionContext } from '../../../../shared/database/transaction-context';
import type {
  KaizenFeedbackInput,
  KaizenFeedbackRepositoryPort,
  KaizenHistoryRow,
} from '../../domain/ports/kaizen-feedback-repository.port';
import type {
  FeedbackReason,
  FeedbackVerdict,
  KaizenFeedbackEntry,
} from '../../domain/kaizen-relevance';

/**
 * Feedback e preferências do Kaizen (ADR-0121).
 *
 * Todas as consultas levam `user_id` além do tenant — não porque a RLS não
 * baste para o tenant, mas porque **dentro** de um tenant o feedback continua a
 * ser de uma pessoa. Não existe método que aceite o id de outra.
 */
@Injectable()
export class KaizenFeedbackRepository implements KaizenFeedbackRepositoryPort {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  private get manager(): EntityManager {
    return transactionContext.getStore() ?? this.dataSource.manager;
  }

  async record(input: KaizenFeedbackInput): Promise<void> {
    await this.manager.query(
      `INSERT INTO kaizen_feedback (tenant_id, user_id, day, code, verdict, reason)
       VALUES ($1, $2, $3::date, $4, $5, $6)
       ON CONFLICT (tenant_id, user_id, day) DO UPDATE SET
         code = EXCLUDED.code,
         verdict = EXCLUDED.verdict,
         reason = EXCLUDED.reason,
         created_at = now()`,
      [
        input.tenantId,
        input.userId,
        input.day,
        input.code,
        input.verdict,
        // `reason` só acompanha «não se aplica»: um motivo colado a «foi útil»
        // não significaria nada e poluiria a regra de relevância.
        input.verdict === 'not-applicable' ? (input.reason ?? null) : null,
      ],
    );
  }

  async recent(tenantId: string, userId: string, days: number): Promise<KaizenFeedbackEntry[]> {
    const rows = (await this.manager.query(
      `SELECT day::text, code, verdict, reason
         FROM kaizen_feedback
        WHERE tenant_id = $1 AND user_id = $2 AND day >= current_date - $3::int
        ORDER BY day DESC`,
      [tenantId, userId, days],
    )) as Record<string, string | null>[];

    return rows.map((r) => ({
      day: String(r.day),
      code: String(r.code),
      verdict: r.verdict as FeedbackVerdict,
      reason: (r.reason as FeedbackReason | null) ?? null,
    }));
  }

  async history(tenantId: string, userId: string, limit: number): Promise<KaizenHistoryRow[]> {
    // O histórico junta o **resultado** (read model) com o que a pessoa
    // respondeu. A recomendação daquele dia não está gravada de propósito
    // (ADR-0121): o que se guarda é o código a que ela respondeu, quando houve
    // resposta. Um dia sem resposta aparece com os números e `code: null`.
    const rows = (await this.manager.query(
      `SELECT k.day::text, k.delivered, k.failed,
              f.code, f.verdict, f.reason
         FROM driver_kpi_daily k
         LEFT JOIN kaizen_feedback f
           ON f.tenant_id = k.tenant_id AND f.user_id = $2 AND f.day = k.day
        WHERE k.tenant_id = $1
          AND k.user_id IS NOT DISTINCT FROM $2
          AND k.delivered + k.failed > 0
        ORDER BY k.day DESC
        LIMIT $3`,
      [tenantId, userId, limit],
    )) as Record<string, string | number | null>[];

    return rows.map((r) => ({
      day: String(r.day),
      delivered: Number(r.delivered),
      failed: Number(r.failed),
      code: (r.code as string | null) ?? null,
      verdict: (r.verdict as FeedbackVerdict | null) ?? null,
      reason: (r.reason as FeedbackReason | null) ?? null,
    }));
  }

  async hidden(tenantId: string, userId: string): Promise<boolean> {
    const rows = (await this.manager.query(
      `SELECT hide_recommendations FROM kaizen_preferences
        WHERE tenant_id = $1 AND user_id = $2`,
      [tenantId, userId],
    )) as { hide_recommendations: boolean }[];

    return rows[0]?.hide_recommendations === true;
  }

  async preferences(
    tenantId: string,
    userId: string,
  ): Promise<{ hideRecommendations: boolean; reminderAt: string | null }> {
    const rows = (await this.manager.query(
      `SELECT hide_recommendations, to_char(reminder_at, 'HH24:MI') AS reminder_at
         FROM kaizen_preferences WHERE tenant_id = $1 AND user_id = $2`,
      [tenantId, userId],
    )) as { hide_recommendations: boolean; reminder_at: string | null }[];

    // Sem linha, o padrão: sugestões visíveis e **sem** lembrete.
    return {
      hideRecommendations: rows[0]?.hide_recommendations === true,
      reminderAt: rows[0]?.reminder_at ?? null,
    };
  }

  async setPreferences(
    tenantId: string,
    userId: string,
    prefs: { hideRecommendations: boolean; reminderAt: string | null },
  ): Promise<void> {
    await this.manager.query(
      `INSERT INTO kaizen_preferences (tenant_id, user_id, hide_recommendations, reminder_at, updated_at)
       VALUES ($1, $2, $3, $4::time, now())
       ON CONFLICT (tenant_id, user_id) DO UPDATE SET
         hide_recommendations = EXCLUDED.hide_recommendations,
         reminder_at = EXCLUDED.reminder_at,
         updated_at = now()`,
      [tenantId, userId, prefs.hideRecommendations, prefs.reminderAt],
    );
  }
}
