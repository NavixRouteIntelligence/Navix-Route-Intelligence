import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Vínculo do plano de rota com o motorista e o dia operacional (ADR-0098).
 *
 * ## O que isto conserta
 *
 * `route_plans` não guardava motorista nenhum, e o `actorId` de quem pediu a
 * otimização morria no log de auditoria. Com isso, "minha rota" era resolvida
 * pelos clientes como *o plano mais recente do tenant* — numa frota com dois
 * motoristas, os dois viam a mesma rota. O motorista autônomo é sozinho no
 * tenant, e foi por isso que o defeito passou despercebido.
 *
 * ## Por que as duas colunas são nulas/derivadas e não obrigatórias de origem
 *
 * `driver_id` é a **ficha** (ADR-0086), e fica nula em dois casos legítimos: o
 * motorista autônomo, que não tem ficha, e o plano de frota criado pelo
 * despacho, que cobre vários veículos e não pertence a uma pessoa só.
 *
 * `operational_day` é preenchida por backfill a partir de `created_at` e passa
 * a NOT NULL: todo plano tem um dia, inclusive os antigos, e um plano sem dia
 * não teria como ser encontrado pela consulta de rota ativa.
 */
export class RoutePlanDriverJourney1720004000000 implements MigrationInterface {
  name = 'RoutePlanDriverJourney1720004000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE route_plans
        ADD COLUMN IF NOT EXISTS driver_id uuid REFERENCES drivers(id) ON DELETE SET NULL;
    `);
    await queryRunner.query(`
      ALTER TABLE route_plans ADD COLUMN IF NOT EXISTS operational_day date;
    `);

    // Planos antigos continuam legíveis: o dia deles é o dia em que foram
    // criados. Só o vínculo com o motorista é irrecuperável — o dado nunca
    // existiu —, e eles ficam com `driver_id` nulo.
    await queryRunner.query(
      `UPDATE route_plans SET operational_day = created_at::date WHERE operational_day IS NULL;`,
    );
    await queryRunner.query(`ALTER TABLE route_plans ALTER COLUMN operational_day SET NOT NULL;`);

    // Índice da pergunta que a tela do motorista faz: qual é a minha rota de
    // hoje. Parcial porque plano sem motorista nunca é resposta dela.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_route_plans_driver_day
        ON route_plans (tenant_id, driver_id, operational_day DESC, created_at DESC)
        WHERE driver_id IS NOT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_route_plans_driver_day;`);
    await queryRunner.query(`ALTER TABLE route_plans DROP COLUMN IF EXISTS operational_day;`);
    await queryRunner.query(`ALTER TABLE route_plans DROP COLUMN IF EXISTS driver_id;`);
  }
}
