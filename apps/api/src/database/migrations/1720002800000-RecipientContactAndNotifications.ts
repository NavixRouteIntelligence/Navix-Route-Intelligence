import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Contato do destinatário + registro de notificações (ADR-0084).
 *
 * ## Por que o contato precisava existir
 *
 * A entrega guardava apenas o **nome** de quem recebe (`recipient`, ADR-0076).
 * Sem e-mail não há como notificar ninguém — e o telefone, apesar de já ser
 * detectado e exibido no preview da importação, era **descartado** ao confirmar,
 * exatamente como acontecia com o nome antes da ADR-0076.
 *
 * ## Privacidade
 *
 * São dados pessoais de **terceiros** (o destinatário não é usuário da Navix),
 * então:
 * - ambos são opcionais e nulos para tudo que já existe (sem backfill possível);
 * - o opt-out é por endereço, não por entrega: pedir para parar de receber vale
 *   para as entregas seguintes também (`notification_opt_outs`);
 * - `notification_log` registra o que foi enviado, para não repetir a mesma
 *   notificação e para auditar — guarda o destino já **hasheado**, não em claro.
 */
export class RecipientContactAndNotifications1720002800000 implements MigrationInterface {
  name = 'RecipientContactAndNotifications1720002800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const appUser = process.env.DB_APP_USER ?? 'navix_app';

    await queryRunner.query(`
      ALTER TABLE "deliveries"
        ADD COLUMN "recipient_email" text,
        ADD COLUMN "recipient_phone" text
    `);

    // --- Opt-out do destinatário -------------------------------------------
    // Por (tenant, canal, destino): quem pede para sair não recebe mais, e isso
    // vale para qualquer entrega futura daquele tenant.
    await queryRunner.query(`
      CREATE TABLE notification_opt_outs (
        id          uuid PRIMARY KEY,
        tenant_id   uuid NOT NULL,
        channel     text NOT NULL,
        destination text NOT NULL,
        created_at  timestamptz NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX notification_opt_outs_unique_idx
        ON notification_opt_outs (tenant_id, channel, destination);
    `);

    // --- Log de envios ------------------------------------------------------
    // `delivery_id` + `event` únicos: a mesma notificação não sai duas vezes,
    // mesmo que o evento de domínio se repita (idempotência).
    await queryRunner.query(`
      CREATE TABLE notification_log (
        id               uuid PRIMARY KEY,
        tenant_id        uuid NOT NULL,
        delivery_id      uuid NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
        event            text NOT NULL,
        channel          text NOT NULL,
        -- SHA-256 do destino: permite auditar e depurar sem guardar o e-mail
        -- de terceiros repetido numa segunda tabela.
        destination_hash text NOT NULL,
        sent_at          timestamptz NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX notification_log_once_idx
        ON notification_log (delivery_id, event);
    `);

    // RLS: ambas guardam dado de tenant (o opt-out inclui PII), então seguem a
    // regra geral. Só a tabela de tokens de rastreio fica fora (ADR-0082).
    for (const table of ['notification_opt_outs', 'notification_log']) {
      await queryRunner.query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`);
      await queryRunner.query(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY;`);
      await queryRunner.query(`
        CREATE POLICY tenant_isolation ON ${table}
          USING (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
          WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid);
      `);
      await queryRunner.query(
        `GRANT SELECT, INSERT, UPDATE, DELETE ON ${table} TO ${appUser};`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS notification_log;`);
    await queryRunner.query(`DROP TABLE IF EXISTS notification_opt_outs;`);
    await queryRunner.query(
      `ALTER TABLE "deliveries" DROP COLUMN IF EXISTS "recipient_email", DROP COLUMN IF EXISTS "recipient_phone";`,
    );
  }
}
