import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Hardening (correção) — recria as políticas de RLS usando
 * `NULLIF(current_setting('app.current_tenant', true), '')::uuid`.
 *
 * GUCs de placeholder retornam STRING VAZIA (não NULL) quando o valor foi
 * resetado; sem o NULLIF, `''::uuid` lança erro em vez de simplesmente não
 * casar. Com NULLIF, ausência de tenant → NULL → nenhuma linha visível
 * (fail-closed), e a política não quebra.
 */
const TABLES = ['vehicles', 'drivers', 'deliveries', 'route_plans'];
const EXPR = `NULLIF(current_setting('app.current_tenant', true), '')::uuid`;
const OLD_EXPR = `current_setting('app.current_tenant', true)::uuid`;

export class FixRlsNullTenant1720000600000 implements MigrationInterface {
  name = 'FixRlsNullTenant1720000600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of TABLES) {
      await queryRunner.query(`DROP POLICY IF EXISTS tenant_isolation ON ${table};`);
      await queryRunner.query(`
        CREATE POLICY tenant_isolation ON ${table}
          USING (tenant_id = ${EXPR})
          WITH CHECK (tenant_id = ${EXPR});
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of TABLES) {
      await queryRunner.query(`DROP POLICY IF EXISTS tenant_isolation ON ${table};`);
      await queryRunner.query(`
        CREATE POLICY tenant_isolation ON ${table}
          USING (tenant_id = ${OLD_EXPR});
      `);
    }
  }
}
