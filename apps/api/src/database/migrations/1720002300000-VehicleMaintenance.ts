import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Gestão do motorista (FASE 3, V1) — tabela `vehicle_maintenance`. Cada linha é
 * um registro de manutenção de um veículo (óleo, revisão, pneus, seguro, IPO,
 * inspeção), com próximo vencimento por data e/ou quilometragem. Custo em
 * centavos (inteiro, evita float). Escopada por tenant (RLS FORCE + policy) com
 * grant ao role de runtime.
 */
export class VehicleMaintenance1720002300000 implements MigrationInterface {
  name = 'VehicleMaintenance1720002300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE vehicle_maintenance (
        id                     uuid PRIMARY KEY,
        tenant_id              uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        vehicle_id             uuid NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
        type                   text NOT NULL,
        performed_at           date NOT NULL,
        odometer_km            integer,
        cost_cents             integer,
        notes                  text,
        next_due_date          date,
        next_due_odometer_km   integer,
        created_at             timestamptz NOT NULL DEFAULT now(),
        updated_at             timestamptz NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(
      `CREATE INDEX idx_vehicle_maintenance_vehicle ON vehicle_maintenance (tenant_id, vehicle_id, performed_at DESC);`,
    );

    await queryRunner.query(`ALTER TABLE vehicle_maintenance ENABLE ROW LEVEL SECURITY;`);
    await queryRunner.query(`ALTER TABLE vehicle_maintenance FORCE ROW LEVEL SECURITY;`);
    await queryRunner.query(`
      CREATE POLICY tenant_isolation ON vehicle_maintenance
        USING (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
        WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid);
    `);

    const appUser = process.env.DB_APP_USER ?? 'navix_app';
    await queryRunner.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON vehicle_maintenance TO ${appUser};`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP POLICY IF EXISTS tenant_isolation ON vehicle_maintenance;`);
    await queryRunner.query(`DROP TABLE IF EXISTS vehicle_maintenance;`);
  }
}
