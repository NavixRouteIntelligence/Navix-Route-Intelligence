import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Read model diário **por motorista** (ADR-0097).
 *
 * Irmão do `kpi_daily` (ADR-0092), com a mesma projeção por recomputação e a
 * mesma razão de existir: sem ele, a tela do motorista somaria a primeira
 * página de entregas e chamaria aquilo de desempenho.
 *
 * ## O que NÃO está aqui, de propósito
 *
 * Nenhuma coluna de velocidade, de entregas por hora ou de comparação com
 * outros motoristas. Também não há `saved_km`: o plano de rota não guarda
 * motorista, e atribuir a economia a quem dirigiu seria palpite. O único dado de jornada é `active_minutes`, e ele existe
 * para **sugerir descanso** — não para pontuar quem trabalha mais. Ver a nota
 * de abertura de `domain/driver-performance.ts`.
 */
export class DriverKpiDaily1720003900000 implements MigrationInterface {
  name = 'DriverKpiDaily1720003900000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE driver_kpi_daily (
        tenant_id      uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        -- Ficha do motorista (ADR-0086), não o login: é o id que a entrega usa.
        driver_id      uuid NOT NULL,
        day            date NOT NULL,
        delivered      integer NOT NULL DEFAULT 0,
        failed         integer NOT NULL DEFAULT 0,
        on_time        integer NOT NULL DEFAULT 0,
        -- Minutos entre a primeira e a última atividade do dia. Alimenta apenas
        -- a sugestão de descanso.
        active_minutes integer NOT NULL DEFAULT 0,
        updated_at     timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (tenant_id, driver_id, day)
      );
    `);

    await queryRunner.query(
      `CREATE INDEX idx_driver_kpi_range ON driver_kpi_daily (tenant_id, driver_id, day DESC);`,
    );

    await queryRunner.query(`ALTER TABLE driver_kpi_daily ENABLE ROW LEVEL SECURITY;`);
    await queryRunner.query(`ALTER TABLE driver_kpi_daily FORCE ROW LEVEL SECURITY;`);
    await queryRunner.query(`
      CREATE POLICY tenant_isolation ON driver_kpi_daily
        USING (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
        WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid);
    `);

    const appUser = process.env.DB_APP_USER ?? 'navix_app';
    await queryRunner.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON driver_kpi_daily TO ${appUser};`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS driver_kpi_daily;`);
  }
}
