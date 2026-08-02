import type { MigrationInterface, QueryRunner } from 'typeorm';

/** API pública e webhooks de saída (ADR-0094). */
export class PublicApiAndWebhooks1720003600000 implements MigrationInterface {
  name = 'PublicApiAndWebhooks1720003600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const appUser = process.env.DB_APP_USER ?? 'navix_app';

    // `api_keys` nasceu na migração inicial como fundação sem fluxo M2M.
    // Evoluímos a tabela existente para não apagar chaves de ambientes antigos.
    await queryRunner.query(`ALTER TABLE api_keys ADD COLUMN key_prefix varchar(24);`);
    await queryRunner.query(`
      UPDATE api_keys SET key_prefix = 'legacy_' || left(id::text, 12)
       WHERE key_prefix IS NULL;
    `);
    await queryRunner.query(`ALTER TABLE api_keys ALTER COLUMN key_prefix SET NOT NULL;`);
    await queryRunner.query(`
      ALTER TABLE api_keys
        ADD COLUMN quota_per_minute integer NOT NULL DEFAULT 120
          CHECK (quota_per_minute BETWEEN 1 AND 10000),
        ADD COLUMN expires_at timestamptz;
    `);
    await queryRunner.query(
      `CREATE INDEX api_keys_tenant_idx ON api_keys (tenant_id, created_at DESC);`,
    );
    // A RLS especial de `api_keys` já existe (ADR-0054): SELECT pré-tenant é
    // permitido, enquanto escrita exige contexto do próprio tenant.

    await queryRunner.query(`
      CREATE TABLE webhook_subscriptions (
        id               uuid PRIMARY KEY,
        tenant_id        uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        name             varchar(120) NOT NULL,
        url              text NOT NULL,
        events           text[] NOT NULL,
        encrypted_secret text NOT NULL,
        enabled          boolean NOT NULL DEFAULT true,
        created_at       timestamptz NOT NULL DEFAULT now(),
        updated_at       timestamptz NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(
      `CREATE INDEX webhook_subscriptions_tenant_idx ON webhook_subscriptions (tenant_id, created_at DESC);`,
    );

    await queryRunner.query(`
      CREATE TABLE webhook_deliveries (
        id               uuid PRIMARY KEY,
        tenant_id        uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        subscription_id  uuid NOT NULL REFERENCES webhook_subscriptions(id) ON DELETE CASCADE,
        event_type       varchar(80) NOT NULL,
        aggregate_id     uuid NOT NULL,
        payload          jsonb NOT NULL,
        status           varchar(20) NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending', 'delivering', 'delivered', 'dead')),
        attempts         integer NOT NULL DEFAULT 0,
        next_attempt_at  timestamptz NOT NULL DEFAULT now(),
        last_error       text,
        response_status  integer,
        created_at       timestamptz NOT NULL DEFAULT now(),
        delivered_at     timestamptz
      );
    `);
    await queryRunner.query(`
      CREATE INDEX webhook_deliveries_due_idx
        ON webhook_deliveries (tenant_id, status, next_attempt_at)
        WHERE status IN ('pending', 'delivering');
    `);

    for (const table of ['webhook_subscriptions', 'webhook_deliveries']) {
      await queryRunner.query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`);
      await queryRunner.query(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY;`);
      await queryRunner.query(`
        CREATE POLICY tenant_isolation ON ${table}
          USING (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
          WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid);
      `);
      await queryRunner.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ${table} TO ${appUser};`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS webhook_deliveries;`);
    await queryRunner.query(`DROP TABLE IF EXISTS webhook_subscriptions;`);
    await queryRunner.query(`DROP INDEX IF EXISTS api_keys_tenant_idx;`);
    await queryRunner.query(`ALTER TABLE api_keys DROP COLUMN IF EXISTS expires_at;`);
    await queryRunner.query(`ALTER TABLE api_keys DROP COLUMN IF EXISTS quota_per_minute;`);
    await queryRunner.query(`ALTER TABLE api_keys DROP COLUMN IF EXISTS key_prefix;`);
  }
}
