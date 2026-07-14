import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Roteirização multi-veículo (ADR-0022, Fase 2). Adiciona a `route_plans`:
 * `routes` (JSONB, nullable) com as rotas por veículo e `unassigned_stops`
 * (JSONB, nullable) com as paradas que não couberam. Nullable e retrocompatível:
 * planos de veículo único permanecem com ambas as colunas em NULL.
 */
export class RoutePlanRoutes1720001900000 implements MigrationInterface {
  name = 'RoutePlanRoutes1720001900000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE route_plans ADD COLUMN IF NOT EXISTS routes jsonb;`);
    await queryRunner.query(
      `ALTER TABLE route_plans ADD COLUMN IF NOT EXISTS unassigned_stops jsonb;`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE route_plans DROP COLUMN IF EXISTS unassigned_stops;`);
    await queryRunner.query(`ALTER TABLE route_plans DROP COLUMN IF EXISTS routes;`);
  }
}
