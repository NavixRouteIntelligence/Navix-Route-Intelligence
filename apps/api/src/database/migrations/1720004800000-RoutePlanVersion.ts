import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Versão do plano de rota e unicidade por (tenant, motorista, dia) — ADR-0113.
 *
 * ## O que não existia
 *
 * A rota do motorista no dia é "uma coisa só", e quem garantia isso era uma
 * verificação em memória: ler o plano vigente, comparar `requested_at`, gravar.
 * Entre a leitura e a gravação não havia nada — dois workers (a API escala por
 * processo, `concurrency: 1` cada) liam o mesmo "não há nada mais recente" e
 * gravavam os dois. Reproduzido com duas instâncias: **seis rodadas, seis pares
 * de planos gravados**, e numa delas a rota exibida ao motorista nasceu do
 * pedido **mais antigo**.
 *
 * ## Por que `NULLS NOT DISTINCT`
 *
 * O motorista autônomo não tem ficha (ADR-0085): `driver_id` é `NULL`. Com o
 * comportamento padrão do Postgres (`NULLS DISTINCT`), duas linhas com
 * `driver_id NULL` **nunca** colidem — o índice existiria e não protegeria
 * exatamente quem mais precisa. `NULLS NOT DISTINCT` (Postgres 15+) trata os
 * nulos como iguais, e aí a restrição vale para o autônomo como vale para
 * quem tem ficha.
 *
 * ## Por que parcial
 *
 * `driver_scoped = false` é o plano do despacho, que roteiriza recortes
 * diferentes da frota e legitimamente tem vários por dia. Ele ganha versão
 * (para log e rastreio), mas fica fora da restrição.
 */
export class RoutePlanVersion1720004800000 implements MigrationInterface {
  name = 'RoutePlanVersion1720004800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE route_plans ADD COLUMN version integer NOT NULL DEFAULT 1`,
    );

    // Backfill: a versão de cada plano é a sua posição na sequência de pedidos
    // daquele motorista naquele dia. Ordena por `requested_at` — a ordem em que
    // as rotas foram pedidas —, com `created_at` desempatando, porque é
    // justamente a divergência entre as duas que esta migração encerra.
    await queryRunner.query(`
      UPDATE route_plans p SET version = s.rn
      FROM (
        SELECT id, row_number() OVER (
          PARTITION BY tenant_id, driver_id, operational_day
          ORDER BY requested_at, created_at
        ) AS rn
        FROM route_plans
      ) s
      WHERE p.id = s.id
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX uq_route_plans_driver_day_version
      ON route_plans (tenant_id, driver_id, operational_day, version)
      NULLS NOT DISTINCT
      WHERE driver_scoped
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS uq_route_plans_driver_day_version`);
    await queryRunner.query(`ALTER TABLE route_plans DROP COLUMN version`);
  }
}
