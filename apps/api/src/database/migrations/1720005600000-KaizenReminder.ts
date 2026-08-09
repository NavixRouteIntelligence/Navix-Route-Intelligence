import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Lembrete opcional do resumo diário (ADR-0122).
 *
 * **Desligado por omissão**, e é isso que a coluna diz: `NULL` significa «sem
 * lembrete». Não há valor padrão que ligue nada — quem quiser ser lembrado
 * escolhe a hora, e desligar é voltar a `NULL`, pelo mesmo caminho e com o
 * mesmo custo. Um lembrete que se liga sozinho é notificação não pedida, e
 * notificação não pedida sobre trabalho é pressão.
 *
 * `time` sem fuso de propósito: a hora é **local de quem lê**, resolvida pela
 * cadeia perfil → tenant → UTC. Guardar um instante fixaria o lembrete no fuso
 * de hoje e ele passaria a chegar na hora errada depois de uma viagem ou de uma
 * mudança de horário de verão.
 */
export class KaizenReminder1720005600000 implements MigrationInterface {
  name = 'KaizenReminder1720005600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE kaizen_preferences ADD COLUMN reminder_at time;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE kaizen_preferences DROP COLUMN IF EXISTS reminder_at;`);
  }
}
