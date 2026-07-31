import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, type EntityManager } from 'typeorm';

import { transactionContext } from '../../../../shared/database/transaction-context';
import type { KpiDailyRow } from '../../domain/kpi';
import type { KpiRepositoryPort } from '../../domain/ports/kpi-repository.port';

/**
 * Projeção do read model (ADR-0092).
 *
 * Uma única instrução por dia: as três fontes (planos, entregas, despesas) são
 * agregadas em CTEs e gravadas com `ON CONFLICT DO UPDATE`. Fazer isso em SQL,
 * e não carregando linhas para a aplicação, é o que mantém a recomputação
 * barata o bastante para rodar a cada evento.
 *
 * Roda sob a transação de tenant do chamador — a RLS de cada tabela de origem
 * continua valendo, então a projeção não consegue enxergar dado de outro tenant
 * nem por engano.
 */
@Injectable()
export class KpiRepository implements KpiRepositoryPort {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  private get manager(): EntityManager {
    return transactionContext.getStore() ?? this.dataSource.manager;
  }

  async rebuildDay(tenantId: string, day: string): Promise<void> {
    await this.manager.query(
      `
      WITH planos AS (
        SELECT count(*)::int AS plans,
               coalesce(sum((savings->>'distanceKm')::float), 0) AS saved_km,
               coalesce(sum((metrics->>'totalDistanceKm')::float), 0) AS optimized_km,
               coalesce(sum(score), 0) AS score_sum
          FROM route_plans
         WHERE tenant_id = $1 AND created_at::date = $2::date
      ),
      entregas AS (
        -- A conclusão é aproximada por "updated_at" no estado terminal: a
        -- entrega não guarda "delivered_at" (ver ADR-0087). É a mesma
        -- aproximação que "countDeliveredInRange" já usava.
        SELECT
          count(*) FILTER (WHERE status = 'delivered')::int AS delivered,
          count(*) FILTER (WHERE status = 'failed')::int    AS failed,
          count(*) FILTER (WHERE status = 'canceled')::int  AS canceled,
          -- No prazo = concluída até o fim da janela.
          count(*) FILTER (WHERE status = 'delivered' AND updated_at <= window_end)::int AS on_time
          FROM deliveries
         WHERE tenant_id = $1
           AND deleted_at IS NULL
           AND status IN ('delivered', 'failed', 'canceled')
           AND updated_at::date = $2::date
      ),
      despesas AS (
        -- O ledger guarda centavos em inteiro (evita float em dinheiro); o KPI
        -- é em unidade monetária, então converte só aqui, na fronteira.
        SELECT coalesce(sum(amount_cents), 0) / 100.0 AS expense
          FROM financial_entries
         WHERE tenant_id = $1 AND type = 'expense' AND occurred_at = $2::date
      )
      INSERT INTO kpi_daily (
        tenant_id, day, plans, saved_km, optimized_km, score_sum,
        delivered, failed, canceled, on_time, expense, updated_at
      )
      SELECT $1, $2::date, p.plans, p.saved_km, p.optimized_km, p.score_sum,
             e.delivered, e.failed, e.canceled, e.on_time, d.expense, now()
        FROM planos p, entregas e, despesas d
      ON CONFLICT (tenant_id, day) DO UPDATE SET
        plans = EXCLUDED.plans,
        saved_km = EXCLUDED.saved_km,
        optimized_km = EXCLUDED.optimized_km,
        score_sum = EXCLUDED.score_sum,
        delivered = EXCLUDED.delivered,
        failed = EXCLUDED.failed,
        canceled = EXCLUDED.canceled,
        on_time = EXCLUDED.on_time,
        expense = EXCLUDED.expense,
        updated_at = now();
      `,
      [tenantId, day],
    );
  }

  async range(tenantId: string, from: string, to: string): Promise<KpiDailyRow[]> {
    const rows = (await this.manager.query(
      `SELECT day::text, plans, saved_km, optimized_km, score_sum,
              delivered, failed, canceled, on_time, expense
         FROM kpi_daily
        WHERE tenant_id = $1 AND day BETWEEN $2::date AND $3::date
        ORDER BY day ASC`,
      [tenantId, from, to],
    )) as Record<string, string | number>[];

    return rows.map((r) => ({
      day: String(r.day),
      plans: Number(r.plans),
      savedKm: Number(r.saved_km),
      optimizedKm: Number(r.optimized_km),
      scoreSum: Number(r.score_sum),
      delivered: Number(r.delivered),
      failed: Number(r.failed),
      canceled: Number(r.canceled),
      onTime: Number(r.on_time),
      expense: Number(r.expense),
    }));
  }
}
