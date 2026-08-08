import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { VehicleType } from '@navix/contracts';
import { DataSource, EntityManager } from 'typeorm';

import { transactionContext } from '../../../../shared/database/transaction-context';
import type { DailyRawRow, DailySubject } from '../../domain/daily-subject';
import type { DriverKpiRepositoryPort } from '../../domain/ports/driver-kpi-repository.port';

/**
 * Read model diário por **sujeito** (ADR-0117): a ficha quando existe, o login
 * quando não existe.
 *
 * A projeção é recomputação total do dia — apaga e reescreve dentro da mesma
 * transação. É o que a torna idempotente sem depender de o evento chegar uma
 * vez só, e é também o que remove linhas que deixaram de ter origem (uma
 * entrega apagada não pode continuar contada).
 */
@Injectable()
export class DriverKpiRepository implements DriverKpiRepositoryPort {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  private get manager(): EntityManager {
    return transactionContext.getStore() ?? this.dataSource.manager;
  }

  async rebuildDay(tenantId: string, day: string): Promise<void> {
    await this.manager.query(
      `DELETE FROM driver_kpi_daily WHERE tenant_id = $1 AND day = $2::date`,
      [tenantId, day],
    );

    await this.manager.query(
      `
      WITH autonomo AS (
        -- O sujeito sem ficha só existe em conta de motorista (ADR-0116): num
        -- tenant de empresa, entrega sem motorista é entrega por atribuir, não
        -- trabalho de alguém.
        SELECT u.id AS user_id
          FROM users u
          JOIN tenants t ON t.id = u.tenant_id
         WHERE u.tenant_id = $1 AND t.account_type = 'driver'
         ORDER BY u.created_at
         LIMIT 1
      ),
      finalizadas AS (
        SELECT d.driver_id, d.status, d.updated_at, d.window_end
          FROM deliveries d
         WHERE d.tenant_id = $1
           AND d.deleted_at IS NULL
           AND d.status IN ('delivered', 'failed')
           AND d.updated_at::date = $2::date
      ),
      atribuidas AS (
        SELECT f.status, f.updated_at, f.window_end,
               f.driver_id AS s_driver,
               CASE WHEN f.driver_id IS NULL THEN a.user_id END AS s_user
          FROM finalizadas f
          LEFT JOIN autonomo a ON true
         -- Sem ficha e sem sujeito autónomo, a entrega não é de ninguém: fica
         -- fora em vez de ser atribuída ao tenant.
         WHERE f.driver_id IS NOT NULL OR a.user_id IS NOT NULL
      ),
      execucao AS (
        SELECT s_driver, s_user,
               count(*) FILTER (WHERE status = 'delivered')::int AS delivered,
               count(*) FILTER (WHERE status = 'failed')::int    AS failed,
               count(*) FILTER (WHERE status = 'delivered' AND updated_at <= window_end)::int AS on_time,
               min(updated_at) AS primeira,
               max(updated_at) AS ultima
          FROM atribuidas
         GROUP BY s_driver, s_user
      ),
      logins AS (
        -- driver_positions.driver_id guarda o **login** (exceção da ADR-0086),
        -- por isso a ponte ficha→login é necessária aqui e só aqui.
        SELECT dr.id AS s_driver, NULL::uuid AS s_user, dr.user_id AS login
          FROM drivers dr
         WHERE dr.tenant_id = $1 AND dr.user_id IS NOT NULL
        UNION ALL
        SELECT NULL::uuid, a.user_id, a.user_id FROM autonomo a
      ),
      posicoes AS (
        SELECT l.s_driver, l.s_user,
               min(p.recorded_at) AS primeira,
               max(p.recorded_at) AS ultima
          FROM logins l
          JOIN driver_positions p
            ON p.tenant_id = $1 AND p.driver_id = l.login AND p.recorded_at::date = $2::date
         GROUP BY l.s_driver, l.s_user
      ),
      planos AS (
        SELECT rp.driver_id AS s_driver,
               CASE WHEN rp.driver_id IS NULL THEN a.user_id END AS s_user,
               count(*)::int AS plans,
               sum((rp.savings->>'distanceKm')::float)   AS saved_km,
               sum((rp.savings->>'timeMinutes')::float)  AS saved_minutes,
               array_remove(array_agg(DISTINCT rp.params->>'vehicleType'), NULL) AS vehicle_types
          FROM route_plans rp
          LEFT JOIN autonomo a ON true
         WHERE rp.tenant_id = $1
           AND rp.driver_scoped
           AND rp.operational_day = $2::date
           AND (rp.driver_id IS NOT NULL OR a.user_id IS NOT NULL)
         GROUP BY 1, 2
      ),
      sujeitos AS (
        SELECT s_driver, s_user FROM execucao
        UNION SELECT s_driver, s_user FROM posicoes
        UNION SELECT s_driver, s_user FROM planos
        -- O autónomo entra mesmo sem nada no dia: é assim que "não trabalhou"
        -- se distingue de "ainda não projetado" (a ausência de linha).
        UNION SELECT NULL::uuid, a.user_id FROM autonomo a
      )
      INSERT INTO driver_kpi_daily (
        tenant_id, driver_id, user_id, day,
        delivered, failed, on_time,
        first_activity_at, last_activity_at,
        plans, saved_km, saved_minutes, vehicle_types, projected_at
      )
      SELECT $1, s.s_driver, s.s_user, $2::date,
             coalesce(e.delivered, 0), coalesce(e.failed, 0), coalesce(e.on_time, 0),
             -- least/greatest ignoram NULL: sem posições, valem os limites
             -- das entregas, e vice-versa.
             least(e.primeira, po.primeira),
             greatest(e.ultima, po.ultima),
             coalesce(pl.plans, 0), pl.saved_km, pl.saved_minutes, pl.vehicle_types, now()
        FROM sujeitos s
        LEFT JOIN execucao e
          ON e.s_driver IS NOT DISTINCT FROM s.s_driver AND e.s_user IS NOT DISTINCT FROM s.s_user
        LEFT JOIN posicoes po
          ON po.s_driver IS NOT DISTINCT FROM s.s_driver AND po.s_user IS NOT DISTINCT FROM s.s_user
        LEFT JOIN planos pl
          ON pl.s_driver IS NOT DISTINCT FROM s.s_driver AND pl.s_user IS NOT DISTINCT FROM s.s_user
      `,
      [tenantId, day],
    );
  }

