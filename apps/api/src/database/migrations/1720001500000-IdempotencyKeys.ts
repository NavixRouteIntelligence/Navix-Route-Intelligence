import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Chaves de idempotência para operações críticas (POD, tracking, import,
 * otimização) — evita duplicações em re-sincronizações offline (ADR-0017).
 *
 * Guarda a resposta (status + body) da primeira execução por
 * (tenant, Idempotency-Key, método, rota). Reenvios com a mesma chave replicam a
 * resposta armazenada, sem re-executar. Escopada por tenant (RLS FORCE + policy),
 * com grant ao role de runtime.
 */
export class IdempotencyKeys1720001500000 implements MigrationInterface {
  name = 'IdempotencyKeys1720001500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const appUser = process.env.DB_APP_USER ?? 'navix_app';

    await queryRunner.query(`
      CREATE TABLE idempotency_keys (
        id               uuid PRIMARY KEY,
        tenant_id        uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        idempotency_key  text NOT NULL,
        method           text NOT NULL,
        path             text NOT NULL,
        response_status  int  NOT NULL,
        response_body    jsonb NOT NULL,
        created_at       timestamptz NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX uq_idempotency_key ON idempotency_keys (tenant_id, idempotency_key, method, path);`,
    );
    // Índice para expiração/limpeza futura (TTL das chaves).
    await queryRunner.query(
      `CREATE INDEX idx_idempotency_created ON idempotency_keys (created_at);`,
    );

    await queryRunner.query(`ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY;`);
    await queryRunner.query(`ALTER TABLE idempotency_keys FORCE ROW LEVEL SECURITY;`);
    await queryRunner.query(`
      CREATE POLICY tenant_isolation ON idempotency_keys
        USING (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
        WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid);
    `);
    await queryRunner.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON idempotency_keys TO ${appUser};`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP POLICY IF EXISTS tenant_isolation ON idempotency_keys;`);
    await queryRunner.query(`DROP TABLE IF EXISTS idempotency_keys;`);
  }
}
