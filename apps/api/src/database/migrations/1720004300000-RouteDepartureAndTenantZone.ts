import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Horário-base real da rota e fuso do tenant (ADR-0105).
 *
 * ## O que estava errado
 *
 * O plano tinha **duas** âncoras de tempo que não conversavam. O solver media
 * `etaMinutes` a partir da abertura de janela mais cedo da rota (ou de `now()`,
 * quando não havia janela); quem consumia ETA somava esses minutos ao
 * `created_at` do plano. Com janelas abrindo três horas depois do
 * planeamento, o rastreio público anunciava a entrega para *agora* — três horas
 * antes de a rota poder sequer começar.
 *
 * `departure_at` acaba com a ambiguidade: é o instante do minuto zero, gravado
 * junto com o plano, e é dele que todo ETA parte.
 *
 * ## Fuso
 *
 * `tenants.time_zone` existe para que o **dia operacional** (ADR-0098) seja o
 * dia de quem opera, não o dia UTC. Sem ele, uma rota criada às 21h em São
 * Paulo cai no dia seguinte, e a tela do motorista não a encontra na manhã
 * seguinte — nem no mesmo dia, nem no outro.
 *
 * `'UTC'` como padrão preserva exatamente o comportamento anterior para quem
 * não configurar nada.
 */
export class RouteDepartureAndTenantZone1720004300000 implements MigrationInterface {
  name = 'RouteDepartureAndTenantZone1720004300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE route_plans ADD COLUMN IF NOT EXISTS departure_at timestamptz;`,
    );
    // Planos antigos: a melhor aproximação disponível é o instante em que
    // foram criados. É o que o consumidor de ETA já usava, então nenhum número
    // existente muda de valor por causa do backfill.
    await queryRunner.query(
      `UPDATE route_plans SET departure_at = created_at WHERE departure_at IS NULL;`,
    );
    await queryRunner.query(`ALTER TABLE route_plans ALTER COLUMN departure_at SET NOT NULL;`);

    await queryRunner.query(
      `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS time_zone text NOT NULL DEFAULT 'UTC';`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE tenants DROP COLUMN IF EXISTS time_zone;`);
    await queryRunner.query(`ALTER TABLE route_plans DROP COLUMN IF EXISTS departure_at;`);
  }
}
