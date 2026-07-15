import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Inteligência coletiva (ADR-0031) — tabela `collective_observations`. Cada
 * linha é um relato de campo do motorista (estacionamento, tempo de atendimento
 * ou dica de acesso), atribuído a uma célula de localização e agregado por
 * tenant. Escopada por tenant (RLS FORCE + policy) com grant ao role de runtime.
 */
export class CollectiveObservations1720002000000 implements MigrationInterface {
  name = 'CollectiveObservations1720002000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE collective_observations (
        id                  uuid PRIMARY KEY,
        tenant_id           uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        driver_id           uuid NOT NULL,
        cell                text NOT NULL,
        latitude            double precision NOT NULL,
        longitude           double precision NOT NULL,
        kind                text NOT NULL,
        parking_difficulty  text,
        service_minutes     double precision,
        access_tip          text,
        created_at          timestamptz NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(
      `CREATE INDEX idx_collective_cell ON collective_observations (tenant_id, cell, created_at);`,
    );

    await queryRunner.query(`ALTER TABLE collective_observations ENABLE ROW LEVEL SECURITY;`);
    await queryRunner.query(`ALTER TABLE collective_observations FORCE ROW LEVEL SECURITY;`);
    await queryRunner.query(`
      CREATE POLICY tenant_isolation ON collective_observations
        USING (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
        WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid);
    `);

    const appUser = process.env.DB_APP_USER ?? 'navix_app';
    await queryRunner.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON collective_observations TO ${appUser};`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP POLICY IF EXISTS tenant_isolation ON collective_observations;`);
    await queryRunner.query(`DROP TABLE IF EXISTS collective_observations;`);
  }
}
