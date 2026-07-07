import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Import Center — tabela `import_batches`. Guarda o lote (preview → imported),
 * as linhas processadas (JSONB) e o resumo. Escopada por tenant (RLS + FORCE),
 * com grant ao role de runtime.
 */
export class ImportBatches1720000800000 implements MigrationInterface {
  name = 'ImportBatches1720000800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE import_batches (
        id                 uuid PRIMARY KEY,
        tenant_id          uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        created_by         uuid NOT NULL,
        filename           text NOT NULL,
        file_type          text NOT NULL,
        status             text NOT NULL DEFAULT 'preview',
        summary            jsonb NOT NULL,
        rows               jsonb NOT NULL,
        created_deliveries integer NOT NULL DEFAULT 0,
        route_plan_id      uuid,
        created_at         timestamptz NOT NULL DEFAULT now(),
        imported_at        timestamptz
      );
    `);
    await queryRunner.query(
      `CREATE INDEX idx_import_batches_tenant_created ON import_batches (tenant_id, created_at);`,
    );

    await queryRunner.query(`ALTER TABLE import_batches ENABLE ROW LEVEL SECURITY;`);
    await queryRunner.query(`ALTER TABLE import_batches FORCE ROW LEVEL SECURITY;`);
    await queryRunner.query(`
      CREATE POLICY tenant_isolation ON import_batches
        USING (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
        WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid);
    `);

    const appUser = process.env.DB_APP_USER ?? 'navix_app';
    await queryRunner.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON import_batches TO ${appUser};`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP POLICY IF EXISTS tenant_isolation ON import_batches;`);
    await queryRunner.query(`DROP TABLE IF EXISTS import_batches;`);
  }
}
