import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Índice para achar o plano que **contém** uma entrega (ADR-0102).
 *
 * O ETA de uma entrega deixou de sair do "plano mais recente do tenant" e passa
 * a sair do plano onde aquela entrega está. Sem índice, essa busca varre os
 * planos do tenant e desserializa `stops` linha a linha — e ela está no caminho
 * do rastreio público, que é anônimo e tem volume.
 *
 * `jsonb_path_ops` em vez do GIN padrão: só suporta o operador de containment
 * (`@>`), que é exatamente o que a consulta usa, e em troca fica bem menor e
 * mais rápido que o índice completo.
 */
export class RoutePlanStopsIndex1720004100000 implements MigrationInterface {
  name = 'RoutePlanStopsIndex1720004100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_route_plans_stops
        ON route_plans USING gin (stops jsonb_path_ops);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_route_plans_stops;`);
  }
}
