import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migração inicial — Fase 0. Cria as tabelas de fundação (ver docs/database.md §4):
 * tenants, roles, users, user_roles, refresh_tokens, api_keys, audit_log, outbox.
 *
 * Notas:
 *  - PKs são UUID (geradas na aplicação como UUIDv7 — ADR-0008).
 *  - RLS é habilitada em `users` como padrão de isolamento (ADR-0003); a variável
 *    de sessão `app.current_tenant` é definida por transação pela aplicação.
 *  - `audit_log` e `outbox` são append-only por convenção da aplicação.
 */
export class InitPhase01720000000000 implements MigrationInterface {
  name = 'InitPhase01720000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- tenants ---
    await queryRunner.query(`
      CREATE TABLE tenants (
        id           uuid PRIMARY KEY,
        name         text NOT NULL,
        plan         text NOT NULL DEFAULT 'free',
        region       text NOT NULL DEFAULT 'global',
        status       text NOT NULL DEFAULT 'active',
        created_at   timestamptz NOT NULL DEFAULT now(),
        updated_at   timestamptz NOT NULL DEFAULT now()
      );
    `);

    // --- roles ---
    await queryRunner.query(`
      CREATE TABLE roles (
        id           uuid PRIMARY KEY,
        tenant_id    uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        name         text NOT NULL,
        created_at   timestamptz NOT NULL DEFAULT now(),
        UNIQUE (tenant_id, name)
      );
    `);

    // --- users ---
    await queryRunner.query(`
      CREATE TABLE users (
        id             uuid PRIMARY KEY,
        tenant_id      uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        email          text NOT NULL,
        password_hash  text NOT NULL,
        status         text NOT NULL DEFAULT 'active',
        roles          text[] NOT NULL DEFAULT '{}',
        created_at     timestamptz NOT NULL DEFAULT now(),
        updated_at     timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_users_tenant_email UNIQUE (tenant_id, email)
      );
    `);
    await queryRunner.query(`CREATE INDEX idx_users_tenant ON users (tenant_id);`);

    // --- user_roles (associação) ---
    await queryRunner.query(`
      CREATE TABLE user_roles (
        user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role_id      uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
        PRIMARY KEY (user_id, role_id)
      );
    `);

    // --- refresh_tokens ---
    await queryRunner.query(`
      CREATE TABLE refresh_tokens (
        id           uuid PRIMARY KEY,
        user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash   text NOT NULL,
        family_id    uuid NOT NULL,
        expires_at   timestamptz NOT NULL,
        revoked_at   timestamptz,
        created_at   timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_refresh_tokens_hash UNIQUE (token_hash)
      );
    `);
    await queryRunner.query(
      `CREATE INDEX idx_refresh_tokens_family ON refresh_tokens (family_id);`,
    );

    // --- api_keys (M2M — ver docs/security.md §2.1) ---
    await queryRunner.query(`
      CREATE TABLE api_keys (
        id           uuid PRIMARY KEY,
        tenant_id    uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        name         text NOT NULL,
        key_hash     text NOT NULL,
        scopes       text[] NOT NULL DEFAULT '{}',
        last_used_at timestamptz,
        revoked_at   timestamptz,
        created_at   timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_api_keys_hash UNIQUE (key_hash)
      );
    `);

    // --- audit_log (append-only — ver docs/security.md §7.1) ---
    await queryRunner.query(`
      CREATE TABLE audit_log (
        id           uuid PRIMARY KEY,
        tenant_id    uuid,
        actor_id     uuid,
        action       text NOT NULL,
        resource     text,
        metadata     jsonb NOT NULL DEFAULT '{}',
        created_at   timestamptz NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(
      `CREATE INDEX idx_audit_log_tenant_created ON audit_log (tenant_id, created_at);`,
    );

    // --- outbox (Transactional Outbox — ADR-0006) ---
    await queryRunner.query(`
      CREATE TABLE outbox (
        id           uuid PRIMARY KEY,
        aggregate    text NOT NULL,
        event_type   text NOT NULL,
        payload      jsonb NOT NULL,
        occurred_at  timestamptz NOT NULL DEFAULT now(),
        published_at timestamptz
      );
    `);
    await queryRunner.query(
      `CREATE INDEX idx_outbox_unpublished ON outbox (occurred_at) WHERE published_at IS NULL;`,
    );

    // --- RLS em users (padrão de isolamento multi-tenant — ADR-0003) ---
    // A política já fica criada. Na Fase 0 usamos apenas ENABLE (sem FORCE):
    // o owner das tabelas (usuário da aplicação) contorna RLS, mantendo a
    // Fase 0 executável antes do wiring de contexto de tenant.
    //
    // PARA ENFORCEMENT REAL (início da Fase 1), fazer as DUAS coisas:
    //   1. Rodar a aplicação sob um ROLE não-owner (RLS não se aplica a owners);
    //   2. Definir por transação: SET app.current_tenant = '<tenant_id>'
    //      (via interceptor/provider de conexão — ver src/shared/tenancy).
    // Então trocar para: ALTER TABLE users FORCE ROW LEVEL SECURITY;
    await queryRunner.query(`ALTER TABLE users ENABLE ROW LEVEL SECURITY;`);
    await queryRunner.query(`
      CREATE POLICY tenant_isolation ON users
        USING (tenant_id = current_setting('app.current_tenant', true)::uuid);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP POLICY IF EXISTS tenant_isolation ON users;`);
    await queryRunner.query(`DROP TABLE IF EXISTS outbox;`);
    await queryRunner.query(`DROP TABLE IF EXISTS audit_log;`);
    await queryRunner.query(`DROP TABLE IF EXISTS api_keys;`);
    await queryRunner.query(`DROP TABLE IF EXISTS refresh_tokens;`);
    await queryRunner.query(`DROP TABLE IF EXISTS user_roles;`);
    await queryRunner.query(`DROP TABLE IF EXISTS users;`);
    await queryRunner.query(`DROP TABLE IF EXISTS roles;`);
    await queryRunner.query(`DROP TABLE IF EXISTS tenants;`);
  }
}
