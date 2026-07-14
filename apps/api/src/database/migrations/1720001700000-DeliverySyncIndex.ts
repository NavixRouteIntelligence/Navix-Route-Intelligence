import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Índice de suporte à **sincronização incremental** de entregas (ADR-0020).
 *
 * O feed de sync ordena por `(updated_at, id)` e **inclui tombstones** (linhas
 * com soft delete), para o cache offline removê-las. Por isso este índice
 * **não** tem o predicado parcial `WHERE deleted_at IS NULL` dos demais — ele
 * precisa cobrir também as linhas excluídas. Torna o keyset scan barato mesmo
 * em coleções grandes (paginação sem offset).
 */
export class DeliverySyncIndex1720001700000 implements MigrationInterface {
  name = 'DeliverySyncIndex1720001700000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX idx_deliveries_tenant_sync ON deliveries (tenant_id, updated_at, id);`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_deliveries_tenant_sync;`);
  }
}
