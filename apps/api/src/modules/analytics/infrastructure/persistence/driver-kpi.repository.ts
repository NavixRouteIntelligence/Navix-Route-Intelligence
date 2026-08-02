import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, type EntityManager } from 'typeorm';

import { transactionContext } from '../../../../shared/database/transaction-context';
import type { DriverDayRow } from '../../domain/driver-performance';
import type { DriverKpiRepositoryPort } from '../../domain/ports/driver-kpi-repository.port';

/**
 * Projeção do read model por motorista (ADR-0097).
 *
 * Uma instrução por dia, agregando por `driver_id`. A conclusão é aproximada
 * por `updated_at` no estado terminal — mesma aproximação da ADR-0092, porque a
 * entrega não guarda `delivered_at`.
 *
 * `active_minutes` é a distância entre a primeira e a última conclusão do dia.
 * É uma aproximação da jornada, e serve só para sugerir descanso: subestimar um
 * dia longo é preferível a inventar tempo que não houve.
 */
@Injectable()
export class DriverKpiRepository implements DriverKpiRepositoryPort {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  private get manager(): EntityManager {
    return transactionContext.getStore() ?? this.dataSource.manager;
  }

  async rebuildDay(tenantId: string, day: string): Promise<void> {
    await this.manager.query(
      `
      WITH execucao AS (
        SELECT
          driver_id,
          count(*) FILTER (WHERE status = 'delivered')::int AS delivered,
          count(*) FILTER (WHERE status = 'failed')::int    AS failed,
          count(*) FILTER (WHERE status = 'delivered' AND updated_at <= window_end)::int AS on_time,
          coalesce(
            extract(epoch FROM (max(updated_at) - min(updated_at))) / 60, 0
          )::int AS active_minutes
          FROM deliveries
         WHERE tenant_id = $1
           AND deleted_at IS NULL
           AND driver_id IS NOT NULL
           AND status IN ('delivered', 'failed')
           AND updated_at::date = $2::date
         GROUP BY driver_id
      )
      INSERT INTO driver_kpi_daily (
        tenant_id, driver_id, day, delivered, failed, on_time, active_minutes, updated_at
      )
      SELECT $1, e.driver_id, $2::date, e.delivered, e.failed, e.on_time, e.active_minutes, now()
        FROM execucao e
      ON CONFLICT (tenant_id, driver_id, day) DO UPDATE SET
        delivered = EXCLUDED.delivered,
        failed = EXCLUDED.failed,
        on_time = EXCLUDED.on_time,
        active_minutes = EXCLUDED.active_minutes,
        updated_at = now();
      `,
      [tenantId, day],
    );
  }

  async range(
    tenantId: string,
    driverId: string,
    from: string,
    to: string,
  ): Promise<DriverDayRow[]> {
    const rows = (await this.manager.query(
      `SELECT day::text, delivered, failed, on_time, active_minutes
         FROM driver_kpi_daily
        WHERE tenant_id = $1 AND driver_id = $2 AND day BETWEEN $3::date AND $4::date
        ORDER BY day ASC`,
      [tenantId, driverId, from, to],
    )) as Record<string, string | number>[];

    return rows.map((r) => ({
      day: String(r.day),
      delivered: Number(r.delivered),
      failed: Number(r.failed),
      onTime: Number(r.on_time),
      activeMinutes: Number(r.active_minutes),
    }));
  }

  async driverIdForUser(tenantId: string, userId: string): Promise<string | null> {
    const rows = (await this.manager.query(
      `SELECT id FROM drivers
        WHERE tenant_id = $1 AND user_id = $2
        LIMIT 1`,
      [tenantId, userId],
    )) as { id: string }[];

    return rows[0]?.id ?? null;
  }
}
