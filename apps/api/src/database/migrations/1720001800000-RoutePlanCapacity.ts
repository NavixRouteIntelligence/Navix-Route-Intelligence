import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adiciona `capacity` (JSONB, nullable) a `route_plans` para registrar o uso de
 * capacidade do veículo por rota (ADR-0022). Nullable e retrocompatível: planos
 * antigos e otimizações sem veículo permanecem com `capacity = NULL`.
 *
 * Os demais campos de restrição (peso/volume por parada, tipo de veículo) viajam
 * dentro das colunas JSONB já existentes (`stops`, `metrics`, `params`) — não
 * exigem alteração de schema.
 */
export class RoutePlanCapacity1720001800000 implements MigrationInterface {
  name = 'RoutePlanCapacity1720001800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE route_plans ADD COLUMN IF NOT EXISTS capacity jsonb;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE route_plans DROP COLUMN IF EXISTS capacity;`);
  }
}
