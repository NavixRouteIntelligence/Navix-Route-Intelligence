import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Convite de motorista + vínculo ficha↔login (ADR-0085).
 *
 * ## O problema que isto resolve
 *
 * Havia **dois** conceitos de motorista, sem ligação:
 *
 * - `drivers` — ficha da frota (nome, CNH, skills), referenciada por
 *   `deliveries.driver_id` e usada pelo otimizador;
 * - `users` com papel `driver` — o login, sob o qual o app grava as posições.
 *
 * Os ids eram espaços disjuntos: uma entrega atribuída à ficha nunca casava com
 * as posições enviadas pelo usuário. Era por isso que a tela de frota mostrava
 * o motorista como "offline, sem sinal" enquanto ele rodava com o app aberto.
 *
 * `drivers.user_id` é a ponte. Fica **opcional**: a frota continua podendo ter
 * ficha de quem não usa o app (terceirizado, motorista sem smartphone).
 */
export class DriverInvites1720002900000 implements MigrationInterface {
  name = 'DriverInvites1720002900000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const appUser = process.env.DB_APP_USER ?? 'navix_app';

    await queryRunner.query(`ALTER TABLE drivers ADD COLUMN user_id uuid REFERENCES users(id) ON DELETE SET NULL`);
    // Um login pertence a no máximo uma ficha dentro do tenant.
    await queryRunner.query(`
      CREATE UNIQUE INDEX drivers_user_unique_idx ON drivers (tenant_id, user_id)
        WHERE user_id IS NOT NULL;
    `);

    await queryRunner.query(`
      CREATE TABLE driver_invites (
        token       varchar(64) PRIMARY KEY,
        tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        email       text NOT NULL,
        -- Ficha a ligar ao aceitar. Nula = cria ficha nova no aceite.
        driver_id   uuid REFERENCES drivers(id) ON DELETE CASCADE,
        invited_by  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at  timestamptz NOT NULL,
        accepted_at timestamptz,
        revoked_at  timestamptz,
        created_at  timestamptz NOT NULL DEFAULT now()
      );
    `);

    // Um convite pendente por e-mail dentro do tenant — reconvidar substitui.
    await queryRunner.query(`
      CREATE UNIQUE INDEX driver_invites_pending_idx
        ON driver_invites (tenant_id, lower(email))
        WHERE accepted_at IS NULL AND revoked_at IS NULL;
    `);

    // SEM RLS, pela mesma razão da tabela de tokens de rastreio (ADR-0082): é o
    // ponto de entrada de um request **público** (o convidado ainda não tem
    // conta nem tenant), então é ela que resolve o tenant. Guarda e-mail, que é
    // PII — por isso o token é opaco e de uso único, e o `SELECT` sempre parte
    // do token, nunca do e-mail.
    await queryRunner.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON driver_invites TO ${appUser};`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS driver_invites;`);
    await queryRunner.query(`DROP INDEX IF EXISTS drivers_user_unique_idx;`);
    await queryRunner.query(`ALTER TABLE drivers DROP COLUMN IF EXISTS user_id;`);
  }
}
