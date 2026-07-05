import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fase 1 — tabela `deliveries` (contexto Delivery).
 * Endereço achatado + coordenadas, coluna geográfica PostGIS `location` gerada
 * (para uso futuro do otimizador), janela de entrega, status, associações
 * opcionais (sem FK cross-context), soft delete, índices e RLS.
 */
export class DeliveryTables1720000200000 implements MigrationInterface {
  name = 'DeliveryTables1720000200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE deliveries (
        id            uuid PRIMARY KEY,
        tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        street        text NOT NULL,
        number        text NOT NULL,
        complement    text,
        city          text NOT NULL,
        state         text NOT NULL,
        postal_code   text NOT NULL,
        country       text NOT NULL,
        latitude      double precision NOT NULL CHECK (latitude BETWEEN -90 AND 90),
        longitude     double precision NOT NULL CHECK (longitude BETWEEN -180 AND 180),
        priority      text NOT NULL DEFAULT 'normal',
        window_start  timestamptz NOT NULL,
        window_end    timestamptz NOT NULL,
        status        text NOT NULL DEFAULT 'pending',
        driver_id     uuid,
        vehicle_id    uuid,
        route_id      uuid,
        notes         text,
        created_at    timestamptz NOT NULL DEFAULT now(),
        updated_at    timestamptz NOT NULL DEFAULT now(),
        deleted_at    timestamptz,
        CONSTRAINT chk_deliveries_window CHECK (window_start < window_end),
        location geography(Point, 4326) GENERATED ALWAYS AS
          (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography) STORED
      );
    `);

    await queryRunner.query(
      `CREATE INDEX idx_deliveries_tenant_status ON deliveries (tenant_id, status) WHERE deleted_at IS NULL;`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_deliveries_tenant_created ON deliveries (tenant_id, created_at) WHERE deleted_at IS NULL;`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_deliveries_window_start ON deliveries (tenant_id, window_start) WHERE deleted_at IS NULL;`,
    );
    await queryRunner.query(`CREATE INDEX idx_deliveries_location ON deliveries USING GIST (location);`);

    // RLS (padrão de isolamento — ENABLE sem FORCE nesta fase; ver auditoria da Fase 0)
    await queryRunner.query(`ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;`);
    await queryRunner.query(`
      CREATE POLICY tenant_isolation ON deliveries
        USING (tenant_id = current_setting('app.current_tenant', true)::uuid);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP POLICY IF EXISTS tenant_isolation ON deliveries;`);
    await queryRunner.query(`DROP TABLE IF EXISTS deliveries;`);
  }
}
