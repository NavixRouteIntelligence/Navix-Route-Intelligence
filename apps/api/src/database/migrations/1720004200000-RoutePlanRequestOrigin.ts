import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Origem temporal do plano, para proteger a ordem manual (ADR-0103).
 *
 * ## O problema
 *
 * O plano era gravado sem comparar com nada, e a rota vigente é a de
 * `created_at` mais recente. Um job lento (retry, fila cheia) que termina
 * **depois** de o motorista reordenar à mão nasce com `created_at` maior e
 * vira a rota vigente — desfazendo a ordem manual sem erro nenhum.
 *
 * `requested_at` é o instante em que a otimização foi **pedida**, não em que
 * terminou. Comparar pedidos, e não conclusões, é o que dá a resposta certa nos
 * dois sentidos: um job antigo que chega tarde perde, e um job novo que chega
 * depois de um antigo ainda ganha.
 *
 * `driver_scoped` diz que o plano é a rota **de um motorista** naquele dia —
 * uma coisa só, que a mais recente substitui. O plano do despacho não é: ele
 * roteiriza recortes diferentes da frota, e vários por dia são legítimos.
 * Sem esta coluna os dois seriam indistinguíveis quando `driver_id` é nulo, que
 * é o caso do motorista autônomo (ADR-0085) *e* o do despacho.
 */
export class RoutePlanRequestOrigin1720004200000 implements MigrationInterface {
  name = 'RoutePlanRequestOrigin1720004200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE route_plans ADD COLUMN IF NOT EXISTS requested_at timestamptz;`,
    );
    await queryRunner.query(
      `ALTER TABLE route_plans ADD COLUMN IF NOT EXISTS driver_scoped boolean NOT NULL DEFAULT false;`,
    );

    // Planos antigos: o pedido é indistinguível da conclusão, e usar
    // `created_at` mantém a ordem relativa entre eles exatamente como estava.
    await queryRunner.query(
      `UPDATE route_plans SET requested_at = created_at WHERE requested_at IS NULL;`,
    );
    await queryRunner.query(`ALTER TABLE route_plans ALTER COLUMN requested_at SET NOT NULL;`);

    // Só o que já tem motorista é seguramente rota de alguém. Plano antigo com
    // `driver_id` nulo fica `false`: pode ser do despacho ou do autônomo, e
    // marcá-lo como rota de motorista arriscaria descartar plano legítimo.
    await queryRunner.query(
      `UPDATE route_plans SET driver_scoped = true WHERE driver_id IS NOT NULL;`,
    );

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_route_plans_driver_scope_request
        ON route_plans (tenant_id, driver_id, operational_day, requested_at DESC)
        WHERE driver_scoped;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_route_plans_driver_scope_request;`);
    await queryRunner.query(`ALTER TABLE route_plans DROP COLUMN IF EXISTS driver_scoped;`);
    await queryRunner.query(`ALTER TABLE route_plans DROP COLUMN IF EXISTS requested_at;`);
  }
}
