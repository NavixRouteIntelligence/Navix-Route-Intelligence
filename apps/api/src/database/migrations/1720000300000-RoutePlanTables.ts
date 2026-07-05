import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fase 1 — tabela `route_plans` (contexto Optimizer). Guarda o resultado da
 * otimização (sequência, métricas, parâmetros, score) para histórico, auditoria
 * e futura reotimização. MVP single-vehicle → sequência em JSONB. RLS habilitada.
 */
export class RoutePlanTables1720000300000 implements MigrationInterface {
  name = 'RoutePlanTables1720000300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE route_plans (
        id           uuid PRIMARY KEY,
        tenant_id    uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        strategy     text NOT NULL,
        status       text NOT NULL DEFAULT 'completed',
        params       jsonb NOT NULL,
        stops        jsonb NOT NULL,
        metrics      jsonb NOT NULL,
        baseline     jsonb NOT NULL,
        savings      jsonb NOT NULL,
        score        integer NOT NULL CHECK (score BETWEEN 0 AND 100),
        explanation  text NOT NULL,
        created_at   timestamptz NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(
      `CREATE INDEX idx_route_plans_tenant_created ON route_plans (tenant_id, created_at);`,
    );

    await queryRunner.query(`ALTER TABLE route_plans ENABLE ROW LEVEL SECURITY;`);
    await queryRunner.query(`
      CREATE POLICY tenant_isolation ON route_plans
        USING (tenant_id = current_setting('app.current_tenant', true)::uuid);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP POLICY IF EXISTS tenant_isolation ON route_plans;`);
    await queryRunner.query(`DROP TABLE IF EXISTS route_plans;`);
  }
}
