import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Inteligência financeira do motorista (FASE 3, F1) — tabela `financial_entries`.
 * Ledger de receita/despesa (combustível, manutenção, pedágio, entrega, outro)
 * que alimenta custo/km e lucro/entrega. Valor em centavos (inteiro). Escopada
 * por tenant (RLS FORCE + policy) com grant ao role de runtime.
 */
export class FinancialEntries1720002500000 implements MigrationInterface {
  name = 'FinancialEntries1720002500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE financial_entries (
        id            uuid PRIMARY KEY,
        tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        type          text NOT NULL,
        category      text NOT NULL,
        amount_cents  integer NOT NULL,
        occurred_at   date NOT NULL,
        odometer_km   integer,
        liters        numeric(7,2),
        notes         text,
        created_at    timestamptz NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(
      `CREATE INDEX idx_financial_entries_tenant_date ON financial_entries (tenant_id, occurred_at DESC);`,
    );

    await queryRunner.query(`ALTER TABLE financial_entries ENABLE ROW LEVEL SECURITY;`);
    await queryRunner.query(`ALTER TABLE financial_entries FORCE ROW LEVEL SECURITY;`);
    await queryRunner.query(`
      CREATE POLICY tenant_isolation ON financial_entries
        USING (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
        WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid);
    `);

    const appUser = process.env.DB_APP_USER ?? 'navix_app';
    await queryRunner.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON financial_entries TO ${appUser};`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP POLICY IF EXISTS tenant_isolation ON financial_entries;`);
    await queryRunner.query(`DROP TABLE IF EXISTS financial_entries;`);
  }
}
