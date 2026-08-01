import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Completa o read model da ADR-0092 com acumuladores reagregáveis e preenche
 * automaticamente os últimos 365 dias dos tenants existentes.
 *
 * A migração troca `app.current_tenant` antes de cada tenant porque as tabelas
 * de origem e destino usam FORCE RLS. Assim o backfill exercita o mesmo
 * isolamento da aplicação, mesmo sendo executado pela conexão de migração.
 */
export class KpiDailyBackfill1720003500000 implements MigrationInterface {
  name = 'KpiDailyBackfill1720003500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE kpi_daily
        ADD COLUMN saved_minutes double precision NOT NULL DEFAULT 0,
        ADD COLUMN baseline_km double precision NOT NULL DEFAULT 0;
    `);

    const tenants = (await queryRunner.query('SELECT id::text AS id FROM tenants ORDER BY id')) as {
      id: string;
    }[];

    for (const tenant of tenants) {
      await queryRunner.query("SELECT set_config('app.current_tenant', $1, true)", [tenant.id]);

      // Remove a janela antes de recalcular para também eliminar dias que
      // deixaram de existir após exclusões retroativas.
      await queryRunner.query(
        `DELETE FROM kpi_daily
          WHERE tenant_id = $1
            AND day >= current_date - 364`,
        [tenant.id],
      );

      await queryRunner.query(
        `
        WITH dias AS (
          SELECT created_at::date AS day
            FROM route_plans
           WHERE tenant_id = $1 AND created_at::date >= current_date - 364
          UNION
          SELECT updated_at::date AS day
            FROM deliveries
           WHERE tenant_id = $1
             AND deleted_at IS NULL
             AND status IN ('delivered', 'failed', 'canceled')
             AND updated_at::date >= current_date - 364
          UNION
          SELECT occurred_at AS day
            FROM financial_entries
           WHERE tenant_id = $1 AND occurred_at >= current_date - 364
        ),
        planos AS (
          SELECT created_at::date AS day,
                 count(*)::int AS plans,
                 coalesce(sum((savings->>'distanceKm')::float), 0) AS saved_km,
                 coalesce(sum((savings->>'timeMinutes')::float), 0) AS saved_minutes,
                 coalesce(sum((metrics->>'totalDistanceKm')::float), 0) AS optimized_km,
                 coalesce(sum((baseline->>'totalDistanceKm')::float), 0) AS baseline_km,
                 coalesce(sum(score), 0) AS score_sum
            FROM route_plans
           WHERE tenant_id = $1 AND created_at::date >= current_date - 364
           GROUP BY created_at::date
        ),
        entregas AS (
          SELECT updated_at::date AS day,
                 count(*) FILTER (WHERE status = 'delivered')::int AS delivered,
                 count(*) FILTER (WHERE status = 'failed')::int AS failed,
                 count(*) FILTER (WHERE status = 'canceled')::int AS canceled,
                 count(*) FILTER (
                   WHERE status = 'delivered' AND updated_at <= window_end
                 )::int AS on_time
            FROM deliveries
           WHERE tenant_id = $1
             AND deleted_at IS NULL
             AND status IN ('delivered', 'failed', 'canceled')
             AND updated_at::date >= current_date - 364
           GROUP BY updated_at::date
        ),
        despesas AS (
          SELECT occurred_at AS day,
                 coalesce(sum(amount_cents), 0) / 100.0 AS expense
            FROM financial_entries
           WHERE tenant_id = $1
             AND type = 'expense'
             AND occurred_at >= current_date - 364
           GROUP BY occurred_at
        )
        INSERT INTO kpi_daily (
          tenant_id, day, plans, saved_km, saved_minutes, optimized_km,
          baseline_km, score_sum, delivered, failed, canceled, on_time,
          expense, updated_at
        )
        SELECT $1, d.day,
               coalesce(p.plans, 0), coalesce(p.saved_km, 0),
               coalesce(p.saved_minutes, 0), coalesce(p.optimized_km, 0),
               coalesce(p.baseline_km, 0), coalesce(p.score_sum, 0),
               coalesce(e.delivered, 0), coalesce(e.failed, 0),
               coalesce(e.canceled, 0), coalesce(e.on_time, 0),
               coalesce(x.expense, 0), now()
          FROM dias d
          LEFT JOIN planos p USING (day)
          LEFT JOIN entregas e USING (day)
          LEFT JOIN despesas x USING (day);
        `,
        [tenant.id],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE kpi_daily
        DROP COLUMN IF EXISTS baseline_km,
        DROP COLUMN IF EXISTS saved_minutes;
    `);
  }
}
