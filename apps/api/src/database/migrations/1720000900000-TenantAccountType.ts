import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adiciona `account_type` ao tenant: `company` (padrão, comportamento atual) ou
 * `driver` (Motorista Autônomo com organização pessoal). O campo habilita a
 * futura migração Autônomo → Empresa sem perda de dados: basta alterar o tipo e
 * os papéis do usuário, preservando tenant, histórico e configurações.
 */
export class TenantAccountType1720000900000 implements MigrationInterface {
  name = 'TenantAccountType1720000900000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE tenants ADD COLUMN account_type text NOT NULL DEFAULT 'company';`,
    );
    await queryRunner.query(
      `ALTER TABLE tenants ADD CONSTRAINT chk_tenants_account_type
         CHECK (account_type IN ('company', 'driver'));`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE tenants DROP CONSTRAINT IF EXISTS chk_tenants_account_type;`);
    await queryRunner.query(`ALTER TABLE tenants DROP COLUMN IF EXISTS account_type;`);
  }
}
