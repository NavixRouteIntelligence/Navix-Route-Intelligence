import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Tracking (MVP) — tabela `driver_positions` (append-only, série temporal de
 * posições). Escopada por tenant (RLS FORCE + policy) com grant ao role runtime.
 *
 * Preparada para TimescaleDB: quando a extensão for habilitada (fase de
 * telemetria — ver docs/roadmap.md), promover a hypertable particionada por
 * tempo:
 *   SELECT create_hypertable('driver_positions', 'recorded_at', migrate_data => true);
 * A PK inclui `recorded_at` para ser compatível com o particionamento.
 */
export class DriverPositions1720001000000 implements MigrationInterface {
  name = 'DriverPositions1720001000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE driver_positions (
        id           uuid NOT NULL,
        tenant_id    uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        driver_id    uuid NOT NULL,
        latitude     double precision NOT NULL,
        longitude    double precision NOT NULL,
        speed        double precision,
        heading      double precision,
        status       text NOT NULL DEFAULT 'en_route',
        recorded_at  timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (id, recorded_at)
      );
    `);
    await queryRunner.query(
      `CREATE INDEX idx_driver_positions_tenant_driver_time
         ON driver_positions (tenant_id, driver_id, recorded_at DESC);`,
    );

    await queryRunner.query(`ALTER TABLE driver_positions ENABLE ROW LEVEL SECURITY;`);
    await queryRunner.query(`ALTER TABLE driver_positions FORCE ROW LEVEL SECURITY;`);
    await queryRunner.query(`
      CREATE POLICY tenant_isolation ON driver_positions
        USING (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
        WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid);
    `);

    const appUser = process.env.DB_APP_USER ?? 'navix_app';
    await queryRunner.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON driver_positions TO ${appUser};`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP POLICY IF EXISTS tenant_isolation ON driver_positions;`);
    await queryRunner.query(`DROP TABLE IF EXISTS driver_positions;`);
  }
}