  async range(
    tenantId: string,
    subject: DailySubject,
    from: string,
    to: string,
  ): Promise<DailyRawRow[]> {
    const rows = (await this.manager.query(
      `SELECT day::text, delivered, failed, on_time,
              first_activity_at, last_activity_at,
              plans, saved_km, saved_minutes, vehicle_types, projected_at
         FROM driver_kpi_daily
        WHERE tenant_id = $1
          AND driver_id IS NOT DISTINCT FROM $2
          AND user_id   IS NOT DISTINCT FROM $3
          AND day BETWEEN $4::date AND $5::date
        ORDER BY day ASC`,
      [
        tenantId,
        subject.kind === 'driver' ? subject.driverId : null,
        subject.kind === 'user' ? subject.userId : null,
        from,
        to,
      ],
    )) as Record<string, unknown>[];

    return rows.map((r) => ({
      day: String(r.day),
      delivered: Number(r.delivered),
      failed: Number(r.failed),
      onTime: Number(r.on_time),
      firstActivityAt: r.first_activity_at ? new Date(r.first_activity_at as string) : null,
      lastActivityAt: r.last_activity_at ? new Date(r.last_activity_at as string) : null,
      plans: Number(r.plans),
      savedKm: r.saved_km === null ? null : Number(r.saved_km),
      savedMinutes: r.saved_minutes === null ? null : Number(r.saved_minutes),
      vehicleTypes: ((r.vehicle_types as string[] | null) ?? []) as VehicleType[],
      projectedAt: new Date(r.projected_at as string),
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
