import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Paradas fora da rota por falta de trecho viável (ADR-0106).
 *
 * Coluna própria, e não um campo dentro de `params`, pelo mesmo motivo de
 * `unassigned_stops`: é **resultado** da otimização, não entrada dela. E é
 * distinta daquela de propósito — não caber por capacidade e não existir
 * estrada são problemas diferentes, com donos diferentes: o primeiro é do
 * despacho, o segundo costuma ser um endereço cadastrado errado.
 */
export class RoutePlanUnreachableStops1720004400000 implements MigrationInterface {
  name = 'RoutePlanUnreachableStops1720004400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE route_plans ADD COLUMN IF NOT EXISTS unreachable_stops jsonb;`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE route_plans DROP COLUMN IF EXISTS unreachable_stops;`);
  }
}
