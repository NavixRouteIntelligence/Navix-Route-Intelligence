import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fase 1 — tabelas do contexto Fleet: `vehicles` e `drivers`.
 * Escopadas por tenant, com unicidade por tenant e RLS habilitada (padrão da
 * Fase 0 — ENABLE sem FORCE; enforcement real depende do wiring de tenant e de
 * role não-owner, ver docs/reviews/phase-0-technical-audit.md).
 */
export class FleetTables1720000100000 implements MigrationInterface {
  name = 'FleetTables1720000100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- vehicles ---
    await queryRunner.query(`
      CREATE TABLE vehicles (
        id           uuid PRIMARY KEY,
        tenant_id    uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        plate        text NOT NULL,
        type         text NOT NULL,
        capacity     integer NOT NULL CHECK (capacity > 0),
        status       text NOT NULL DEFAULT 'active',
        created_at   timestamptz NOT NULL DEFAULT now(),
        updated_at   timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_vehicles_tenant_plate UNIQUE (tenant_id, plate)
      );
    `);
    await queryRunner.query(`CREATE INDEX idx_vehicles_tenant ON vehicles (tenant_id);`);

    // --- drivers ---
    await queryRunner.query(`
      CREATE TABLE drivers (
        id             uuid PRIMARY KEY,
        tenant_id      uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        name           text NOT NULL,
        license_number text NOT NULL,
        skills         text[] NOT NULL DEFAULT '{}',
        status         text NOT NULL DEFAULT 'active',
        created_at     timestamptz NOT NULL DEFAULT now(),
        updated_at     timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_drivers_tenant_license UNIQUE (tenant_id, license_number)
      );
    `);
    await queryRunner.query(`CREATE INDEX idx_drivers_tenant ON drivers (tenant_id);`);

    // --- RLS (padrão de isolamento — ADR-0003) ---
    for (const table of ['vehicles', 'drivers']) {
      await queryRunner.query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`);
      await queryRunner.query(`
        CREATE POLICY tenant_isolation ON ${table}
          USING (tenant_id = current_setting('app.current_tenant', true)::uuid);
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP POLICY IF EXISTS tenant_isolation ON drivers;`);
    await queryRunner.query(`DROP POLICY IF EXISTS tenant_isolation ON vehicles;`);
    await queryRunner.query(`DROP TABLE IF EXISTS drivers;`);
    await queryRunner.query(`DROP TABLE IF EXISTS vehicles;`);
  }
}
