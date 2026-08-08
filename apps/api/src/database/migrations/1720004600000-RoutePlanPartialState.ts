import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Estado de plano parcial e uma lista só de paradas fora da rota (ADR-0110).
 *
 * ## O que estava indistinguível
 *
 * `route_plans.status` era um `text` que só assumia `'completed'` — o tipo no
 * contrato era literalmente `'completed'`, um estado só. Uma rota que deixou
 * três entregas para trás por capacidade (ADR-0109) ou por falta de trecho
 * viável (ADR-0106) saía marcada como **completa**, exatamente igual a uma que
 * atendeu tudo.
 *
 * ## Por que uma lista, e não duas
 *
 * As exclusões nasceram em ADRs diferentes e viraram duas colunas com formatos
 * diferentes: `unassigned_stops` (só ids) e `unreachable_stops` (id + motivo).
 * Quem perguntasse "o que ficou de fora desta rota?" precisava consultar as
 * duas e saber que a primeira significa capacidade. Agora é uma lista de
 * `{deliveryId, reason}`, e o motivo é sempre explícito.
 */
export class RoutePlanPartialState1720004600000 implements MigrationInterface {
  name = 'RoutePlanPartialState1720004600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Une as duas listas na forma nova. `unassigned_stops` era `["id", …]` e
    // significava sempre capacidade; `unreachable_stops` já vinha com motivo.
    await queryRunner.query(`
      UPDATE route_plans SET unassigned_stops = coalesce(
        (
          SELECT jsonb_agg(item) FROM (
            SELECT jsonb_build_object('deliveryId', e.value #>> '{}', 'reason', 'capacity') AS item
              FROM jsonb_array_elements(coalesce(unassigned_stops, '[]'::jsonb)) e
             WHERE jsonb_typeof(e.value) = 'string'
            UNION ALL
            SELECT jsonb_build_object(
                     'deliveryId', u.value ->> 'deliveryId',
                     'reason', u.value ->> 'reason'
                   )
              FROM jsonb_array_elements(coalesce(unreachable_stops, '[]'::jsonb)) u
          ) unidas
        ),
        '[]'::jsonb
      )
      WHERE unassigned_stops IS NOT NULL OR unreachable_stops IS NOT NULL;
    `);
    // Lista vazia é ruído: `null` significa "nada ficou de fora".
    await queryRunner.query(
      `UPDATE route_plans SET unassigned_stops = NULL WHERE unassigned_stops = '[]'::jsonb;`,
    );
    await queryRunner.query(`ALTER TABLE route_plans DROP COLUMN IF EXISTS unreachable_stops;`);

    // Planos antigos com exclusões nunca deveriam ter sido "completos".
    await queryRunner.query(`
      UPDATE route_plans SET status = 'partial'
       WHERE unassigned_stops IS NOT NULL AND jsonb_array_length(unassigned_stops) > 0;
    `);
    await queryRunner.query(`
      ALTER TABLE route_plans
        ADD CONSTRAINT chk_route_plans_status CHECK (status IN ('completed', 'partial'));
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE route_plans DROP CONSTRAINT IF EXISTS chk_route_plans_status;`,
    );
    await queryRunner.query(`UPDATE route_plans SET status = 'completed';`);
    await queryRunner.query(
      `ALTER TABLE route_plans ADD COLUMN IF NOT EXISTS unreachable_stops jsonb;`,
    );
    // Volta ao formato antigo: só os ids, perdendo os motivos.
    await queryRunner.query(`
      UPDATE route_plans SET unassigned_stops = (
        SELECT jsonb_agg(u.value ->> 'deliveryId')
          FROM jsonb_array_elements(unassigned_stops) u
      ) WHERE unassigned_stops IS NOT NULL;
    `);
  }
}
