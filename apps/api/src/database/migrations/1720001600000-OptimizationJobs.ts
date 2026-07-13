import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Jobs de otimização assíncrona (ADR-0007). O `POST /route-plans` passa a
 * enfileirar um job (202 + jobId) em vez de rodar o solver na requisição; um
 * processador executa e atualiza o status. Escopada por tenant (RLS FORCE),
 * com grant ao role de runtime.
 */
export class OptimizationJobs1720001600000 implements MigrationInterface {
  name = 'OptimizationJobs1720001600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const appUser = process.env.DB_APP_USER ?? 'navix_app';

    await queryRunner.query(`
      CREATE TABLE optimization_jobs (
        id             uuid PRIMARY KEY,
        tenant_id      uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        status         text NOT NULL DEFAULT 'queued',
        request        jsonb NOT NULL,
        route_plan_id  uuid,
        error          text,
        created_at     timestamptz NOT NULL DEFAULT now(),
        updated_at     timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT chk_optimization_jobs_status
          CHECK (status IN ('queued', 'running', 'succeeded', 'failed'))
      );
    `);
    await queryRunner.query(
      `CREATE INDEX idx_optimization_jobs_tenant_created ON optimization_jobs (tenant_id, created_at);`,
    );

    await queryRunner.query(`ALTER TABLE optimization_jobs ENABLE ROW LEVEL SECURITY;`);
    await queryRunner.query(`ALTER TABLE optimization_jobs FORCE ROW LEVEL SECURITY;`);
    await queryRunner.query(`
      CREATE POLICY tenant_isolation ON optimization_jobs
        USING (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
        WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid);
    `);
    await queryRunner.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON optimization_jobs TO ${appUser};`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP POLICY IF EXISTS tenant_isolation ON optimization_jobs;`);
    await queryRunner.query(`DROP TABLE IF EXISTS optimization_jobs;`);
  }
}
