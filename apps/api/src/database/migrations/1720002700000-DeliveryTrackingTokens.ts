import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Token público de rastreamento por entrega (ADR-0082) — a base do
 * `track.navix.pt`, onde o destinatário acompanha a entrega **sem conta**.
 *
 * ## Por que uma tabela separada, e não uma coluna em `deliveries`
 *
 * Um request público não tem JWT, logo não tem `app.current_tenant` — e a RLS
 * de `deliveries` é FORÇADA (ver `ForceTenantRls`), então uma consulta sem
 * contexto de tenant devolve **zero linhas**. Resolver o token exigiria, numa
 * coluna de `deliveries`, furar a RLS (SECURITY DEFINER) logo no ponto mais
 * exposto do sistema.
 *
 * Esta tabela quebra o ovo-e-galinha sem enfraquecer nada: ela **não tem RLS**
 * porque **não guarda PII** — só o token opaco e os identificadores. O fluxo
 * fica: resolve o token aqui (sem tenant) → obtém `tenant_id` → abre a
 * transação de tenant → lê a entrega **sob RLS normal**. O isolamento
 * multi-tenant segue valendo no banco para todo dado real.
 *
 * `revoked_at` permite cortar um link individual (o motivo de o token ser
 * opaco e persistido, em vez de um HMAC sem estado como o de mídia do ADR-0046:
 * lá, revogar um link exigiria rodar a chave e derrubar todos).
 */
export class DeliveryTrackingTokens1720002700000 implements MigrationInterface {
  name = 'DeliveryTrackingTokens1720002700000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const appUser = process.env.DB_APP_USER ?? 'navix_app';

    await queryRunner.query(`
      CREATE TABLE delivery_tracking_tokens (
        token       varchar(64) PRIMARY KEY,
        delivery_id uuid NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
        tenant_id   uuid NOT NULL,
        created_at  timestamptz NOT NULL DEFAULT now(),
        revoked_at  timestamptz
      );
    `);

    // Uma entrega tem no máximo um token vigente; revogados podem coexistir.
    await queryRunner.query(`
      CREATE UNIQUE INDEX delivery_tracking_tokens_active_idx
        ON delivery_tracking_tokens (delivery_id)
        WHERE revoked_at IS NULL;
    `);

    // SEM RLS aqui, deliberadamente (ver o cabeçalho): é o ponto de entrada que
    // resolve o tenant. A tabela não contém dado pessoal — apenas o token
    // opaco e os IDs. Todo o resto da leitura pública passa pela RLS.
    await queryRunner.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON delivery_tracking_tokens TO ${appUser};`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS delivery_tracking_tokens;`);
  }
}
